/**
 * BullMQ Qualification Scan Worker Entry Point
 *
 * Background worker for Qualification Scan + PreQual processing jobs.
 * Run with: npm run worker:qualification-scan
 * (uses esbuild-register + tsconfig-paths for @/ alias resolution)
 */

import { Worker } from 'bullmq';

import { AI_TIMEOUTS } from '../lib/ai/config';
import { getConnectionOptions, closeConnection } from '../lib/bullmq/connection';
import { QUEUE_NAMES, closeQueues } from '../lib/bullmq/queues';
import { processPreQualJob } from '../lib/bullmq/workers/prequal-processing-worker';
import { processQualificationScanJob } from '../lib/bullmq/workers/qualification-scan-processor';

const WORKER_CONCURRENCY = parseInt(process.env.QUICK_SCAN_CONCURRENCY || '3', 10);
const PREQUAL_CONCURRENCY = parseInt(process.env.PREQUAL_CONCURRENCY || '3', 10);

async function main() {
  console.log('[QualificationScan Worker] Starting qualification-scan + prequal workers...');
  console.log(`[QualificationScan Worker] QualificationScan concurrency: ${WORKER_CONCURRENCY}`);
  console.log(`[QualificationScan Worker] PreQual concurrency: ${PREQUAL_CONCURRENCY}`);

  const connectionOptions = getConnectionOptions();

  const qualificationScanWorker = new Worker(
    QUEUE_NAMES.QUALIFICATION_SCAN,
    async job => {
      console.log(`[QualificationScan Worker] Processing job ${job.id}`);
      return processQualificationScanJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: WORKER_CONCURRENCY,
      // Timeout-Konfiguration für lange laufende Jobs
      lockDuration: AI_TIMEOUTS.WORKER_LOCK,
      stalledInterval: 30 * 1000, // Stalled-Check alle 30s
      maxStalledCount: 2, // Nach 2 Checks als stalled markieren
    }
  );

  qualificationScanWorker.on('ready', () => {
    console.log('[QualificationScan Worker] QualificationScan worker ready');
  });

  qualificationScanWorker.on('completed', (job, result) => {
    console.log(`[QualificationScan Worker] Job ${job.id} completed. Success: ${result.success}`);
  });

  qualificationScanWorker.on('failed', (job, error) => {
    console.error(
      `[QualificationScan Worker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      error.message
    );
  });

  qualificationScanWorker.on('error', error => {
    console.error('[QualificationScan Worker] QualificationScan worker error:', error);
  });

  qualificationScanWorker.on('stalled', jobId => {
    console.warn(`[QualificationScan Worker] QualificationScan job ${jobId} stalled`);
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
    console.log(`[QualificationScan Worker] Received ${signal}, shutting down...`);

    try {
      await qualificationScanWorker.close();
      await prequalWorker.close();
      console.log('[QualificationScan Worker] Workers closed');

      await closeQueues();
      await closeConnection();

      console.log('[QualificationScan Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[QualificationScan Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  console.log('[QualificationScan Worker] Workers started successfully');
}

main().catch(error => {
  console.error('[QualificationScan Worker] Failed to start:', error);
  process.exit(1);
});
