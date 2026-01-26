/**
 * BullMQ Quick Scan Worker Entry Point
 *
 * Background worker for Quick Scan + PreQual processing jobs.
 * Run with: npm run worker:quick-scan
 * (uses esbuild-register + tsconfig-paths for @/ alias resolution)
 */

import { Worker } from 'bullmq';

import { getConnectionOptions, closeConnection } from '../lib/bullmq/connection';
import { QUEUE_NAMES, closeQueues } from '../lib/bullmq/queues';
import { processQuickScanJob } from '../lib/bullmq/workers/quick-scan-processor';
import { processPreQualJob } from '../lib/bullmq/workers/prequal-processing-worker';

const WORKER_CONCURRENCY = parseInt(process.env.QUICK_SCAN_CONCURRENCY || '3', 10);
const PREQUAL_CONCURRENCY = parseInt(process.env.PREQUAL_CONCURRENCY || '3', 10);

async function main() {
  console.log('[QuickScan Worker] Starting quick-scan + prequal workers...');
  console.log(`[QuickScan Worker] QuickScan concurrency: ${WORKER_CONCURRENCY}`);
  console.log(`[QuickScan Worker] PreQual concurrency: ${PREQUAL_CONCURRENCY}`);

  const connectionOptions = getConnectionOptions();

  const quickScanWorker = new Worker(
    QUEUE_NAMES.QUICK_SCAN,
    async job => {
      console.log(`[QuickScan Worker] Processing job ${job.id}`);
      return processQuickScanJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  quickScanWorker.on('ready', () => {
    console.log('[QuickScan Worker] QuickScan worker ready');
  });

  quickScanWorker.on('completed', (job, result) => {
    console.log(
      `[QuickScan Worker] Job ${job.id} completed. Success: ${result.success}`
    );
  });

  quickScanWorker.on('failed', (job, error) => {
    console.error(
      `[QuickScan Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      error.message
    );
  });

  quickScanWorker.on('error', error => {
    console.error('[QuickScan Worker] QuickScan worker error:', error);
  });

  quickScanWorker.on('stalled', jobId => {
    console.warn(`[QuickScan Worker] QuickScan job ${jobId} stalled`);
  });

  const prequalWorker = new Worker(
    QUEUE_NAMES.PREQUAL_PROCESSING,
    async job => {
      console.log(`[PreQual Worker] Processing job ${job.id}`);
      return processPreQualJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: PREQUAL_CONCURRENCY,
    }
  );

  prequalWorker.on('ready', () => {
    console.log('[PreQual Worker] PreQual worker ready');
  });

  prequalWorker.on('completed', (job, result) => {
    console.log(
      `[PreQual Worker] Job ${job.id} completed. Success: ${result.success}, Step: ${result.step}`
    );
  });

  prequalWorker.on('failed', (job, error) => {
    console.error(
      `[PreQual Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      error.message
    );
  });

  prequalWorker.on('error', error => {
    console.error('[PreQual Worker] Worker error:', error);
  });

  prequalWorker.on('stalled', jobId => {
    console.warn(`[PreQual Worker] Job ${jobId} stalled`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[QuickScan Worker] Received ${signal}, shutting down...`);

    try {
      await quickScanWorker.close();
      await prequalWorker.close();
      console.log('[QuickScan Worker] Workers closed');

      await closeQueues();
      await closeConnection();

      console.log('[QuickScan Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[QuickScan Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('[QuickScan Worker] Workers started successfully');
}

main().catch(error => {
  console.error('[QuickScan Worker] Failed to start:', error);
  process.exit(1);
});
