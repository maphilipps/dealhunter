// ═══════════════════════════════════════════════════════════════════════════════
// TOOL WRAPPER - QuickScan 2.0 Refactoring
// Wraps step functions with automatic event emission, timing, and error handling
// ═══════════════════════════════════════════════════════════════════════════════

import type { ToolConfig, WorkflowContext, WorkflowStep, StepFunction } from './types';

import { AgentEventType } from '@/lib/streaming/event-types';

/**
 * Wraps a step function with automatic:
 * - STEP_START event emission
 * - STEP_COMPLETE event emission (success or failure)
 * - AGENT_COMPLETE event for backwards compatibility
 * - Timing tracking
 * - Error handling with optional flag support
 *
 * @example
 * ```ts
 * export const fetchWebsiteStep = wrapTool(
 *   {
 *     name: 'fetchWebsite',
 *     displayName: 'Website Crawler',
 *     phase: 'bootstrap',
 *     timeout: 30000,
 *   },
 *   async (input, ctx) => {
 *     const data = await fetchWebsiteData(input.url);
 *     return data;
 *   }
 * );
 * ```
 */
export function wrapTool<TInput, TOutput>(
  config: ToolConfig,
  fn: StepFunction<TInput, TOutput>
): WorkflowStep<TInput, TOutput> {
  return {
    config: {
      ...config,
      optional: config.optional ?? false,
      timeout: config.timeout ?? 60000,
      dependencies: config.dependencies ?? [],
    },

    async execute(input: TInput, ctx: WorkflowContext): Promise<TOutput> {
      const startTime = Date.now();

      // Emit STEP_START event
      ctx.emit({
        type: AgentEventType.STEP_START,
        data: {
          stepId: config.name,
          stepName: config.displayName,
          phase: config.phase,
          timestamp: startTime,
          dependencies: config.dependencies,
          optional: config.optional,
        },
      });

      try {
        // Execute with timeout - wrap in Promise.resolve to handle both sync and async functions
        const result = await executeWithTimeout(
          Promise.resolve(fn(input, ctx)),
          config.timeout ?? 60000,
          config.name
        );

        const duration = Date.now() - startTime;

        // Emit STEP_COMPLETE event (success)
        ctx.emit({
          type: AgentEventType.STEP_COMPLETE,
          data: {
            stepId: config.name,
            stepName: config.displayName,
            phase: config.phase,
            success: true,
            duration,
            result,
          },
        });

        // Backwards compatibility: Emit AGENT_COMPLETE
        ctx.emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: config.displayName,
            result,
          },
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Emit STEP_COMPLETE event (failure)
        ctx.emit({
          type: AgentEventType.STEP_COMPLETE,
          data: {
            stepId: config.name,
            stepName: config.displayName,
            phase: config.phase,
            success: false,
            duration,
            error: errorMessage,
          },
        });

        // If optional, return undefined instead of throwing
        if (config.optional) {
          console.warn(`[Workflow] Optional step "${config.name}" failed: ${errorMessage}`);
          return undefined as TOutput;
        }

        throw error;
      }
    },
  };
}

/**
 * Execute a promise with a timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stepName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Step "${stepName}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Create a step that emits progress messages during execution
 * Useful for long-running steps that want to provide incremental updates
 */
export function wrapToolWithProgress<TInput, TOutput>(
  config: ToolConfig,
  fn: (
    input: TInput,
    ctx: WorkflowContext,
    onProgress: (message: string, details?: string) => void
  ) => Promise<TOutput>
): WorkflowStep<TInput, TOutput> {
  return wrapTool(config, async (input, ctx) => {
    const onProgress = (message: string, details?: string) => {
      ctx.emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: config.displayName,
          message,
          details,
        },
      });
    };

    return fn(input, ctx, onProgress);
  });
}

/**
 * Create a group of steps that run in parallel
 * Returns results as a record keyed by step name
 */
export function createParallelGroup<T extends Record<string, WorkflowStep>>(
  steps: T
): WorkflowStep<void, { [K in keyof T]: Awaited<ReturnType<T[K]['execute']>> | undefined }> {
  const stepEntries = Object.entries(steps) as [keyof T, WorkflowStep][];
  const names = stepEntries.map(([name]) => name).join(', ');

  return {
    config: {
      name: `parallel_${Object.keys(steps).join('_')}`,
      displayName: `Parallel: ${names}`,
      phase: stepEntries[0][1].config.phase,
      dependencies: [],
      optional: false,
    },

    async execute(_, ctx) {
      const results = await Promise.allSettled(
        stepEntries.map(async ([name, step]) => {
          const result = await step.execute(undefined, ctx);
          return [name, result] as const;
        })
      );

      const output = {} as { [K in keyof T]: Awaited<ReturnType<T[K]['execute']>> | undefined };

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const [name] = stepEntries[i];
        if (result.status === 'fulfilled') {
          const [, value] = result.value;
          output[name] = value as (typeof output)[typeof name];
        } else {
          output[name] = undefined as (typeof output)[typeof name];
        }
      }

      return output;
    },
  };
}
