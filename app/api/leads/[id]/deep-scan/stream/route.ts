import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import {
  getCheckpointState,
  saveCheckpoint,
  saveError,
  markDeepScanStarted,
  markDeepScanCompleted,
  resetCheckpoints,
  type DeepScanPhase,
} from '@/lib/deep-scan/checkpoint';
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
import {
  createAgentEventStream,
  createSSEResponse,
  type EventEmitter,
} from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10 minutes for full audit (Vercel Pro max)

// Global timeout for the entire deep scan (9 minutes to leave room for cleanup)
const DEEP_SCAN_TIMEOUT_MS = 540000;

// Individual expert timeout (3 minutes per expert - increased for complex analyses)
const EXPERT_TIMEOUT_MS = 180000;

// Scraping timeout (4 minutes for large sites)
const SCRAPING_TIMEOUT_MS = 240000;

// Expert definitions
const PHASE2_EXPERTS = [
  { name: 'website', run: runWebsiteExpert },
  { name: 'tech', run: runTechExpert },
  { name: 'performance', run: runPerformanceExpert },
  { name: 'architecture', run: runArchitectureExpert },
  { name: 'hosting', run: runHostingExpert },
  { name: 'integrations', run: runIntegrationsExpert },
  { name: 'migration', run: runMigrationExpert },
] as const;

const PHASE3_EXPERTS = [
  { name: 'project', run: runProjectExpert },
  { name: 'costs', run: runCostsExpert },
  { name: 'decision', run: runDecisionExpert },
] as const;

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
 * Run a single expert with timeout and checkpoint
 */
async function runExpertWithCheckpoint(
  expert: {
    name: string;
    run: (
      input: { leadId: string; websiteUrl: string },
      emit: EventEmitter
    ) => Promise<{ success: boolean }>;
  },
  input: { leadId: string; websiteUrl: string },
  emit: EventEmitter,
  phase: DeepScanPhase
): Promise<{ name: string; success: boolean; error?: string }> {
  try {
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: expert.name, message: `Starting ${expert.name} expert...` },
    });

    const result = await withTimeout(expert.run(input, emit), EXPERT_TIMEOUT_MS, expert.name);

    // Save checkpoint after successful completion
    await saveCheckpoint(input.leadId, expert.name, result.success, phase);

    return { name: expert.name, success: result.success };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    emit({
      type: AgentEventType.ERROR,
      data: {
        message: `Expert ${expert.name} failed: ${errorMsg}`,
        code: 'EXPERT_ERROR',
      },
    });

    // Save error state but mark checkpoint (partial progress is better than none)
    await saveCheckpoint(input.leadId, expert.name, false, phase);
    await saveError(input.leadId, `${expert.name}: ${errorMsg}`, phase);

    return { name: expert.name, success: false, error: errorMsg };
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  const { id } = await params;

  // Check for reset parameter
  const forceReset = request.nextUrl.searchParams.get('reset') === 'true';

  // Verify lead exists
  const [lead] = await db
    .select({
      id: leads.id,
      websiteUrl: leads.websiteUrl,
      deepScanStatus: leads.deepScanStatus,
    })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead) {
    return new Response(JSON.stringify({ error: 'Lead not found' }), {
      status: 404,
    });
  }

  if (!lead.websiteUrl) {
    return new Response(JSON.stringify({ error: 'No website URL configured' }), { status: 400 });
  }

  // Reset checkpoints if requested
  if (forceReset) {
    await resetCheckpoints(id);
  }

  const websiteUrl = lead.websiteUrl;

  // Set up global timeout with AbortController
  const abortController = new AbortController();
  const globalTimeout = setTimeout(() => {
    abortController.abort();
  }, DEEP_SCAN_TIMEOUT_MS);

  const stream = createAgentEventStream(async (emit: EventEmitter) => {
    try {
      // ═══════════════════════════════════════════════════════════════
      // CHECK FOR RESUME
      // ═══════════════════════════════════════════════════════════════
      const checkpointState = await getCheckpointState(id);
      const completedExperts = checkpointState.completedExperts;
      const isResume = completedExperts.length > 0 && !forceReset;

      if (isResume) {
        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: {
            agent: 'DeepScan',
            message: `Resume: ${completedExperts.length} Experten bereits abgeschlossen (${completedExperts.join(', ')})`,
          },
        });
      }

      // Mark scan as started
      await markDeepScanStarted(id);

      const agentInput = { leadId: id, websiteUrl };
      const results: Record<string, { success: boolean; error?: string }> = {};

      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: SCRAPING (skip if already past this phase)
      // ═══════════════════════════════════════════════════════════════
      const skipScraping =
        checkpointState.currentPhase === 'phase2' || checkpointState.currentPhase === 'phase3';

      if (!skipScraping) {
        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: { agent: 'Scraper', message: 'Starte Website-Analyse...' },
        });

        let pagesScraped = 0;

        try {
          const scrapeResult = await withTimeout(
            scrapeSite(websiteUrl, { maxPages: 30, includeScreenshots: true }, async page => {
              // Check for abort
              if (abortController.signal.aborted) {
                throw new Error('Deep scan aborted due to timeout');
              }

              // Live RAG embedding
              await embedScrapedPage(id, page);
              pagesScraped++;

              emit({
                type: AgentEventType.AGENT_PROGRESS,
                data: {
                  agent: 'Scraper',
                  message: `Seite ${pagesScraped} analysiert: ${page.title}`,
                  progress: Math.min(pagesScraped * 3, 90),
                },
              });
            }),
            SCRAPING_TIMEOUT_MS,
            'Scraper'
          );

          emit({
            type: AgentEventType.AGENT_COMPLETE,
            data: {
              agent: 'Scraper',
              result: {
                pagesScraped: scrapeResult.pages.length,
                sitemapFound: scrapeResult.sitemapFound,
                techStack: scrapeResult.techStack.map(t => t.name),
                duration: scrapeResult.duration,
              },
            },
          });

          // Update phase
          await saveCheckpoint(id, 'scraper', true, 'phase2');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Scraping failed';
          emit({
            type: AgentEventType.ERROR,
            data: { message: `Scraper error: ${errorMsg}`, code: 'SCRAPER_ERROR' },
          });
          await saveError(id, errorMsg, 'scraping');
          // Continue with experts anyway - they can use RAG data from partial scrape
        }
      } else {
        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: { agent: 'Scraper', message: 'Scraping bereits abgeschlossen, überspringe...' },
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: BASE EXPERT AGENTS (parallel - unabhängige Analysen)
      // ═══════════════════════════════════════════════════════════════
      const skipPhase2 = checkpointState.currentPhase === 'phase3';

      if (!skipPhase2) {
        // Filter out already completed experts
        const phase2ToRun = PHASE2_EXPERTS.filter(e => !completedExperts.includes(e.name));

        if (phase2ToRun.length > 0) {
          emit({
            type: AgentEventType.AGENT_PROGRESS,
            data: {
              agent: 'Phase 2',
              message: `Starte ${phase2ToRun.length} Basis-Experten parallel...`,
            },
          });

          // Run remaining Phase 2 experts in parallel with individual timeouts
          const phase2Results = await Promise.allSettled(
            phase2ToRun.map(expert => runExpertWithCheckpoint(expert, agentInput, emit, 'phase2'))
          );

          // Process results
          phase2Results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
              results[result.value.name] = result.value;
            } else {
              results[phase2ToRun[i].name] = {
                success: false,
                error: result.reason?.message || 'Unknown error',
              };
            }
          });
        }

        // Add already completed experts to results
        completedExperts
          .filter(name => PHASE2_EXPERTS.some(e => e.name === name))
          .forEach(name => {
            results[name] = { success: true };
          });

        const phase2Success = Object.values(results).filter(r => r.success).length;

        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Phase 2',
            result: { completed: phase2Success, total: PHASE2_EXPERTS.length },
          },
        });

        // Update to phase 3
        await saveCheckpoint(id, '_phase2_complete', true, 'phase3');
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: SYNTHESIS AGENTS (sequential - abhängig von Phase 2)
      // ═══════════════════════════════════════════════════════════════
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: 'Phase 3',
          message: 'Starte Synthese-Experten (Project, Costs, Decision)...',
        },
      });

      // Run Phase 3 experts sequentially (they depend on each other)
      for (const expert of PHASE3_EXPERTS) {
        // Skip if already completed
        if (completedExperts.includes(expert.name)) {
          results[expert.name] = { success: true };
          continue;
        }

        // Check for abort
        if (abortController.signal.aborted) {
          emit({
            type: AgentEventType.ERROR,
            data: { message: 'Deep scan aborted due to timeout', code: 'TIMEOUT' },
          });
          break;
        }

        const result = await runExpertWithCheckpoint(expert, agentInput, emit, 'phase3');
        results[expert.name] = result;
      }

      const phase3Success = PHASE3_EXPERTS.filter(e => results[e.name]?.success).length;

      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: {
          agent: 'Phase 3',
          result: { completed: phase3Success, total: PHASE3_EXPERTS.length },
        },
      });

      // ═══════════════════════════════════════════════════════════════
      // COMPLETE
      // ═══════════════════════════════════════════════════════════════
      const allExperts = [...PHASE2_EXPERTS, ...PHASE3_EXPERTS];
      const totalSuccess = allExperts.filter(e => results[e.name]?.success).length;
      const failedExperts = allExperts
        .filter(e => results[e.name] && !results[e.name].success)
        .map(e => e.name);

      // Mark as completed (success if majority of experts succeeded)
      const overallSuccess = totalSuccess >= 7; // At least 7 of 10 experts
      await markDeepScanCompleted(
        id,
        overallSuccess,
        failedExperts.length > 0 ? `Failed experts: ${failedExperts.join(', ')}` : undefined
      );

      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: {
          agent: 'DeepScan',
          result: {
            success: overallSuccess,
            expertsCompleted: allExperts.filter(e => results[e.name]?.success).map(e => e.name),
            expertsFailed: failedExperts,
            totalExperts: allExperts.length,
            successfulExperts: totalSuccess,
            wasResume: isResume,
          },
        },
      });
    } catch (error) {
      console.error('[DeepScan Stream] Error:', error);

      const errorMsg = error instanceof Error ? error.message : 'DeepScan failed';
      await saveError(id, errorMsg, 'phase2');
      await markDeepScanCompleted(id, false, errorMsg);

      emit({
        type: AgentEventType.ERROR,
        data: {
          message: errorMsg,
          code: 'DEEP_SCAN_ERROR',
        },
      });
    } finally {
      clearTimeout(globalTimeout);
    }
  });

  return createSSEResponse(stream);
}
