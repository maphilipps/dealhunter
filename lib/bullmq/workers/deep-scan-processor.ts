import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import type { DeepScanJobData, DeepScanJobResult } from '../queues';

import { db } from '@/lib/db';
import { backgroundJobs, qualifications } from '@/lib/db/schema';
import { runDeepScanAgentNative } from '@/lib/deep-scan/agent-native';
import {
  getCheckpointState,
  markDeepScanStarted,
  resetCheckpoints,
} from '@/lib/deep-scan/checkpoint';


const DEFAULT_EXPERTS = [
  'scraper',
  'tech',
  'website',
  'performance',
  'architecture',
  'hosting',
  'integrations',
  'migration',
  'project',
  'costs',
  'decision',
];

class JobProgressUpdater {
  private pendingUpdate: {
    progress: number;
    currentExpert: string | null;
    completedExperts: string[];
    sectionConfidences: Record<string, number>;
  } | null = null;
  private flushPromise: Promise<void> | null = null;
  private lastFlush = 0;
  private readonly minFlushInterval = 2000;

  constructor(private dbJobId: string) {}

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

  async flush(): Promise<void> {
    if (!this.pendingUpdate) return;

    if (this.flushPromise) {
      await this.flushPromise;
    }

    const update = this.pendingUpdate;
    this.pendingUpdate = null;
    this.lastFlush = Date.now();

    this.flushPromise = db
      .update(backgroundJobs)
      .set({
        progress: Math.round(update.progress),
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

async function finalizeJobWithTransaction(
  dbJobId: string,
  qualificationId: string,
  success: boolean,
  result: DeepScanJobResult,
  error?: string
): Promise<void> {
  await db.transaction(async tx => {
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

export async function processDeepScanJob(job: Job<DeepScanJobData>): Promise<DeepScanJobResult> {
  const { qualificationId, websiteUrl, dbJobId, forceReset, selectedExperts, userId } = job.data;

  console.log(`[DeepScan Worker] Starting job ${job.id} for qualification ${qualificationId}`);

  await markJobRunning(dbJobId);
  const progressUpdater = new JobProgressUpdater(dbJobId);

  try {
    if (forceReset) {
      console.log(`[DeepScan Worker] Force reset requested, clearing checkpoints`);
      await resetCheckpoints(qualificationId);
    }

    const checkpointState = await getCheckpointState(qualificationId);

    await markDeepScanStarted(qualificationId);

    await progressUpdater.update(1, 'initializing', checkpointState.completedExperts, {});

    const completion = await runDeepScanAgentNative(
      {
        leadId: qualificationId,
        websiteUrl,
        userId,
        selectedExperts,
        completedExperts: checkpointState.completedExperts,
      },
      {
        onProgress: async state => {
          await progressUpdater.update(
            state.progress,
            state.currentExpert,
            state.completedExperts,
            state.sectionConfidences
          );
        },
      }
    );

    const completedExperts = completion.completedExperts;
    const failedExperts = completion.failedExperts;
    const sectionConfidences = completion.sectionConfidences;

    const success = failedExperts.length <= 3;

    const result: DeepScanJobResult = {
      success,
      completedExperts,
      failedExperts,
      sectionConfidences,
      error: failedExperts.length > 0 ? `Failed experts: ${failedExperts.join(', ')}` : undefined,
    };

    await progressUpdater.flush();
    await finalizeJobWithTransaction(dbJobId, qualificationId, success, result);

    console.log(
      `[DeepScan Worker] Job ${job.id} completed. Success: ${success}, ` +
        `Completed: ${completedExperts.length}, Failed: ${failedExperts.length}`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DeepScan Worker] Job ${job.id} failed:`, errorMsg);
    console.error('[DeepScan Worker] Error detail:', error);

    const result: DeepScanJobResult = {
      success: false,
      completedExperts: [],
      failedExperts: expectedFallbackExperts(selectedExperts),
      sectionConfidences: {},
      error: errorMsg,
    };

    await finalizeJobWithTransaction(dbJobId, qualificationId, false, result, errorMsg);
    throw error;
  }
}

function expectedFallbackExperts(selectedExperts?: string[]): string[] {
  if (selectedExperts && selectedExperts.length > 0) {
    return Array.from(new Set(['scraper', ...selectedExperts]));
  }
  return DEFAULT_EXPERTS.slice();
}
