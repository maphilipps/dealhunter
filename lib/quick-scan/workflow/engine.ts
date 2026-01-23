// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ENGINE - QuickScan 2.0 Refactoring
// Orchestrates step execution with dependency resolution and event streaming
// ═══════════════════════════════════════════════════════════════════════════════

import { resolveExecutionPlan, printExecutionPlan } from './dag-resolver';
import type {
  WorkflowEngineOptions,
  WorkflowExecutionResult,
  WorkflowContext,
  StepResult,
  StepRegistry,
  QuickScanInput,
} from './types';

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
 *   steps: quickScanSteps,
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

  constructor(options: WorkflowEngineOptions) {
    this.steps = options.steps;
    this.emit = options.emit;
    this.contextSection = options.contextSection;
  }

  /**
   * Execute the workflow
   */
  async execute(input: QuickScanInput, fullUrl: string): Promise<WorkflowExecutionResult> {
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
            // Get input for this step from dependencies
            const stepInput = this.getStepInput(stepId, results);

            // Execute step
            const output = await step.execute(stepInput, ctx);

            return {
              stepId,
              success: true,
              output,
              duration: 0, // Duration tracked by step wrapper
            } as StepResult;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    input: QuickScanInput,
    fullUrl: string,
    results: Map<string, StepResult>
  ): WorkflowContext {
    return {
      input,
      emit: this.emit,
      results,
      fullUrl,
      contextSection: this.contextSection,
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
}

/**
 * Factory function to create a workflow engine
 */
export function createWorkflowEngine(options: WorkflowEngineOptions): WorkflowEngine {
  return new WorkflowEngine(options);
}
