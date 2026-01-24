/**
 * Sprint 4.2: Real-Time Event Streaming via SSE
 *
 * Provides Server-Sent Events (SSE) for real-time job progress updates.
 * Used for Deep Scan, Team Notifications, and other background jobs.
 */

import { db } from '@/lib/db';
import { backgroundJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Job Progress Event
 */
export interface JobProgressEvent {
  type: 'progress' | 'phase' | 'step' | 'complete' | 'error' | 'heartbeat';
  jobId: string;
  timestamp: string;
  data: {
    progress?: number; // 0-100
    phase?: string; // 'scraping' | 'phase2' | 'phase3'
    currentStep?: string;
    completedSteps?: string[];
    error?: string;
    result?: unknown;
  };
}

/**
 * Create SSE stream for job progress updates
 *
 * Usage:
 * ```typescript
 * const stream = createJobProgressStream(jobId);
 * return new Response(stream, {
 *   headers: {
 *     'Content-Type': 'text/event-stream',
 *     'Cache-Control': 'no-cache',
 *     'Connection': 'keep-alive',
 *   },
 * });
 * ```
 */
export function createJobProgressStream(jobId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let lastProgress = -1;
  let lastPhase = '';

  return new ReadableStream({
    async start(controller) {
      // Send initial connection event
      const connectEvent = formatSSE({
        type: 'heartbeat',
        jobId,
        timestamp: new Date().toISOString(),
        data: {},
      });
      controller.enqueue(encoder.encode(connectEvent));

      // Poll job status every 1 second
      intervalId = setInterval(async () => {
        try {
          const [job] = await db
            .select()
            .from(backgroundJobs)
            .where(eq(backgroundJobs.id, jobId))
            .limit(1);

          if (!job) {
            // Job not found - close stream
            const errorEvent = formatSSE({
              type: 'error',
              jobId,
              timestamp: new Date().toISOString(),
              data: { error: 'Job not found' },
            });
            controller.enqueue(encoder.encode(errorEvent));
            controller.close();
            if (intervalId) clearInterval(intervalId);
            return;
          }

          // Check for progress changes
          if (job.progress !== lastProgress) {
            lastProgress = job.progress;
            const progressEvent = formatSSE({
              type: 'progress',
              jobId,
              timestamp: new Date().toISOString(),
              data: {
                progress: job.progress,
                currentStep: job.currentStep || undefined,
              },
            });
            controller.enqueue(encoder.encode(progressEvent));
          }

          // Check for phase changes (Deep Scan specific)
          const result = job.result ? JSON.parse(job.result) : null;
          const currentPhase = result?.currentPhase || '';
          if (currentPhase && currentPhase !== lastPhase) {
            lastPhase = currentPhase;
            const phaseEvent = formatSSE({
              type: 'phase',
              jobId,
              timestamp: new Date().toISOString(),
              data: {
                phase: currentPhase,
                completedSteps: result?.completedSteps || [],
              },
            });
            controller.enqueue(encoder.encode(phaseEvent));
          }

          // Check for step changes
          if (job.currentStep) {
            const stepEvent = formatSSE({
              type: 'step',
              jobId,
              timestamp: new Date().toISOString(),
              data: {
                currentStep: job.currentStep,
                progress: job.progress,
              },
            });
            controller.enqueue(encoder.encode(stepEvent));
          }

          // Check for completion
          if (job.status === 'completed') {
            const completeEvent = formatSSE({
              type: 'complete',
              jobId,
              timestamp: new Date().toISOString(),
              data: {
                progress: 100,
                result: result,
              },
            });
            controller.enqueue(encoder.encode(completeEvent));
            controller.close();
            if (intervalId) clearInterval(intervalId);
            return;
          }

          // Check for errors
          if (job.status === 'failed' || job.status === 'cancelled') {
            const errorEvent = formatSSE({
              type: 'error',
              jobId,
              timestamp: new Date().toISOString(),
              data: {
                error: job.errorMessage || `Job ${job.status}`,
              },
            });
            controller.enqueue(encoder.encode(errorEvent));
            controller.close();
            if (intervalId) clearInterval(intervalId);
            return;
          }

          // Send heartbeat every 5th iteration (5 seconds)
          if (lastProgress % 5 === 0) {
            const heartbeatEvent = formatSSE({
              type: 'heartbeat',
              jobId,
              timestamp: new Date().toISOString(),
              data: { progress: job.progress },
            });
            controller.enqueue(encoder.encode(heartbeatEvent));
          }
        } catch (error) {
          console.error('SSE polling error:', error);
          const errorEvent = formatSSE({
            type: 'error',
            jobId,
            timestamp: new Date().toISOString(),
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          controller.enqueue(encoder.encode(errorEvent));
          controller.close();
          if (intervalId) clearInterval(intervalId);
        }
      }, 1000); // Poll every 1 second
    },

    cancel() {
      // Client disconnected - cleanup
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });
}

/**
 * Format event for SSE protocol
 *
 * SSE Format:
 * event: <type>\n
 * data: <json>\n
 * id: <optional>\n
 * \n
 */
function formatSSE(event: JobProgressEvent): string {
  const lines: string[] = [];

  // Event type
  lines.push(`event: ${event.type}`);

  // Data (JSON)
  lines.push(`data: ${JSON.stringify(event.data)}`);

  // Optional ID (for reconnection)
  lines.push(`id: ${event.timestamp}`);

  // Empty line to signal end of event
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Emit job progress update
 * Called from background job to update progress in DB
 *
 * Usage in orchestrator:
 * ```typescript
 * await emitJobProgress(jobId, {
 *   progress: 50,
 *   currentStep: 'Analyzing technology stack',
 * });
 * ```
 */
export async function emitJobProgress(
  jobId: string,
  update: {
    progress?: number;
    currentStep?: string;
    result?: unknown;
    error?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  }
): Promise<void> {
  const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).limit(1);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  // Update job in database
  await db
    .update(backgroundJobs)
    .set({
      progress: update.progress ?? job.progress,
      currentStep: update.currentStep ?? job.currentStep,
      result: update.result ? JSON.stringify(update.result) : job.result,
      errorMessage: update.error ?? job.errorMessage,
      status: update.status ?? job.status,
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, jobId));

  // SSE clients will pick up changes via polling
  // (no need for in-memory event emitter in serverless environment)
}

/**
 * Create multiple job streams (for monitoring dashboard)
 */
export function createMultiJobStream(jobIds: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  const lastProgress = new Map<string, number>();

  return new ReadableStream({
    async start(controller) {
      intervalId = setInterval(async () => {
        try {
          // Fetch all jobs in parallel
          const jobs = await Promise.all(
            jobIds.map(jobId =>
              db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).limit(1)
            )
          );

          for (const [job] of jobs) {
            if (!job) continue;

            const lastProg = lastProgress.get(job.id) ?? -1;
            if (job.progress !== lastProg) {
              lastProgress.set(job.id, job.progress);

              const event = formatSSE({
                type: 'progress',
                jobId: job.id,
                timestamp: new Date().toISOString(),
                data: {
                  progress: job.progress,
                  currentStep: job.currentStep || undefined,
                },
              });
              controller.enqueue(encoder.encode(event));
            }

            // Check for completion
            if (job.status === 'completed' || job.status === 'failed') {
              const event = formatSSE({
                type: job.status === 'completed' ? 'complete' : 'error',
                jobId: job.id,
                timestamp: new Date().toISOString(),
                data: {
                  progress: job.progress,
                  error: job.errorMessage || undefined,
                },
              });
              controller.enqueue(encoder.encode(event));
            }
          }
        } catch (error) {
          console.error('Multi-job SSE error:', error);
        }
      }, 2000); // Poll every 2 seconds (lighter load for multiple jobs)
    },

    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
  });
}
