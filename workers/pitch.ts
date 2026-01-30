/**
 * BullMQ Pitch Worker
 *
 * Entry point for the background worker that processes pitch pipeline jobs.
 * Run with: npm run worker:pitch
 *
 * In production, this runs as a separate Docker container.
 */

import { Worker } from 'bullmq';

import { getConnectionOptions, closeConnection } from '@/lib/bullmq/connection';
import { QUEUE_NAMES, getPitchBackoffDelay, closeQueues } from '@/lib/bullmq/queues';
import { processPitchJob } from '@/lib/pitch/processor';

/**
 * Worker concurrency - how many jobs to process in parallel
 */
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

/**
 * Create and start the worker
 */
async function main() {
  console.log('[Pitch Worker] Starting...');
  console.log(`[Pitch Worker] Concurrency: ${WORKER_CONCURRENCY}`);

  const connectionOptions = getConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.PITCH,
    async job => {
      console.log(`[Pitch Worker] Processing job ${job.id}`);
      return processPitchJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: WORKER_CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return getPitchBackoffDelay(attemptsMade);
        },
      },
    }
  );

  // Event handlers
  worker.on('ready', () => {
    console.log('[Pitch Worker] Worker is ready and waiting for jobs');
  });

  worker.on('completed', (job, result) => {
    console.log(
      `[Pitch Worker] Job ${job.id} completed. Success: ${result.success}, ` +
        `Phase: ${result.phase}, Agents: ${result.completedAgents.length}/${result.completedAgents.length + result.failedAgents.length}`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[Pitch Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      error.message
    );
  });

  worker.on('error', error => {
    console.error('[Pitch Worker] Worker error:', error);
  });

  worker.on('stalled', jobId => {
    console.warn(`[Pitch Worker] Job ${jobId} stalled`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Pitch Worker] Received ${signal}, shutting down...`);

    try {
      await worker.close();
      console.log('[Pitch Worker] Worker closed');

      await closeQueues();

      await closeConnection();

      console.log('[Pitch Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[Pitch Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  console.log('[Pitch Worker] Worker started successfully');
}

main().catch(error => {
  console.error('[Pitch Worker] Failed to start:', error);
  process.exit(1);
});
