import { Queue, QueueEvents } from 'bullmq';

import { getConnection } from './connection';

/**
 * BullMQ Queue Definitions
 *
 * Defines all queues used in the application with their configurations.
 */

/**
 * Queue names as constants
 */
export const QUEUE_NAMES = {
  DEEP_SCAN: 'deep-scan',
} as const;

/**
 * Deep Scan job data structure
 */
export interface DeepScanJobData {
  /** Qualification ID to scan */
  qualificationId: string;
  /** Website URL to scan */
  websiteUrl: string;
  /** User who triggered the scan */
  userId: string;
  /** Database job ID for status tracking */
  dbJobId: string;
  /** Force reset - clear all checkpoints and start fresh */
  forceReset?: boolean;
  /** Selective re-scan - only run these experts */
  selectedExperts?: string[];
}

/**
 * Deep Scan job result structure
 */
export interface DeepScanJobResult {
  success: boolean;
  completedExperts: string[];
  failedExperts: string[];
  sectionConfidences: Record<string, number>;
  error?: string;
}

/**
 * Deep Scan Queue
 *
 * Handles background processing of deep scan jobs with:
 * - 3 retries with exponential backoff (1min, 5min, 15min)
 * - 30-minute job timeout
 * - Job data retention for 24h (completed) / 7 days (failed)
 */
let deepScanQueue: Queue<DeepScanJobData, DeepScanJobResult, string> | null = null;

/**
 * Get or create the Deep Scan queue
 */
export function getDeepScanQueue(): Queue<DeepScanJobData, DeepScanJobResult, string> {
  if (!deepScanQueue) {
    deepScanQueue = new Queue<DeepScanJobData, DeepScanJobResult, string>(QUEUE_NAMES.DEEP_SCAN, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'custom',
        },
        // Keep completed jobs for 24 hours
        removeOnComplete: {
          age: 24 * 60 * 60, // 24 hours in seconds
          count: 100, // Keep max 100 completed jobs
        },
        // Keep failed jobs for 7 days
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days in seconds
          count: 500, // Keep max 500 failed jobs
        },
      },
    });

    console.log('[BullMQ] Deep Scan queue initialized');
  }

  return deepScanQueue!;
}

/**
 * Custom backoff strategy for deep scan jobs
 * Returns delay in milliseconds based on attempt number
 *
 * Attempt 1: 1 minute
 * Attempt 2: 5 minutes
 * Attempt 3: 15 minutes
 */
export function getDeepScanBackoffDelay(attemptsMade: number): number {
  const delays = [
    60 * 1000, // 1 minute
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
  ];

  return delays[attemptsMade - 1] || delays[delays.length - 1];
}

/**
 * Queue events for monitoring
 */
let deepScanQueueEvents: QueueEvents | null = null;

/**
 * Get or create queue events for the Deep Scan queue
 * Useful for monitoring job progress from the API
 */
export function getDeepScanQueueEvents(): QueueEvents {
  if (!deepScanQueueEvents) {
    deepScanQueueEvents = new QueueEvents(QUEUE_NAMES.DEEP_SCAN, {
      connection: getConnection(),
    });
  }

  return deepScanQueueEvents;
}

/**
 * Add a deep scan job to the queue
 *
 * @param data - Job data
 * @param jobId - Optional custom job ID (defaults to dbJobId)
 * @returns The created job
 */
export async function addDeepScanJob(data: DeepScanJobData, jobId?: string) {
  const queue = getDeepScanQueue();

  const job = await queue.add('process', data, {
    jobId: jobId || data.dbJobId,
  });

  console.log(`[BullMQ] Added deep scan job ${job.id} for qualification ${data.qualificationId}`);

  return job;
}

/**
 * Get a job by ID
 */
export async function getDeepScanJob(jobId: string) {
  const queue = getDeepScanQueue();
  return queue.getJob(jobId);
}

/**
 * Close all queue connections
 * Call this on graceful shutdown
 */
export async function closeQueues(): Promise<void> {
  if (deepScanQueue) {
    await deepScanQueue.close();
    deepScanQueue = null;
  }

  if (deepScanQueueEvents) {
    await deepScanQueueEvents.close();
    deepScanQueueEvents = null;
  }

  console.log('[BullMQ] All queues closed');
}
