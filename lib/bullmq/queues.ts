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
  QUALIFICATION_SCAN: 'qualification-scan',
  VISUALIZATION: 'visualization',
  TECHNOLOGY_REVIEW: 'technology-review',
} as const;

/**
 * PreQual Processing job data structure
 */
export interface PreQualProcessingJobData {
  /** Qualification ID */
  preQualificationId: string;
  /** User who triggered the processing */
  userId: string;
  /** Background job ID for tracking */
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
 * Qualification Scan job data structure
 */
export interface QualificationScanJobData {
  /** Qualification ID to scan */
  preQualificationId: string;
  /** QualificationScan record ID */
  qualificationScanId: string;
  /** Website URL to scan */
  websiteUrl: string;
  /** User who triggered the scan */
  userId: string;
}

/**
 * Qualification Scan job result structure
 */
export interface QualificationScanJobResult {
  success: boolean;
  error?: string;
}

/** @deprecated Use QualificationScanJobData */
export type LeadScanJobData = QualificationScanJobData;
/** @deprecated Use QualificationScanJobResult */
export type LeadScanJobResult = QualificationScanJobResult;

// ============================================================================
// PreQual Processing Queue
// ============================================================================

/**
 * PreQual Processing Queue
 *
 * Handles background processing of new Qualification submissions with:
 * - PDF extraction
 * - Duplicate checking
 * - Lead scan
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
// Qualification Scan Queue
// ============================================================================

/**
 * Qualification Scan Queue
 *
 * Handles background processing of manual lead scan jobs.
 */
let qualificationScanQueue: Queue<
  QualificationScanJobData,
  QualificationScanJobResult,
  string
> | null = null;

/**
 * Get or create the Qualification Scan queue
 */
export function getQualificationScanQueue(): Queue<
  QualificationScanJobData,
  QualificationScanJobResult,
  string
> {
  if (!qualificationScanQueue) {
    qualificationScanQueue = new Queue<
      QualificationScanJobData,
      QualificationScanJobResult,
      string
    >(QUEUE_NAMES.QUALIFICATION_SCAN, {
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

    console.log('[BullMQ] Qualification Scan queue initialized');
  }

  return qualificationScanQueue;
}

/**
 * Queue events for Qualification Scan monitoring
 */
let qualificationScanQueueEvents: QueueEvents | null = null;

/**
 * Get or create queue events for the Qualification Scan queue
 */
export function getQualificationScanQueueEvents(): QueueEvents {
  if (!qualificationScanQueueEvents) {
    qualificationScanQueueEvents = new QueueEvents(QUEUE_NAMES.QUALIFICATION_SCAN, {
      connection: getConnection(),
    });
  }

  return qualificationScanQueueEvents;
}

/**
 * Add a qualifications scan job to the queue
 *
 * @param data - Job data
 * @returns The created job
 */
export async function addQualificationScanJob(data: QualificationScanJobData) {
  const queue = getQualificationScanQueue();

  const job = await queue.add('process', data);

  console.log(
    `[BullMQ] Added qualifications scan job ${job.id} for prequal ${data.preQualificationId}`
  );

  return job;
}

/**
 * Get a qualifications scan job by ID
 */
export async function getQualificationScanJob(jobId: string) {
  const queue = getQualificationScanQueue();
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
// Technology Review Queue
// ============================================================================

/**
 * Technology Review job data structure
 */
export interface TechnologyReviewJobData {
  /** Technology ID */
  technologyId: string;
  /** User who triggered the review */
  userId: string;
  /** Database job ID for status tracking */
  dbJobId: string;
  /** Review mode */
  mode: 'quick' | 'deep';
  /** Optional: only review specific features */
  featureNames?: string[];
}

/**
 * Technology Review job result structure
 */
export interface TechnologyReviewJobResult {
  success: boolean;
  featuresReviewed: number;
  featuresImproved: number;
  featuresFlagged: number;
  overallConfidence: number;
  error?: string;
}

/**
 * Technology Review Queue
 *
 * Handles background deep review of technology features using AI + web search.
 */
let technologyReviewQueue: Queue<
  TechnologyReviewJobData,
  TechnologyReviewJobResult,
  string
> | null = null;

/**
 * Get or create the Technology Review queue
 */
export function getTechnologyReviewQueue(): Queue<
  TechnologyReviewJobData,
  TechnologyReviewJobResult,
  string
> {
  if (!technologyReviewQueue) {
    technologyReviewQueue = new Queue<TechnologyReviewJobData, TechnologyReviewJobResult, string>(
      QUEUE_NAMES.TECHNOLOGY_REVIEW,
      {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: 2,
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

    console.log('[BullMQ] Technology Review queue initialized');
  }

  return technologyReviewQueue;
}

/**
 * Add a technology review job to the queue
 */
export async function addTechnologyReviewJob(data: TechnologyReviewJobData) {
  const queue = getTechnologyReviewQueue();

  const job = await queue.add('process', data, {
    jobId: data.dbJobId,
  });

  console.log(`[BullMQ] Added technology review job ${job.id} for technology ${data.technologyId}`);

  return job;
}

/**
 * Get a technology review job by ID
 */
export async function getTechnologyReviewJob(jobId: string) {
  const queue = getTechnologyReviewQueue();
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

  if (qualificationScanQueue) {
    await qualificationScanQueue.close();
    qualificationScanQueue = null;
  }

  if (qualificationScanQueueEvents) {
    await qualificationScanQueueEvents.close();
    qualificationScanQueueEvents = null;
  }

  if (technologyReviewQueue) {
    await technologyReviewQueue.close();
    technologyReviewQueue = null;
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

// ============================================================================
// Backwards-compatible aliases (remove after full migration)
// ============================================================================

/** @deprecated Use addQualificationScanJob */
export const addLeadScanJob = addQualificationScanJob;
/** @deprecated Use getQualificationScanJob */
export const getLeadScanJob = getQualificationScanJob;
/** @deprecated Use getQualificationScanQueue */
export const getLeadScanQueue = getQualificationScanQueue;
/** @deprecated Use getQualificationScanQueueEvents */
export const getLeadScanQueueEvents = getQualificationScanQueueEvents;
