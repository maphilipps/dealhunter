import type { Job } from 'bullmq';

import { db } from '@/lib/db';
import { backgroundJobs, qualifications } from '@/lib/db/schema';
import {
  getCheckpointState,
  saveCheckpoint,
  saveError,
  markDeepScanStarted,
  resetCheckpoints,
  type DeepScanPhase,
} from '@/lib/deep-scan/checkpoint';
import { canExpertRun } from '@/lib/deep-scan/expert-dependencies';
import { EXPERT_TO_SECTIONS } from '@/lib/deep-scan/section-expert-mapping';
import { runArchitectureExpert } from '@/lib/deep-scan/experts/architecture-expert';
import { runCostsExpert } from '@/lib/deep-scan/experts/costs-expert';
import { runDecisionExpert } from '@/lib/deep-scan/experts/decision-expert';
import { runHostingExpert } from '@/lib/deep-scan/experts/hosting-expert';
import { runIntegrationsExpert } from '@/lib/deep-scan/experts/integrations-expert';
import { runMigrationExpert } from '@/lib/deep-scan/experts/migration-expert';
import { runPerformanceExpert } from '@/lib/deep-scan/experts/performance-expert';
import { runProjectExpert } from '@/lib/deep-scan/experts/project-expert';
import { runTechExpert } from '@/lib/deep-scan/experts/tech-expert';
import { runWebsiteExpert } from '@/lib/deep-scan/experts/website-expert';
import { scrapeSite, embedScrapedPage } from '@/lib/deep-scan/scraper';
import type { DeepScanJobData, DeepScanJobResult } from '../queues';
import { eq } from 'drizzle-orm';

/**
 * Expert timeout (5 minutes per expert - increased for background jobs)
 */
const EXPERT_TIMEOUT_MS = 300000;

/**
 * Scraping timeout (5 minutes for large sites)
 */
const SCRAPING_TIMEOUT_MS = 300000;

/**
 * Expert runner functions mapped by name
 */
const EXPERT_RUNNERS: Record<
  string,
  (input: {
    leadId: string;
    websiteUrl: string;
  }) => Promise<{ success: boolean; confidence?: number }>
> = {
  tech: runTechExpert,
  website: runWebsiteExpert,
  performance: runPerformanceExpert,
  architecture: runArchitectureExpert,
  hosting: runHostingExpert,
  integrations: runIntegrationsExpert,
  migration: runMigrationExpert,
  project: runProjectExpert,
  costs: runCostsExpert,
  decision: runDecisionExpert,
};

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/**
 * Debounced job progress updater
 * Batches database updates to prevent N+1 writes
 */
class JobProgressUpdater {
  private pendingUpdate: {
    progress: number;
    currentExpert: string | null;
    completedExperts: string[];
    sectionConfidences: Record<string, number>;
  } | null = null;
  private flushPromise: Promise<void> | null = null;
  private lastFlush = 0;
  private readonly minFlushInterval = 2000; // 2 seconds minimum between DB writes

  constructor(private dbJobId: string) {}

  /**
   * Queue a progress update (batched)
   */
  async update(
    progress: number,
    currentExpert: string | null,
    completedExperts: string[],
    sectionConfidences: Record<string, number>
  ): Promise<void> {
    this.pendingUpdate = { progress, currentExpert, completedExperts, sectionConfidences };

    const now = Date.now();
    if (now - this.lastFlush >= this.minFlushInterval) {
      await this.flush();
    }
  }

  /**
   * Force flush pending update to database
   */
  async flush(): Promise<void> {
    if (!this.pendingUpdate) return;

    // Prevent concurrent flushes
    if (this.flushPromise) {
      await this.flushPromise;
    }

    const update = this.pendingUpdate;
    this.pendingUpdate = null;
    this.lastFlush = Date.now();

    this.flushPromise = db
      .update(backgroundJobs)
      .set({
        progress: update.progress,
        currentStep: update.currentExpert ? `Running ${update.currentExpert} expert` : 'Processing',
        currentExpert: update.currentExpert,
        completedExperts: JSON.stringify(update.completedExperts),
        sectionConfidences: JSON.stringify(update.sectionConfidences),
        updatedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, this.dbJobId))
      .then(() => {
        this.flushPromise = null;
      });

    await this.flushPromise;
  }
}

/**
 * Mark job as running
 */
async function markJobRunning(dbJobId: string): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, dbJobId));
}

/**
 * Finalize job and qualification status atomically within a transaction
 * This ensures both tables are updated together or not at all
 */
async function finalizeJobWithTransaction(
  dbJobId: string,
  qualificationId: string,
  success: boolean,
  result: DeepScanJobResult,
  error?: string
): Promise<void> {
  await db.transaction(async tx => {
    // Update background job status
    await tx
      .update(backgroundJobs)
      .set({
        status: success ? 'completed' : 'failed',
        progress: 100,
        result: JSON.stringify(result),
        errorMessage: result.error || null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, dbJobId));

    // Update qualification deep scan status
    await tx
      .update(qualifications)
      .set({
        deepScanStatus: success ? 'completed' : 'failed',
        deepScanCompletedAt: new Date(),
        deepScanError: error || null,
        updatedAt: new Date(),
      })
      .where(eq(qualifications.id, qualificationId));
  });
}

/**
 * Deep Scan Job Processor
 *
 * Processes deep scan jobs using DAG-based execution:
 * 1. Scraper runs first (if not already done)
 * 2. Experts run in parallel when their dependencies are met
 * 3. Progress is tracked via database updates
 */
export async function processDeepScanJob(job: Job<DeepScanJobData>): Promise<DeepScanJobResult> {
  const { qualificationId, websiteUrl, dbJobId, forceReset, selectedExperts } = job.data;

  console.log(`[DeepScan Worker] Starting job ${job.id} for qualification ${qualificationId}`);

  // Mark job as running
  await markJobRunning(dbJobId);

  // Create debounced progress updater to prevent N+1 database writes
  const progressUpdater = new JobProgressUpdater(dbJobId);

  // Track results
  const completedExperts: string[] = [];
  const failedExperts: string[] = [];
  const sectionConfidences: Record<string, number> = {};

  try {
    // Handle force reset
    if (forceReset) {
      console.log(`[DeepScan Worker] Force reset requested, clearing checkpoints`);
      await resetCheckpoints(qualificationId);
    }

    // Get checkpoint state
    const checkpointState = await getCheckpointState(qualificationId);
    const alreadyCompleted = new Set(checkpointState.completedExperts || []);

    // Mark scan as started
    await markDeepScanStarted(qualificationId);

    // Determine which experts to run
    let expertsToRun = Object.keys(EXPERT_RUNNERS);

    // If selective re-scan, only run selected experts
    if (selectedExperts && selectedExperts.length > 0) {
      expertsToRun = selectedExperts.filter(e => EXPERT_RUNNERS[e]);
      console.log(`[DeepScan Worker] Selective re-scan: running only ${expertsToRun.join(', ')}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: SCRAPING (if not already done and not selective)
    // ═══════════════════════════════════════════════════════════════
    const skipScraping =
      alreadyCompleted.has('scraper') ||
      (selectedExperts && selectedExperts.length > 0 && !selectedExperts.includes('scraper'));

    if (!skipScraping) {
      console.log(`[DeepScan Worker] Starting scraping for ${websiteUrl}`);

      await progressUpdater.update(5, 'scraper', [], {});

      try {
        let pagesScraped = 0;

        await withTimeout(
          scrapeSite(websiteUrl, { maxPages: 30 }, async page => {
            // Embed each page as it's scraped
            await embedScrapedPage(qualificationId, page);
            pagesScraped++;

            // Update progress (scraping is 0-20%)
            const progress = Math.min(5 + (pagesScraped / 30) * 15, 20);
            await progressUpdater.update(progress, 'scraper', [], {});
          }),
          SCRAPING_TIMEOUT_MS,
          'Scraping'
        );

        await saveCheckpoint(qualificationId, 'scraper', true, 'phase2');
        completedExperts.push('scraper');
        console.log(`[DeepScan Worker] Scraping completed: ${pagesScraped} pages`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown scraping error';
        console.error(`[DeepScan Worker] Scraping failed: ${errorMsg}`);
        await saveError(qualificationId, errorMsg, 'scraping');
        // Continue with experts anyway - they can use partial RAG data
        failedExperts.push('scraper');
      }
    } else {
      console.log(`[DeepScan Worker] Skipping scraping (already completed or selective re-scan)`);
      if (alreadyCompleted.has('scraper')) {
        completedExperts.push('scraper');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2 & 3: RUN EXPERTS BASED ON DAG
    // ═══════════════════════════════════════════════════════════════
    const completedSet = new Set([...alreadyCompleted, ...completedExperts]);
    const runningExperts = new Set<string>();
    const input = { leadId: qualificationId, websiteUrl };

    // Filter experts to run
    const pendingExperts = expertsToRun.filter(
      e => !completedSet.has(e) && e !== 'scraper' && EXPERT_RUNNERS[e]
    );

    console.log(`[DeepScan Worker] Pending experts: ${pendingExperts.join(', ')}`);

    // Calculate total steps for progress
    const totalSteps = pendingExperts.length + completedExperts.length;
    let completedSteps = completedExperts.length;

    // Process experts in waves based on dependencies
    while (pendingExperts.length > 0) {
      // Find experts that can run now
      const runnableExperts = pendingExperts.filter(
        expert => canExpertRun(expert, completedSet) && !runningExperts.has(expert)
      );

      if (runnableExperts.length === 0) {
        // No experts can run - check if we're stuck
        if (runningExperts.size === 0) {
          console.error(`[DeepScan Worker] No runnable experts and none running - stuck!`);
          break;
        }
        // Wait for running experts to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      console.log(`[DeepScan Worker] Running experts in parallel: ${runnableExperts.join(', ')}`);

      // Run experts in parallel
      const results = await Promise.allSettled(
        runnableExperts.map(async expertName => {
          runningExperts.add(expertName);
          await progressUpdater.update(
            20 + (completedSteps / totalSteps) * 80,
            expertName,
            [...completedExperts],
            sectionConfidences
          );

          try {
            const runner = EXPERT_RUNNERS[expertName];
            const result = await withTimeout(runner(input), EXPERT_TIMEOUT_MS, expertName);

            // Determine phase for checkpoint
            const phase: DeepScanPhase = ['project', 'costs', 'decision'].includes(expertName)
              ? 'phase3'
              : 'phase2';

            await saveCheckpoint(qualificationId, expertName, result.success, phase);

            // Store confidence for sections
            const sections = EXPERT_TO_SECTIONS[expertName] || [];
            for (const section of sections) {
              sectionConfidences[section] = result.confidence || 50;
            }

            return { expertName, success: result.success, confidence: result.confidence };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[DeepScan Worker] Expert ${expertName} failed: ${errorMsg}`);
            await saveError(qualificationId, `${expertName}: ${errorMsg}`, 'phase2');
            return { expertName, success: false, error: errorMsg };
          } finally {
            runningExperts.delete(expertName);
          }
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { expertName, success } = result.value;
          const idx = pendingExperts.indexOf(expertName);
          if (idx !== -1) pendingExperts.splice(idx, 1);

          if (success) {
            completedExperts.push(expertName);
            completedSet.add(expertName);
          } else {
            failedExperts.push(expertName);
            // Still add to completed set so dependents can potentially run
            completedSet.add(expertName);
          }
          completedSteps++;
        } else {
          // Promise rejected - should not happen with our error handling
          console.error(`[DeepScan Worker] Unexpected rejection:`, result.reason);
        }
      }

      // Update progress and flush to ensure final state is saved
      await progressUpdater.update(
        20 + (completedSteps / totalSteps) * 80,
        null,
        completedExperts,
        sectionConfidences
      );
      await progressUpdater.flush();
    }

    // ═══════════════════════════════════════════════════════════════
    // FINALIZE (transactional - updates both job and qualification atomically)
    // ═══════════════════════════════════════════════════════════════
    const success = failedExperts.length <= 3; // Allow up to 3 failures

    const result: DeepScanJobResult = {
      success,
      completedExperts,
      failedExperts,
      sectionConfidences,
      error: failedExperts.length > 0 ? `Failed experts: ${failedExperts.join(', ')}` : undefined,
    };

    // Atomic transaction: update both backgroundJobs and qualifications tables
    await finalizeJobWithTransaction(dbJobId, qualificationId, success, result);

    console.log(
      `[DeepScan Worker] Job ${job.id} completed. Success: ${success}, ` +
        `Completed: ${completedExperts.length}, Failed: ${failedExperts.length}`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DeepScan Worker] Job ${job.id} failed:`, errorMsg);

    const result: DeepScanJobResult = {
      success: false,
      completedExperts,
      failedExperts,
      sectionConfidences,
      error: errorMsg,
    };

    // Atomic transaction: update both backgroundJobs and qualifications tables
    await finalizeJobWithTransaction(dbJobId, qualificationId, false, result, errorMsg);

    throw error; // Re-throw for BullMQ retry logic
  }
}
