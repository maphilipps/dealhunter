// workers/deep-scan-v2.ts
import { Worker } from 'bullmq';

import { getConnection } from '@/lib/bullmq/connection';
import { QUEUE_NAMES } from '@/lib/bullmq/queues';
import type { DeepScanV2JobData, DeepScanV2JobResult } from '@/lib/deep-scan-v2/types';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10);

const worker = new Worker<DeepScanV2JobData, DeepScanV2JobResult>(
  QUEUE_NAMES.DEEP_SCAN_V2,
  async job => {
    const { processDeepScanV2Job } = await import('@/lib/deep-scan-v2/processor');
    return processDeepScanV2Job(job);
  },
  {
    connection: getConnection(),
    concurrency: CONCURRENCY,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        const delays = [60_000, 300_000, 900_000];
        return delays[attemptsMade - 1] ?? delays[delays.length - 1];
      },
    },
  }
);

worker.on('ready', () => console.log('[Worker:deep-scan-v2] Ready'));
worker.on('completed', (job, result) =>
  console.log(`[Worker:deep-scan-v2] Job ${job.id} completed: ${result.phase}`)
);
worker.on('failed', (job, err) =>
  console.error(`[Worker:deep-scan-v2] Job ${job?.id} failed:`, err.message)
);
worker.on('stalled', jobId => console.warn(`[Worker:deep-scan-v2] Job ${jobId} stalled`));

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

console.log('[Worker:deep-scan-v2] Worker started');
