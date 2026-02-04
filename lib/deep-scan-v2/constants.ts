/**
 * Deep Scan v2 Constants
 *
 * Configuration values and magic numbers for the Deep Scan pipeline.
 */

// ====== Pipeline Configuration ======

export const DEEP_SCAN_V2_CONFIG = {
  // Queue settings
  QUEUE_NAME: 'deep-scan-v2',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  JOB_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes

  // Activity log limits
  ACTIVITY_LOG_MAX_ENTRIES: 1000,
} as const;

// ====== Status Transitions ======

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'cancelled', 'failed'],
  running: ['audit_complete', 'waiting_for_user', 'failed', 'cancelled'],
  audit_complete: ['generating', 'waiting_for_user', 'failed', 'cancelled'],
  generating: ['review', 'completed', 'failed', 'cancelled'],
  waiting_for_user: ['running', 'cancelled'],
  review: ['completed', 'cancelled'],
  completed: [], // Terminal state
  failed: ['pending'], // Can retry
  cancelled: [], // Terminal state
};

// ====== Tool Names (for Agent Registry) ======

export const DEEP_SCAN_TOOL_NAMES = {
  TRIGGER: 'scan.deepscan.trigger',
  STATUS: 'scan.deepscan.status',
  RESULT: 'scan.deepscan.result',
  CANCEL: 'scan.deepscan.cancel',
  DELETE: 'scan.deepscan.delete',
  RETRY: 'scan.deepscan.retry',
  ACTIVITY: 'scan.deepscan.activity',
  LIST: 'scan.deepscan.list',
  ANSWER: 'scan.deepscan.answer',
} as const;
