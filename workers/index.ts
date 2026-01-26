/**
 * BullMQ Combined Worker
 *
 * Single worker process that handles all queues:
 * - deep-scan
 * - prequal-processing
 *
 * Run with: npm run worker
 */

import { Worker } from 'bullmq';

import { getConnectionOptions, closeConnection } from '../lib/bullmq/connection';
import { QUEUE_NAMES, getDeepScanBackoffDelay, closeQueues } from '../lib/bullmq/queues';
import { processDeepScanJob } from '../lib/bullmq/workers/deep-scan-processor';
import { processPreQualJob } from '../lib/bullmq/workers/prequal-processing-worker';
import { processQuickScanJob } from '../lib/bullmq/workers/quick-scan-processor';
import { processVisualizationJob } from '../lib/bullmq/workers/visualization-processor';

/**
 * Worker concurrency settings
 */
const DEEP_SCAN_CONCURRENCY = parseInt(process.env.DEEP_SCAN_CONCURRENCY || '2', 10);
const PREQUAL_CONCURRENCY = parseInt(process.env.PREQUAL_CONCURRENCY || '3', 10);
const QUICK_SCAN_CONCURRENCY = parseInt(process.env.QUICK_SCAN_CONCURRENCY || '3', 10);
const VISUALIZATION_CONCURRENCY = parseInt(process.env.VISUALIZATION_CONCURRENCY || '2', 10);

/**
 * Create and start all workers
 */
async function main() {
  console.log('[Worker] Starting combined worker...');

  const connectionOptions = getConnectionOptions();
  const workers: Worker[] = [];

  // ============================================================================
  // Deep Scan Worker
  // ============================================================================
  const deepScanWorker = new Worker(
    QUEUE_NAMES.DEEP_SCAN,
    async job => {
      console.log(`[DeepScan] Processing job ${job.id}`);
      return processDeepScanJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: DEEP_SCAN_CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return getDeepScanBackoffDelay(attemptsMade);
        },
      },
    }
  );

  deepScanWorker.on('ready', () => {
    console.log(`[DeepScan] Ready (concurrency: ${DEEP_SCAN_CONCURRENCY})`);
  });

  deepScanWorker.on('completed', (job, result) => {
    console.log(
      `[DeepScan] Job ${job.id} completed. Success: ${result.success}, ` +
        `Experts: ${result.completedExperts.length}/${result.completedExperts.length + result.failedExperts.length}`
    );
  });

  deepScanWorker.on('failed', (job, error) => {
    console.error(`[DeepScan] Job ${job?.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
    });
  });

  workers.push(deepScanWorker);

  // ============================================================================
  // PreQual Processing Worker
  // ============================================================================
  const prequalWorker = new Worker(
    QUEUE_NAMES.PREQUAL_PROCESSING,
    async job => {
      console.log(`[PreQual] Processing job ${job.id}`);
      return processPreQualJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: PREQUAL_CONCURRENCY,
    }
  );

  prequalWorker.on('ready', () => {
    console.log(`[PreQual] Ready (concurrency: ${PREQUAL_CONCURRENCY})`);
  });

  prequalWorker.on('completed', (job, result) => {
    console.log(
      `[PreQual] Job ${job.id} completed. Success: ${result.success}, Step: ${result.step}`
    );
  });

  prequalWorker.on('failed', (job, error) => {
    console.error(`[PreQual] Job ${job?.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
    });
  });

  prequalWorker.on('progress', (job, progress) => {
    console.log(`[PreQual] Job ${job.id} progress: ${JSON.stringify(progress)}`);
  });

  workers.push(prequalWorker);

  // ============================================================================
  // Quick Scan Worker
  // ============================================================================
  const quickScanWorker = new Worker(
    QUEUE_NAMES.QUICK_SCAN,
    async job => {
      console.log(`[QuickScan] Processing job ${job.id}`);
      return processQuickScanJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: QUICK_SCAN_CONCURRENCY,
    }
  );

  quickScanWorker.on('ready', () => {
    console.log(`[QuickScan] Ready (concurrency: ${QUICK_SCAN_CONCURRENCY})`);
  });

  quickScanWorker.on('completed', (job, result) => {
    console.log(
      `[QuickScan] Job ${job.id} completed. Success: ${result.success}`
    );
  });

  quickScanWorker.on('failed', (job, error) => {
    console.error(`[QuickScan] Job ${job?.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
    });
  });

  workers.push(quickScanWorker);

  // ============================================================================
  // Visualization Worker
  // ============================================================================
  const visualizationWorker = new Worker(
    QUEUE_NAMES.VISUALIZATION,
    async job => {
      console.log(`[Visualization] Processing job ${job.id}`);
      return processVisualizationJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: VISUALIZATION_CONCURRENCY,
    }
  );

  visualizationWorker.on('ready', () => {
    console.log(`[Visualization] Ready (concurrency: ${VISUALIZATION_CONCURRENCY})`);
  });

  visualizationWorker.on('completed', (job, result) => {
    console.log(
      `[Visualization] Job ${job.id} completed. Generated: ${result.generated}/${result.total}`
    );
  });

  visualizationWorker.on('failed', (job, error) => {
    console.error(`[Visualization] Job ${job?.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
    });
  });

  workers.push(visualizationWorker);

  // ============================================================================
  // Shared Event Handlers
  // ============================================================================
  for (const worker of workers) {
    worker.on('error', error => {
      console.error(`[Worker] Error:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    });

    worker.on('stalled', jobId => {
      console.warn(`[Worker] Job ${jobId} stalled - may be stuck or lost connection`);
    });
  }

  // ============================================================================
  // Graceful Shutdown
  // ============================================================================
  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}, shutting down...`);

    try {
      // Close all workers
      await Promise.all(workers.map(w => w.close()));
      console.log('[Worker] All workers closed');

      // Close queues and connection
      await closeQueues();
      await closeConnection();

      console.log('[Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log('[Worker] All workers started successfully');
}

main().catch(error => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});
