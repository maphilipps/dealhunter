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
  PREQUAL_PROCESSING: 'prequal-processing',
  QUICK_SCAN: 'quick-scan',
} as const;

/**
 * PreQual Processing job data structure
 */
export interface PreQualProcessingJobData {
  /** PreQualification ID */
  preQualificationId: string;
  /** User who triggered the processing */
  userId: string;
  /** PDF files as base64 encoded strings */
  files: Array<{
    name: string;
    base64: string;
    size: number;
  }>;
  /** Website URLs to analyze */
  websiteUrls: string[];
  /** Additional text input */
  additionalText: string;
  /** Enable DSGVO PII cleaning */
  enableDSGVO: boolean;
  /** Optional account ID */
  accountId?: string;
}

/**
 * PreQual Processing job result structure
 */
export interface PreQualProcessingJobResult {
  success: boolean;
  step: 'extracting' | 'duplicate_checking' | 'scanning' | 'timeline' | 'complete';
  progress: number;
  error?: string;
}

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
  errors?: Record<string, string>;
  error?: string;
}

/**
 * Quick Scan job data structure
 */
export interface QuickScanJobData {
  /** PreQualification ID to scan */
  preQualificationId: string;
  /** QuickScan record ID */
  quickScanId: string;
  /** Website URL to scan */
  websiteUrl: string;
  /** User who triggered the scan */
  userId: string;
}

/**
 * Quick Scan job result structure
 */
export interface QuickScanJobResult {
  success: boolean;
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

// ============================================================================
// PreQual Processing Queue
// ============================================================================

/**
 * PreQual Processing Queue
 *
 * Handles background processing of new Pre-Qualification submissions with:
 * - PDF extraction
 * - Duplicate checking
 * - Quick scan
 * - Timeline generation (for BID decisions)
 */
let prequalProcessingQueue: Queue<
  PreQualProcessingJobData,
  PreQualProcessingJobResult,
  string
> | null = null;

/**
 * Get or create the PreQual Processing queue
 */
export function getPreQualProcessingQueue(): Queue<
  PreQualProcessingJobData,
  PreQualProcessingJobResult,
  string
> {
  if (!prequalProcessingQueue) {
    prequalProcessingQueue = new Queue<
      PreQualProcessingJobData,
      PreQualProcessingJobResult,
      string
    >(QUEUE_NAMES.PREQUAL_PROCESSING, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30 seconds initial delay
        },
        // Keep completed jobs for 24 hours
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 100,
        },
        // Keep failed jobs for 7 days
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
          count: 500,
        },
      },
    });

    console.log('[BullMQ] PreQual Processing queue initialized');
  }

  return prequalProcessingQueue!;
}

// ============================================================================
// Quick Scan Queue
// ============================================================================

/**
 * Quick Scan Queue
 *
 * Handles background processing of manual quick scan jobs.
 */
let quickScanQueue: Queue<QuickScanJobData, QuickScanJobResult, string> | null = null;

/**
 * Get or create the Quick Scan queue
 */
export function getQuickScanQueue(): Queue<QuickScanJobData, QuickScanJobResult, string> {
  if (!quickScanQueue) {
    quickScanQueue = new Queue<QuickScanJobData, QuickScanJobResult, string>(QUEUE_NAMES.QUICK_SCAN, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
          count: 500,
        },
      },
    });

    console.log('[BullMQ] Quick Scan queue initialized');
  }

  return quickScanQueue!;
}

/**
 * Queue events for Quick Scan monitoring
 */
let quickScanQueueEvents: QueueEvents | null = null;

/**
 * Get or create queue events for the Quick Scan queue
 */
export function getQuickScanQueueEvents(): QueueEvents {
  if (!quickScanQueueEvents) {
    quickScanQueueEvents = new QueueEvents(QUEUE_NAMES.QUICK_SCAN, {
      connection: getConnection(),
    });
  }

  return quickScanQueueEvents;
}

/**
 * Add a quick scan job to the queue
 *
 * @param data - Job data
 * @returns The created job
 */
export async function addQuickScanJob(data: QuickScanJobData) {
  const queue = getQuickScanQueue();

  const job = await queue.add('process', data);

  console.log(
    `[BullMQ] Added quick scan job ${job.id} for prequal ${data.preQualificationId}`
  );

  return job;
}

/**
 * Get a quick scan job by ID
 */
export async function getQuickScanJob(jobId: string) {
  const queue = getQuickScanQueue();
  return queue.getJob(jobId);
}

/**
 * Queue events for PreQual Processing monitoring
 */
let prequalProcessingQueueEvents: QueueEvents | null = null;

/**
 * Get or create queue events for the PreQual Processing queue
 */
export function getPreQualProcessingQueueEvents(): QueueEvents {
  if (!prequalProcessingQueueEvents) {
    prequalProcessingQueueEvents = new QueueEvents(QUEUE_NAMES.PREQUAL_PROCESSING, {
      connection: getConnection(),
    });
  }

  return prequalProcessingQueueEvents;
}

/**
 * Add a prequal processing job to the queue
 *
 * @param data - Job data
 * @returns The created job
 */
export async function addPreQualProcessingJob(data: PreQualProcessingJobData) {
  const queue = getPreQualProcessingQueue();

  const job = await queue.add('process', data, {
    jobId: data.preQualificationId, // Use prequal ID as job ID for easy lookup
  });

  console.log(
    `[BullMQ] Added prequal processing job ${job.id} for prequal ${data.preQualificationId}`
  );

  return job;
}

/**
 * Get a prequal processing job by ID
 */
export async function getPreQualProcessingJob(jobId: string) {
  const queue = getPreQualProcessingQueue();
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

  if (prequalProcessingQueue) {
    await prequalProcessingQueue.close();
    prequalProcessingQueue = null;
  }

  if (prequalProcessingQueueEvents) {
    await prequalProcessingQueueEvents.close();
    prequalProcessingQueueEvents = null;
  }

  if (quickScanQueue) {
    await quickScanQueue.close();
    quickScanQueue = null;
  }

  if (quickScanQueueEvents) {
    await quickScanQueueEvents.close();
    quickScanQueueEvents = null;
  }

  console.log('[BullMQ] All queues closed');
}
