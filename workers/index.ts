/**
 * BullMQ Combined Worker
 *
 * Single worker process that handles all queues:
 * - pitch
 * - prequal-processing
 * - qualification-scan
 * - visualization
 *
 * Run with: npm run worker
 */

import { Worker } from 'bullmq';

import { getConnectionOptions, closeConnection } from '../lib/bullmq/connection';
import { QUEUE_NAMES, getPitchBackoffDelay, closeQueues } from '../lib/bullmq/queues';
import { processPitchJob } from '../lib/pitch/processor';
import { processPreQualJob } from '../lib/bullmq/workers/prequal-processing-worker';
import { processQualificationScanJob } from '../lib/bullmq/workers/qualification-scan-processor';
import { processVisualizationJob } from '../lib/bullmq/workers/visualization-processor';

/**
 * Worker concurrency settings
 */
const PITCH_CONCURRENCY = parseInt(process.env.PITCH_CONCURRENCY || '2', 10);
const PREQUAL_CONCURRENCY = parseInt(process.env.PREQUAL_CONCURRENCY || '1', 10);
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
  // Pitch Worker
  // ============================================================================
  const pitchWorker = new Worker(
    QUEUE_NAMES.PITCH,
    async job => {
      console.log(`[Pitch] Processing job ${job.id}`);
      return processPitchJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: PITCH_CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return getPitchBackoffDelay(attemptsMade);
        },
      },
    }
  );

  pitchWorker.on('ready', () => {
    console.log(`[Pitch] Ready (concurrency: ${PITCH_CONCURRENCY})`);
  });

  pitchWorker.on('completed', (job, result) => {
    console.log(
      `[Pitch] Job ${job.id} completed. Success: ${result.success}, ` +
        `Agents: ${result.completedAgents.length}/${result.completedAgents.length + result.failedAgents.length}`
    );
  });

  pitchWorker.on('failed', (job, error) => {
    console.error(`[Pitch] Job ${job?.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
    });
  });

  workers.push(pitchWorker);

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
      lockDuration: parseInt(process.env.PREQUAL_LOCK_DURATION_MS || '900000', 10),
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
  // Qualification Scan Worker
  // ============================================================================
  const qualificationScanWorker = new Worker(
    QUEUE_NAMES.QUALIFICATION_SCAN,
    async job => {
      console.log(`[QualificationScan] Processing job ${job.id}`);
      return processQualificationScanJob(job);
    },
    {
      connection: connectionOptions,
      concurrency: QUICK_SCAN_CONCURRENCY,
    }
  );

  qualificationScanWorker.on('ready', () => {
    console.log(`[QualificationScan] Ready (concurrency: ${QUICK_SCAN_CONCURRENCY})`);
  });

  qualificationScanWorker.on('completed', (job, result) => {
    console.log(`[QualificationScan] Job ${job.id} completed. Success: ${result.success}`);
  });

  qualificationScanWorker.on('failed', (job, error) => {
    console.error(`[QualificationScan] Job ${job?.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job?.data,
      attemptsMade: job?.attemptsMade,
    });
  });

  workers.push(qualificationScanWorker);

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
