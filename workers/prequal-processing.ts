/**
 * BullMQ PreQual Processing Worker Entry Point
 *
 * This is the entry point for the background worker that processes new RFP submissions.
 * Run with: npx tsx workers/prequal-processing.ts
 *
 * In production, this runs as a separate Docker container.
 */

import { Worker } from 'bullmq';

import { getConnectionOptions, closeConnection } from '../lib/bullmq/connection';
import { QUEUE_NAMES, closeQueues } from '../lib/bullmq/queues';
import { processPreQualJob } from '../lib/bullmq/workers/prequal-processing-worker';

/**
 * Worker concurrency - how many jobs to process in parallel
 * PreQual processing is I/O bound (PDF extraction, AI calls), so we can run a few in parallel
 */
const WORKER_CONCURRENCY = parseInt(process.env.PREQUAL_WORKER_CONCURRENCY || '3', 10);

/**
 * Create and start the worker
 */
async function main() {
  console.log('[PreQual Worker] Starting...');
  console.log(`[PreQual Worker] Concurrency: ${WORKER_CONCURRENCY}`);

  const connectionOptions = getConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.PREQUAL_PROCESSING,
    async job => {
      console.log(`[PreQual Worker] Processing job ${job.id}`);
      return processPreQualJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  // Event handlers
  worker.on('ready', () => {
    console.log('[PreQual Worker] Worker is ready and waiting for jobs');
  });

  worker.on('completed', (job, result) => {
    console.log(
      `[PreQual Worker] Job ${job.id} completed. Success: ${result.success}, ` +
        `Step: ${result.step}, Progress: ${result.progress}%`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[PreQual Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      error.message
    );
  });

  worker.on('error', error => {
    console.error('[PreQual Worker] Worker error:', error);
  });

  worker.on('stalled', jobId => {
    console.warn(`[PreQual Worker] Job ${jobId} stalled`);
  });

  worker.on('progress', (job, progress) => {
    const progressLabel =
      typeof progress === 'number' ? `${progress}%` : JSON.stringify(progress);
    console.log(`[PreQual Worker] Job ${job.id} progress: ${progressLabel}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[PreQual Worker] Received ${signal}, shutting down...`);

    try {
      // Close worker first (wait for current jobs to complete)
      await worker.close();
      console.log('[PreQual Worker] Worker closed');

      // Close queues
      await closeQueues();

      // Close Redis connection
      await closeConnection();

      console.log('[PreQual Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[PreQual Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  // Keep the process running
  console.log('[PreQual Worker] Worker started successfully');
}

main().catch(error => {
  console.error('[PreQual Worker] Failed to start:', error);
  process.exit(1);
});
