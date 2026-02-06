// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT SCAN ORCHESTRATOR
// DAG-based dependency resolution with parallel phase execution
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and } from 'drizzle-orm';

import { PHASE_DEFINITIONS, TOTAL_PHASE_COUNT } from './constants';
import { PHASE_AGENT_REGISTRY } from './phases';
import type { PitchScanSectionId } from './section-ids';
import type { PhaseContext, PhaseResult, PitchScanCheckpoint } from './types';

import { db } from '@/lib/db';
import { dealEmbeddings, auditScanRuns } from '@/lib/db/schema';
import { markAgentComplete, markAgentFailed, updateRunStatus } from '@/lib/pitch/checkpoints';
import { publishToChannel } from '@/lib/pitch/tools/progress-tool';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// ─── Orchestrator Options ───────────────────────────────────────────────────

export interface PitchScanOrchestratorOptions {
  runId: string;
  pitchId: string;
  websiteUrl: string;
  targetCmsIds: string[];
  checkpoint?: PitchScanCheckpoint;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function runPitchScanOrchestrator(
  options: PitchScanOrchestratorOptions,
  emit: EventEmitter
): Promise<void> {
  const { runId, pitchId, websiteUrl, targetCmsIds, checkpoint } = options;

  // Phase results accumulator (restore from checkpoint if resuming)
  const phaseResults: Record<string, PhaseResult> = checkpoint?.phaseResults ?? {};
  const completedPhases = new Set<PitchScanSectionId>(checkpoint?.completedPhases ?? []);
  const failedPhases = new Set<PitchScanSectionId>();

  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Pitch Scan Orchestrator',
      message: checkpoint
        ? `Wiederaufnahme bei ${completedPhases.size}/${TOTAL_PHASE_COUNT} Phasen`
        : 'Starte Pitch Scan Analyse...',
    },
  });

  // Update run status to running
  await updateRunStatus(runId, 'running', {
    progress: Math.round((completedPhases.size / TOTAL_PHASE_COUNT) * 100),
    currentStep: 'Phasen werden ausgeführt...',
  });

  try {
    // Execute phases via DAG resolution until all are complete
    while (completedPhases.size + failedPhases.size < TOTAL_PHASE_COUNT) {
      // Find phases whose dependencies are all completed
      const readyPhases = PHASE_DEFINITIONS.filter(
        phase =>
          !completedPhases.has(phase.id) &&
          !failedPhases.has(phase.id) &&
          phase.dependencies.every(dep => completedPhases.has(dep))
      );

      if (readyPhases.length === 0) {
        // No phases ready — all remaining are blocked by failed dependencies
        break;
      }

      // Execute all ready phases in parallel
      const results = await Promise.allSettled(
        readyPhases.map(async phase => {
          const agentFn = PHASE_AGENT_REGISTRY[phase.id];

          // Publish phase start
          await publishToChannel(runId, {
            type: 'phase_start',
            phase: phase.id,
            label: phase.label,
            progress: Math.round((completedPhases.size / TOTAL_PHASE_COUNT) * 100),
            message: `${phase.label} wird analysiert...`,
            timestamp: new Date().toISOString(),
          });

          // Build context with all previous results
          const context: PhaseContext = {
            runId,
            pitchId,
            websiteUrl,
            previousResults: Object.fromEntries(
              Object.entries(phaseResults).map(([k, v]) => [k, v.content])
            ),
            targetCmsIds,
          };

          // Run the phase agent with retry support
          const maxRetries = 2;
          let lastError: Error | null = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await agentFn(context, emit);
              return { phase, result };
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              if (attempt < maxRetries) {
                emit({
                  type: AgentEventType.AGENT_PROGRESS,
                  data: {
                    agent: phase.label,
                    message: `Retry ${attempt + 1}/${maxRetries}...`,
                    details: lastError.message,
                  },
                });
              }
            }
          }
          throw lastError;
        })
      );

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { phase, result: phaseResult } = result.value;
          phaseResults[phase.id] = phaseResult;
          completedPhases.add(phase.id);

          // Mark complete atomically in DB
          await markAgentComplete(runId, phase.id, phaseResult.confidence);

          // Store result in deal_embeddings
          await storePhaseResult(pitchId, phase.id, phaseResult);

          // Update progress
          const progress = Math.round((completedPhases.size / TOTAL_PHASE_COUNT) * 100);
          await updateRunStatus(runId, 'running', {
            progress,
            currentStep: `${completedPhases.size}/${TOTAL_PHASE_COUNT} Phasen abgeschlossen`,
          });

          await publishToChannel(runId, {
            type: 'agent_complete',
            phase: phase.id,
            label: phase.label,
            confidence: phaseResult.confidence,
            progress,
            message: `${phase.label} abgeschlossen (${phaseResult.confidence}%)`,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Extract phase info from the error context
          const failedPhase = readyPhases[results.indexOf(result)];
          if (failedPhase) {
            failedPhases.add(failedPhase.id);
            await markAgentFailed(runId, failedPhase.id);

            emit({
              type: AgentEventType.ERROR,
              data: {
                message: `${failedPhase.label} fehlgeschlagen: ${result.reason}`,
                code: 'PHASE_AGENT_ERROR',
              },
            });
          }
        }
      }

      // Save checkpoint after each wave
      await saveOrchestratorCheckpoint(runId, completedPhases, phaseResults);
    }

    // All phases done — complete the run
    const allCompleted = completedPhases.size === TOTAL_PHASE_COUNT;

    await updateRunStatus(runId, allCompleted ? 'completed' : 'completed', {
      progress: 100,
      currentStep: allCompleted
        ? 'Alle Phasen erfolgreich abgeschlossen'
        : `${completedPhases.size}/${TOTAL_PHASE_COUNT} Phasen abgeschlossen, ${failedPhases.size} fehlgeschlagen`,
      completedAt: new Date(),
    });

    await publishToChannel(runId, {
      type: 'complete',
      progress: 100,
      message: allCompleted
        ? 'Pitch Scan abgeschlossen'
        : `Pitch Scan teilweise abgeschlossen (${failedPhases.size} Fehler)`,
      completedPhases: Array.from(completedPhases),
      failedPhases: Array.from(failedPhases),
      timestamp: new Date().toISOString(),
    });

    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Pitch Scan Orchestrator',
        result: {
          completedPhases: Array.from(completedPhases),
          failedPhases: Array.from(failedPhases),
        },
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';

    await updateRunStatus(runId, 'failed', {
      progress: Math.round((completedPhases.size / TOTAL_PHASE_COUNT) * 100),
      currentStep: `Fehler: ${errorMsg}`,
    });

    await publishToChannel(runId, {
      type: 'error',
      message: errorMsg,
      timestamp: new Date().toISOString(),
    });

    emit({
      type: AgentEventType.ERROR,
      data: { message: errorMsg, code: 'ORCHESTRATOR_ERROR' },
    });

    throw error;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function storePhaseResult(
  pitchId: string,
  sectionId: PitchScanSectionId,
  result: PhaseResult
): Promise<void> {
  // Delete existing results for this section (idempotent re-run)
  await db
    .delete(dealEmbeddings)
    .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, sectionId)));

  const contentStr =
    typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

  await db.insert(dealEmbeddings).values({
    pitchId,
    preQualificationId: null,
    agentName: sectionId,
    chunkType: 'pitch_scan_section',
    chunkIndex: 0,
    chunkCategory: 'elaboration',
    content: contentStr,
    confidence: result.confidence,
    metadata: JSON.stringify({
      sectionId,
      sources: result.sources ?? [],
      visualizationTree: result.content,
    }),
  });
}

async function saveOrchestratorCheckpoint(
  runId: string,
  completedPhases: Set<PitchScanSectionId>,
  phaseResults: Record<string, PhaseResult>
): Promise<void> {
  const checkpoint: PitchScanCheckpoint = {
    runId,
    completedPhases: Array.from(completedPhases),
    phaseResults,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db
    .update(auditScanRuns)
    .set({
      snapshotData: JSON.stringify(checkpoint),
      updatedAt: new Date(),
    })
    .where(eq(auditScanRuns.id, runId));
}
