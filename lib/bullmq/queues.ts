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
  PITCH: 'pitch',
  PREQUAL_PROCESSING: 'prequal-processing',
  QUICK_SCAN: 'quick-scan',
  VISUALIZATION: 'visualization',
} as const;

/**
 * PreQual Processing job data structure
 */
export interface PreQualProcessingJobData {
  /** PreQualification ID */
  preQualificationId: string;
  /** User who triggered the processing */
  userId: string;
  /** Background job ID for qualification tracking */
  backgroundJobId: string;
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
  /** Skip extraction and use existing extracted requirements */
  useExistingRequirements?: boolean;
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

  return prequalProcessingQueue;
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
    quickScanQueue = new Queue<QuickScanJobData, QuickScanJobResult, string>(
      QUEUE_NAMES.QUICK_SCAN,
      {
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
      }
    );

    console.log('[BullMQ] Quick Scan queue initialized');
  }

  return quickScanQueue;
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

  console.log(`[BullMQ] Added quick scan job ${job.id} for prequal ${data.preQualificationId}`);

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

// ============================================================================
// Visualization Queue
// ============================================================================

/**
 * Visualization job data structure
 */
export interface VisualizationJobData {
  /** Qualification ID */
  pitchId: string;
  /** Section IDs to generate visualizations for (empty = all missing) */
  sectionIds: string[];
  /** User who triggered the job */
  userId: string;
  /** Database job ID for status tracking */
  dbJobId: string;
  /** Optional focus prompt for all visualizations */
  focusPrompt?: string;
}

/**
 * Visualization job result structure
 */
export interface VisualizationJobResult {
  success: boolean;
  generated: number;
  total: number;
  sections: Array<{ sectionId: string; success: boolean; error?: string }>;
  error?: string;
}

/**
 * Visualization Queue
 *
 * Handles background generation of visualizations for sections.
 */
let visualizationQueue: Queue<VisualizationJobData, VisualizationJobResult, string> | null = null;

/**
 * Get or create the Visualization queue
 */
export function getVisualizationQueue(): Queue<
  VisualizationJobData,
  VisualizationJobResult,
  string
> {
  if (!visualizationQueue) {
    visualizationQueue = new Queue<VisualizationJobData, VisualizationJobResult, string>(
      QUEUE_NAMES.VISUALIZATION,
      {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 10000,
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
      }
    );

    console.log('[BullMQ] Visualization queue initialized');
  }

  return visualizationQueue;
}

/**
 * Add a visualization job to the queue
 */
export async function addVisualizationJob(data: VisualizationJobData) {
  const queue = getVisualizationQueue();

  const job = await queue.add('process', data, {
    jobId: data.dbJobId,
  });

  console.log(`[BullMQ] Added visualization job ${job.id} for qualification ${data.pitchId}`);

  return job;
}

/**
 * Get a visualization job by ID
 */
export async function getVisualizationJob(jobId: string) {
  const queue = getVisualizationQueue();
  return queue.getJob(jobId);
}

// ============================================================================
// Pitch Queue
// ============================================================================

import type { PitchJobData, PitchJobResult } from '@/lib/pitch/types';

let pitchQueue: Queue<PitchJobData, PitchJobResult, string> | null = null;

/**
 * Get or create the Pitch queue
 */
export function getPitchQueue(): Queue<PitchJobData, PitchJobResult, string> {
  if (!pitchQueue) {
    pitchQueue = new Queue<PitchJobData, PitchJobResult, string>(QUEUE_NAMES.PITCH, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'custom',
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

    console.log('[BullMQ] Pitch queue initialized');
  }

  return pitchQueue;
}

let pitchQueueEvents: QueueEvents | null = null;

export function getPitchQueueEvents(): QueueEvents {
  if (!pitchQueueEvents) {
    pitchQueueEvents = new QueueEvents(QUEUE_NAMES.PITCH, {
      connection: getConnection(),
    });
  }

  return pitchQueueEvents;
}

export async function addPitchJob(data: PitchJobData, jobId?: string) {
  const queue = getPitchQueue();

  const job = await queue.add('process', data, {
    jobId: jobId || data.runId,
  });

  console.log(`[BullMQ] Added pitch job ${job.id} for qualification ${data.pitchId}`);

  return job;
}

export async function getPitchJob(jobId: string) {
  const queue = getPitchQueue();
  return queue.getJob(jobId);
}

/**
 * Custom backoff strategy for pitch jobs
 * Attempt 1: 1 minute, Attempt 2: 5 minutes, Attempt 3: 15 minutes
 */
export function getPitchBackoffDelay(attemptsMade: number): number {
  const delays = [60_000, 300_000, 900_000];
  return delays[attemptsMade - 1] ?? delays[delays.length - 1];
}

/**
 * Close all queue connections
 * Call this on graceful shutdown
 */
export async function closeQueues(): Promise<void> {
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

  if (pitchQueue) {
    await pitchQueue.close();
    pitchQueue = null;
  }

  if (pitchQueueEvents) {
    await pitchQueueEvents.close();
    pitchQueueEvents = null;
  }

  console.log('[BullMQ] All queues closed');
}
