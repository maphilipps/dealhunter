/**
 * BullMQ Deep Scan Worker
 *
 * This is the entry point for the background worker that processes deep scan jobs.
 * Run with: npx tsx workers/deep-scan.ts
 *
 * In production, this runs as a separate Docker container.
 */

import { Worker } from 'bullmq';

import { getConnectionOptions, closeConnection } from '@/lib/bullmq/connection';
import { QUEUE_NAMES, getDeepScanBackoffDelay, closeQueues } from '@/lib/bullmq/queues';
import { processDeepScanJob } from '@/lib/bullmq/workers/deep-scan-processor';

/**
 * Worker concurrency - how many jobs to process in parallel
 */
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

/**
 * Create and start the worker
 */
async function main() {
  console.log('[DeepScan Worker] Starting...');
  console.log(`[DeepScan Worker] Concurrency: ${WORKER_CONCURRENCY}`);

  const connectionOptions = getConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.DEEP_SCAN,
    async job => {
      console.log(`[DeepScan Worker] Processing job ${job.id}`);
      return processDeepScanJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: WORKER_CONCURRENCY,
      // Custom backoff calculation
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return getDeepScanBackoffDelay(attemptsMade);
        },
      },
    }
  );

  // Event handlers
  worker.on('ready', () => {
    console.log('[DeepScan Worker] Worker is ready and waiting for jobs');
  });

  worker.on('completed', (job, result) => {
    console.log(
      `[DeepScan Worker] Job ${job.id} completed. Success: ${result.success}, ` +
        `Experts: ${result.completedExperts.length}/${result.completedExperts.length + result.failedExperts.length}`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[DeepScan Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      error.message
    );
  });

  worker.on('error', error => {
    console.error('[DeepScan Worker] Worker error:', error);
  });

  worker.on('stalled', jobId => {
    console.warn(`[DeepScan Worker] Job ${jobId} stalled`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[DeepScan Worker] Received ${signal}, shutting down...`);

    try {
      // Close worker first (wait for current jobs to complete)
      await worker.close();
      console.log('[DeepScan Worker] Worker closed');

      // Close queues
      await closeQueues();

      // Close Redis connection
      await closeConnection();

      console.log('[DeepScan Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[DeepScan Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Keep the process running
  console.log('[DeepScan Worker] Worker started successfully');
}

main().catch(error => {
  console.error('[DeepScan Worker] Failed to start:', error);
  process.exit(1);
});
