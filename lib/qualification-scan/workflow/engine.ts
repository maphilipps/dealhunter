// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ENGINE - Qualification Scan 2.0 Refactoring
// Orchestrates step execution with dependency resolution and event streaming
// ═══════════════════════════════════════════════════════════════════════════════

import { resolveExecutionPlan, printExecutionPlan } from './dag-resolver';
import type {
  WorkflowEngineOptions,
  WorkflowExecutionResult,
  WorkflowContext,
  WorkflowStep,
  StepResult,
  StepRegistry,
  QualificationScanInput,
  RagWriteTools,
  FindingInput,
  VisualizationInput,
} from './types';

import {
  createRagWriteTool,
  createBatchRagWriteTool,
  createVisualizationWriteTool,
} from '@/lib/agent-tools';
import { generateQueryEmbedding } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { AgentEventType } from '@/lib/streaming/event-types';

/**
 * WorkflowEngine orchestrates the execution of workflow steps
 *
 * Features:
 * - DAG-based dependency resolution for maximum parallelization
 * - Automatic event emission for progress tracking
 * - Error handling with optional step support
 * - Context passing between steps
 *
 * @example
 * ```ts
 * const engine = new WorkflowEngine({
 *   steps: qualificationScanSteps,
 *   emit,
 * });
 *
 * const result = await engine.execute(input);
 * ```
 */
export class WorkflowEngine {
  private steps: StepRegistry;
  private emit: WorkflowEngineOptions['emit'];
  private contextSection?: string;
  private preQualificationId?: string;
  private ragTools?: RagWriteTools;

  constructor(options: WorkflowEngineOptions) {
    this.steps = options.steps;
    this.emit = options.emit;
    this.contextSection = options.contextSection;
    this.preQualificationId = options.preQualificationId;

    // Create RAG write tools if preQualificationId is provided
    if (this.preQualificationId) {
      const preQualId = this.preQualificationId;
      const agentName = 'lead_scan';

      // Create callable functions for direct invocation
      this.ragTools = {
        // Store a single finding
        storeFinding: async (input: FindingInput) => {
          const embedding = await generateQueryEmbedding(input.content);

          // Count existing chunks of this type
          const existingChunks = await db.query.dealEmbeddings.findMany({
            where: (de, { and, eq }) =>
              and(
                eq(de.preQualificationId, preQualId),
                eq(de.agentName, agentName),
                eq(de.chunkType, input.chunkType)
              ),
            columns: { chunkIndex: true },
          });

          const nextIndex =
            existingChunks.length > 0 ? Math.max(...existingChunks.map(c => c.chunkIndex)) + 1 : 0;

          await db.insert(dealEmbeddings).values({
            pitchId: null,
            preQualificationId: preQualId,
            agentName,
            chunkType: input.chunkType,
            chunkIndex: nextIndex,
            chunkCategory: input.category,
            content: input.content,
            confidence: input.confidence,
            requiresValidation: input.requiresValidation ?? false,
            embedding,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          });

          return {
            success: true,
            message: `Stored ${input.category} finding [${input.chunkType}#${nextIndex}]`,
          };
        },

        // Store a visualization
        storeVisualization: async (input: VisualizationInput) => {
          await db.insert(dealEmbeddings).values({
            pitchId: null,
            preQualificationId: preQualId,
            agentName,
            chunkType: 'visualization',
            chunkIndex: 0,
            chunkCategory: 'elaboration',
            content: JSON.stringify(input.visualization),
            confidence: input.confidence,
            embedding: null,
            metadata: JSON.stringify({
              sectionId: input.sectionId,
              isVisualization: true,
              elementCount: Object.keys(input.visualization.elements).length,
            }),
          });

          return {
            success: true,
            message: `Stored visualization for section "${input.sectionId}"`,
            sectionId: input.sectionId,
          };
        },

        // Batch store findings
        storeFindingsBatch: async (findings: FindingInput[]) => {
          const embeddings = await Promise.all(
            findings.map(f => generateQueryEmbedding(f.content))
          );

          // Get current indices
          const existingChunks = await db.query.dealEmbeddings.findMany({
            where: (de, { and, eq }) =>
              and(eq(de.preQualificationId, preQualId), eq(de.agentName, agentName)),
            columns: { chunkType: true, chunkIndex: true },
          });

          const indexMap = new Map<string, number>();
          for (const chunk of existingChunks) {
            const current = indexMap.get(chunk.chunkType) ?? -1;
            if (chunk.chunkIndex > current) {
              indexMap.set(chunk.chunkType, chunk.chunkIndex);
            }
          }

          const values = findings.map((finding, i) => {
            const currentMax = indexMap.get(finding.chunkType) ?? -1;
            const newIndex = currentMax + 1;
            indexMap.set(finding.chunkType, newIndex);

            return {
              pitchId: null,
              preQualificationId: preQualId,
              agentName,
              chunkType: finding.chunkType,
              chunkIndex: newIndex,
              chunkCategory: finding.category,
              content: finding.content,
              confidence: finding.confidence,
              requiresValidation: finding.requiresValidation ?? false,
              embedding: embeddings[i],
              metadata: finding.metadata ? JSON.stringify(finding.metadata) : null,
            };
          });

          await db.insert(dealEmbeddings).values(values);

          return {
            success: true,
            message: `Stored ${findings.length} findings`,
            storedCount: findings.length,
          };
        },

        // AI SDK tools for LLM use
        aiTools: {
          storeFinding: createRagWriteTool({ preQualificationId: preQualId, agentName }),
          storeVisualization: createVisualizationWriteTool({
            preQualificationId: preQualId,
            agentName,
          }),
          storeFindingsBatch: createBatchRagWriteTool({ preQualificationId: preQualId, agentName }),
        },
      };
    }
  }

  /**
   * Execute the workflow
   */
  async execute(input: QualificationScanInput, fullUrl: string): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const results = new Map<string, StepResult>();
    const errors: Array<{ stepId: string; error: string }> = [];

    // Resolve execution plan
    const plan = resolveExecutionPlan(this.steps);
    // Debug: Uncomment to see execution plan
    // console.warn('[WorkflowEngine] Execution plan:', printExecutionPlan(plan));
    void printExecutionPlan(plan); // Validate plan is generated correctly

    // Create workflow context
    const ctx = this.createContext(input, fullUrl, results);

    // Track step states
    const completedSteps = new Set<string>();
    const runningSteps = new Set<string>();
    let currentPhase = plan.waves[0]?.[0]
      ? this.steps.get(plan.waves[0][0])?.config.phase
      : undefined;

    // Execute waves
    for (let waveIndex = 0; waveIndex < plan.waves.length; waveIndex++) {
      const wave = plan.waves[waveIndex];

      // Determine phase for this wave
      const wavePhase = this.steps.get(wave[0])?.config.phase;
      if (wavePhase && wavePhase !== currentPhase) {
        currentPhase = wavePhase;
        this.emit({
          type: AgentEventType.PHASE_START,
          data: {
            phase: currentPhase,
            message: this.getPhaseMessage(currentPhase),
            timestamp: Date.now(),
          },
        });
      }

      // Mark steps as running
      for (const stepId of wave) {
        runningSteps.add(stepId);
      }

      // Emit workflow progress
      this.emitWorkflowProgress(currentPhase!, completedSteps.size, plan.totalSteps, wave);

      // Execute all steps in wave in parallel
      const waveResults = await Promise.allSettled(
        wave.map(async stepId => {
          const step = this.steps.get(stepId);
          if (!step) {
            throw new Error(`Step "${stepId}" not found in registry`);
          }

          try {
            const stepStart = Date.now();
            const stepTimeout = step.config.timeout ?? 60_000; // 60s default

            this.emit({
              type: AgentEventType.STEP_START,
              data: {
                stepId,
                stepName: step.config.displayName,
                phase: step.config.phase,
                timestamp: stepStart,
                dependencies: step.config.dependencies,
                optional: step.config.optional,
              },
            });

            // Get input for this step from dependencies
            const stepInput = this.getStepInput(stepId, results);

            // Execute step with timeout enforcement
            const output = await this.executeStepWithTimeout(step, stepInput, ctx, stepTimeout);
            const duration = Date.now() - stepStart;

            this.emit({
              type: AgentEventType.STEP_COMPLETE,
              data: {
                stepId,
                stepName: step.config.displayName,
                phase: step.config.phase,
                success: true,
                duration,
                result: output,
              },
            });

            return {
              stepId,
              success: true,
              output,
              duration,
            } as StepResult;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.emit({
              type: AgentEventType.STEP_COMPLETE,
              data: {
                stepId,
                stepName: step.config.displayName,
                phase: step.config.phase,
                success: false,
                duration: 0,
                error: errorMessage,
              },
            });
            return {
              stepId,
              success: false,
              error: errorMessage,
              duration: 0,
            } as StepResult;
          }
        })
      );

      // Process results
      for (let i = 0; i < wave.length; i++) {
        const stepId = wave[i];
        const result = waveResults[i];

        runningSteps.delete(stepId);

        if (result.status === 'fulfilled') {
          const stepResult = result.value;
          results.set(stepId, stepResult);
          completedSteps.add(stepId);

          if (!stepResult.success) {
            errors.push({ stepId, error: stepResult.error || 'Unknown error' });

            // Check if step is required
            const step = this.steps.get(stepId);
            if (!step?.config.optional) {
              console.error(
                `[WorkflowEngine] Required step "${stepId}" failed: ${stepResult.error}`
              );
              // Continue with other steps for now, check success at end
            }
          }
        } else {
          // Promise rejected
          const errorMessage =
            result.reason instanceof Error ? result.reason.message : 'Unknown error';
          results.set(stepId, {
            stepId,
            success: false,
            error: errorMessage,
            duration: 0,
          });
          completedSteps.add(stepId);
          errors.push({ stepId, error: errorMessage });
        }
      }

      // Emit progress after wave
      this.emitWorkflowProgress(currentPhase!, completedSteps.size, plan.totalSteps, []);
    }

    const duration = Date.now() - startTime;

    // Determine success (all required steps succeeded)
    const requiredStepsSucceeded = Array.from(this.steps.entries())
      .filter(([, step]) => !step.config.optional)
      .every(([stepId]) => {
        const result = results.get(stepId);
        return result?.success === true;
      });

    return {
      results,
      duration,
      success: requiredStepsSucceeded,
      errors,
    };
  }

  /**
   * Create workflow context
   */
  private createContext(
    input: QualificationScanInput,
    fullUrl: string,
    results: Map<string, StepResult>
  ): WorkflowContext {
    return {
      input,
      emit: this.emit,
      results,
      fullUrl,
      contextSection: this.contextSection,
      ragTools: this.ragTools,
      getResult<T>(stepId: string): T | undefined {
        const result = results.get(stepId);
        return result?.success ? (result.output as T) : undefined;
      },
    };
  }

  /**
   * Get input for a step based on its dependencies
   */
  private getStepInput(stepId: string, results: Map<string, StepResult>): unknown {
    const step = this.steps.get(stepId);
    if (!step) return undefined;

    const deps = step.config.dependencies ?? [];

    if (deps.length === 0) {
      // No dependencies, return undefined (step should use ctx.input)
      return undefined;
    }

    if (deps.length === 1) {
      // Single dependency, return its output directly
      const depResult = results.get(deps[0]);
      return depResult?.success ? depResult.output : undefined;
    }

    // Multiple dependencies, return object keyed by step ID
    const input: Record<string, unknown> = {};
    for (const depId of deps) {
      const depResult = results.get(depId);
      input[depId] = depResult?.success ? depResult.output : undefined;
    }
    return input;
  }

  /**
   * Emit workflow progress event
   */
  private emitWorkflowProgress(
    phase: NonNullable<ReturnType<typeof this.steps.get>>['config']['phase'],
    completedSteps: number,
    totalSteps: number,
    currentSteps: string[]
  ): void {
    this.emit({
      type: AgentEventType.WORKFLOW_PROGRESS,
      data: {
        phase,
        completedSteps,
        totalSteps,
        currentSteps,
        percentage: Math.round((completedSteps / totalSteps) * 100),
      },
    });
  }

  /**
   * Get human-readable message for phase
   */
  private getPhaseMessage(phase: string): string {
    switch (phase) {
      case 'bootstrap':
        return 'Initialisiere Scan - lade Website und Business Units...';
      case 'multi_page':
        return 'Lade und analysiere mehrere Seiten...';
      case 'analysis':
        return 'Führe alle Analysen parallel aus...';
      case 'synthesis':
        return 'Erstelle Business Line Empfehlung...';
      default:
        return `Phase: ${phase}`;
    }
  }

  /**
   * Execute a step with timeout enforcement
   * Wraps step execution in Promise.race to enforce timeout
   */
  private async executeStepWithTimeout<T>(
    step: WorkflowStep,
    input: unknown,
    ctx: WorkflowContext,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      step.execute(input, ctx) as Promise<T>,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Step "${step.config.displayName}" timeout after ${Math.round(timeoutMs / 1000)}s`
              )
            ),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Execute a single step with cached results from previous runs.
   * Used for re-scanning individual steps without re-running the entire workflow.
   */
  async executeSingleStep(
    stepId: string,
    input: QualificationScanInput,
    fullUrl: string,
    cachedResults: Map<string, StepResult>
  ): Promise<StepResult> {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new Error(`Step "${stepId}" not found in registry`);
    }

    // Verify all dependencies have cached results
    const deps = step.config.dependencies ?? [];
    for (const depId of deps) {
      const cached = cachedResults.get(depId);
      if (!cached?.success) {
        throw new Error(`Missing cached result for dependency "${depId}" of step "${stepId}"`);
      }
    }

    // Create context with cached results
    const ctx = this.createContext(input, fullUrl, cachedResults);

    const stepStart = Date.now();
    const stepTimeout = step.config.timeout ?? 60_000;

    this.emit({
      type: AgentEventType.STEP_START,
      data: {
        stepId,
        stepName: step.config.displayName,
        phase: step.config.phase,
        timestamp: stepStart,
        dependencies: step.config.dependencies,
        optional: step.config.optional,
      },
    });

    try {
      const stepInput = this.getStepInput(stepId, cachedResults);
      const output = await this.executeStepWithTimeout(step, stepInput, ctx, stepTimeout);
      const duration = Date.now() - stepStart;

      this.emit({
        type: AgentEventType.STEP_COMPLETE,
        data: {
          stepId,
          stepName: step.config.displayName,
          phase: step.config.phase,
          success: true,
          duration,
          result: output,
        },
      });

      return { stepId, success: true, output, duration };
    } catch (error) {
      const duration = Date.now() - stepStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit({
        type: AgentEventType.STEP_COMPLETE,
        data: {
          stepId,
          stepName: step.config.displayName,
          phase: step.config.phase,
          success: false,
          duration,
          error: errorMessage,
        },
      });

      return { stepId, success: false, error: errorMessage, duration };
    }
  }
}

/**
 * Factory function to create a workflow engine
 */
export function createWorkflowEngine(options: WorkflowEngineOptions): WorkflowEngine {
  return new WorkflowEngine(options);
}
