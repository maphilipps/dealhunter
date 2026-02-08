// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT SCAN ORCHESTRATOR
// DAG-based dependency resolution with parallel phase execution
// Supports both static (legacy) and dynamic (planner-based) execution
// ═══════════════════════════════════════════════════════════════════════════════

import { and, eq } from 'drizzle-orm';

import { CAPABILITY_MAP, type Capability } from './capabilities';
import { PHASE_DEFINITIONS, TOTAL_PHASE_COUNT } from './constants';
import { generateNavigation, type GeneratedNavigation } from './navigation';
import { PHASE_AGENT_REGISTRY } from './phases';
import { createAnalysisPlan, createFullPlan, type PlanningContext } from './planner';
import type { PitchScanSectionId } from './section-ids';
import type { PhaseContext, PhaseResult, PitchScanCheckpoint, PhasePlan } from './types';

import { db } from '@/lib/db';
import { dealEmbeddings, auditScanRuns } from '@/lib/db/schema';
import { markAgentComplete, markAgentFailed, updateRunStatus } from '@/lib/pitch/checkpoints';
import { publishToChannel } from '@/lib/pitch/tools/progress-tool';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';

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

  // Emit a static plan summary for chat-first UIs (legacy orchestrator runs all phases).
  await publishToChannel(runId, {
    type: 'plan_created',
    enabledPhases: PHASE_DEFINITIONS.map(p => ({
      id: p.id,
      label: p.label,
      category: CAPABILITY_MAP.get(p.id)?.category ?? 'technical',
      dependencies: p.dependencies,
    })),
    skippedPhases: [],
    summaryText: 'Analyse-Plan erstellt. Starte Ausfuehrung der Phasen...',
    timestamp: new Date().toISOString(),
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
          throw lastError ?? new Error('Unknown error');
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

          // Chat-first: emit a compact section result (full content is fetched from DB on demand).
          await publishToChannel(runId, {
            type: 'section_result',
            sectionId: phase.id,
            label: phase.label,
            status: 'completed',
            confidence: phaseResult.confidence,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Extract phase info from the error context
          const failedPhase = readyPhases[results.indexOf(result)];
          if (failedPhase) {
            failedPhases.add(failedPhase.id);
            await markAgentFailed(runId, failedPhase.id);

            await publishToChannel(runId, {
              type: 'section_result',
              sectionId: failedPhase.id,
              label: failedPhase.label,
              status: 'failed',
              error: String(result.reason),
              timestamp: new Date().toISOString(),
            });

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

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC ORCHESTRATOR
// Planner-based phase selection with capability pool
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Dynamic Orchestrator Options ───────────────────────────────────────────────

export interface DynamicOrchestratorOptions {
  runId: string;
  pitchId: string;
  websiteUrl?: string;
  targetCmsIds: string[];

  /** Planning context for the LLM planner */
  planningContext: PlanningContext;

  /** Optional: Skip planning and use provided plan */
  providedPlan?: PhasePlan;

  /** Resume from checkpoint */
  checkpoint?: PitchScanCheckpoint;
}

export interface DynamicOrchestratorResult {
  plan: PhasePlan;
  results: Record<string, PhaseResult>;
  completedPhases: string[];
  failedPhases: string[];
  navigation: GeneratedNavigation;
}

// ─── Dynamic Orchestrator ───────────────────────────────────────────────────────

/**
 * Dynamic orchestrator that uses an LLM planner to select which phases to run.
 * This is the new preferred way to run pitch scans.
 */
export async function runDynamicOrchestrator(
  options: DynamicOrchestratorOptions,
  emit: EventEmitter
): Promise<DynamicOrchestratorResult> {
  const { runId, pitchId, websiteUrl, targetCmsIds, planningContext, checkpoint } = options;

  // ─── Step 1: Get or create plan ─────────────────────────────────────────────

  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Dynamic Orchestrator',
      message: checkpoint ? 'Wiederaufnahme...' : 'Erstelle Analyse-Plan...',
    },
  });

  let plan: PhasePlan;

  if (checkpoint?.plan) {
    // Resume with existing plan
    plan = checkpoint.plan;
  } else if (options.providedPlan) {
    // Use provided plan (e.g., for legacy mode)
    plan = options.providedPlan;
  } else {
    // Create plan via LLM
    plan = await createAnalysisPlan(planningContext);
  }

  await publishToChannel(runId, {
    type: 'plan_created',
    enabledPhases: plan.enabledPhases.map(p => {
      const cap = CAPABILITY_MAP.get(p.id);
      return {
        id: p.id,
        label: cap?.labelDe ?? p.id,
        category: cap?.category ?? 'technical',
        priority: p.priority,
        rationale: p.rationale,
      };
    }),
    skippedPhases: plan.skippedPhases,
    summaryText: `Analyse-Plan erstellt: ${plan.enabledPhases.length} Phasen`,
    timestamp: new Date().toISOString(),
  });

  const totalPhases = plan.enabledPhases.length;

  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Dynamic Orchestrator',
      message: `Plan erstellt: ${totalPhases} Phasen, ${plan.skippedPhases.length} übersprungen`,
    },
  });

  // ─── Step 2: Build execution graph ──────────────────────────────────────────

  // Get capabilities for enabled phases
  const enabledCapabilities: Capability[] = plan.enabledPhases
    .map(p => CAPABILITY_MAP.get(p.id))
    .filter((c): c is Capability => c !== undefined);

  // Include custom phases if any
  const customCapabilities: Capability[] = (plan.customPhases ?? []).map(cp => ({
    id: cp.id,
    label: cp.label,
    labelDe: cp.labelDe,
    category: cp.category,
    description: cp.description,
    modelSlot: 'quality' as const,
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: cp.dependencies,
    relevance: {},
  }));

  const allCapabilities = [...enabledCapabilities, ...customCapabilities];

  // ─── Step 3: DAG execution ──────────────────────────────────────────────────

  const completedPhases = new Set<string>(checkpoint?.completedPhases ?? []);
  const failedPhases = new Set<string>();
  const phaseResults: Record<string, PhaseResult> = checkpoint?.phaseResults ?? {};

  await updateRunStatus(runId, 'running', {
    progress: Math.round((completedPhases.size / totalPhases) * 100),
    currentStep: 'Phasen werden ausgeführt...',
  });

  while (completedPhases.size + failedPhases.size < allCapabilities.length) {
    // Find phases whose dependencies are all completed
    const readyPhases = allCapabilities.filter(
      cap =>
        !completedPhases.has(cap.id) &&
        !failedPhases.has(cap.id) &&
        cap.dependencies.every(dep => completedPhases.has(dep))
    );

    if (readyPhases.length === 0) {
      // No phases ready — all remaining are blocked by failed dependencies
      break;
    }

    // Execute ready phases in parallel
    const results = await Promise.allSettled(
      readyPhases.map(async cap => {
        // Publish phase start
        await publishToChannel(runId, {
          type: 'phase_start',
          phase: cap.id,
          label: cap.labelDe,
          progress: Math.round((completedPhases.size / totalPhases) * 100),
          message: `${cap.labelDe} wird analysiert...`,
          timestamp: new Date().toISOString(),
        });

        // Build context
        const context: PhaseContext = {
          runId,
          pitchId,
          websiteUrl: websiteUrl ?? '',
          previousResults: Object.fromEntries(
            Object.entries(phaseResults).map(([k, v]) => [k, v.content])
          ),
          targetCmsIds,
        };

        // Execute the phase
        const result = await executeCapability(cap, context, emit);
        return { cap, result };
      })
    );

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { cap, result: phaseResult } = result.value;
        phaseResults[cap.id] = phaseResult;
        completedPhases.add(cap.id);

        // Mark complete in DB
        await markAgentComplete(runId, cap.id, phaseResult.confidence);

        // Store result
        await storePhaseResultDynamic(pitchId, cap.id, phaseResult);

        // Update progress
        const progress = Math.round((completedPhases.size / totalPhases) * 100);
        await updateRunStatus(runId, 'running', {
          progress,
          currentStep: `${completedPhases.size}/${totalPhases} Phasen abgeschlossen`,
        });

        await publishToChannel(runId, {
          type: 'agent_complete',
          phase: cap.id,
          label: cap.labelDe,
          confidence: phaseResult.confidence,
          progress,
          message: `${cap.labelDe} abgeschlossen (${phaseResult.confidence}%)`,
          timestamp: new Date().toISOString(),
        });

        await publishToChannel(runId, {
          type: 'section_result',
          sectionId: cap.id,
          label: cap.labelDe,
          status: 'completed',
          confidence: phaseResult.confidence,
          timestamp: new Date().toISOString(),
        });
      } else {
        const failedCap = readyPhases[results.indexOf(result)];
        if (failedCap) {
          failedPhases.add(failedCap.id);
          await markAgentFailed(runId, failedCap.id);

          await publishToChannel(runId, {
            type: 'section_result',
            sectionId: failedCap.id,
            label: failedCap.labelDe,
            status: 'failed',
            error: String(result.reason),
            timestamp: new Date().toISOString(),
          });

          emit({
            type: AgentEventType.ERROR,
            data: {
              message: `${failedCap.labelDe} fehlgeschlagen: ${result.reason}`,
              code: 'PHASE_AGENT_ERROR',
            },
          });
        }
      }
    }

    // Save checkpoint after each wave
    await saveDynamicCheckpoint(runId, plan, completedPhases, phaseResults);
  }

  // ─── Step 4: Generate navigation ────────────────────────────────────────────

  const navigation = generateNavigation(plan, phaseResults);

  // ─── Step 5: Complete the run ───────────────────────────────────────────────

  const allCompleted = completedPhases.size === totalPhases;

  await updateRunStatus(runId, allCompleted ? 'completed' : 'completed', {
    progress: 100,
    currentStep: allCompleted
      ? 'Alle Phasen erfolgreich abgeschlossen'
      : `${completedPhases.size}/${totalPhases} Phasen abgeschlossen, ${failedPhases.size} fehlgeschlagen`,
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
      agent: 'Dynamic Orchestrator',
      result: {
        plan,
        completedPhases: Array.from(completedPhases),
        failedPhases: Array.from(failedPhases),
        navigation,
      },
    },
  });

  return {
    plan,
    results: phaseResults,
    completedPhases: Array.from(completedPhases),
    failedPhases: Array.from(failedPhases),
    navigation,
  };
}

// ─── Dynamic Helpers ────────────────────────────────────────────────────────────

async function executeCapability(
  capability: Capability,
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  const maxRetries = capability.maxRetries;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // For built-in phases, use registry
      const agentFn = PHASE_AGENT_REGISTRY[capability.id as keyof typeof PHASE_AGENT_REGISTRY];
      if (agentFn) {
        return await agentFn(context, emit);
      }

      // For custom phases, return a placeholder (to be implemented)
      return {
        sectionId: capability.id,
        label: capability.labelDe,
        category: capability.category,
        content: { message: 'Custom phase execution not yet implemented' },
        confidence: 0,
        sources: [],
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: {
            agent: capability.labelDe,
            message: `Retry ${attempt + 1}/${maxRetries}...`,
            details: lastError.message,
          },
        });
      }
    }
  }

  throw lastError ?? new Error('Unknown error');
}

async function storePhaseResultDynamic(
  pitchId: string,
  sectionId: string,
  result: PhaseResult
): Promise<void> {
  // Delete existing results for this section
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
      label: result.label,
      category: result.category,
      sources: result.sources ?? [],
      visualizationTree: result.content,
    }),
  });
}

async function saveDynamicCheckpoint(
  runId: string,
  plan: PhasePlan,
  completedPhases: Set<string>,
  phaseResults: Record<string, PhaseResult>
): Promise<void> {
  const checkpoint: PitchScanCheckpoint = {
    runId,
    plan,
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

// ─── Legacy Wrapper ─────────────────────────────────────────────────────────────

/**
 * Runs the dynamic orchestrator in legacy mode (all 13 phases).
 * This is for backward compatibility with existing code.
 */
export async function runPitchScanOrchestratorDynamic(
  options: PitchScanOrchestratorOptions,
  emit: EventEmitter
): Promise<DynamicOrchestratorResult> {
  // Build planning context from legacy options
  const planningContext: PlanningContext = {
    websiteUrl: options.websiteUrl,
    targetCms: options.targetCmsIds,
    timeConstraint: 'standard',
  };

  // Force all phases (legacy behavior)
  const providedPlan = createFullPlan();

  return runDynamicOrchestrator(
    {
      runId: options.runId,
      pitchId: options.pitchId,
      websiteUrl: options.websiteUrl,
      targetCmsIds: options.targetCmsIds,
      planningContext,
      providedPlan,
      checkpoint: options.checkpoint,
    },
    emit
  );
}
