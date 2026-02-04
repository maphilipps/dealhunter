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

  // Checkpoint settings
  CHECKPOINT_INTERVAL_MS: 30 * 1000, // 30 seconds
  CHECKPOINT_RETENTION_HOURS: 72, // 3 days

  // Progress tracking
  PROGRESS_UPDATE_INTERVAL_MS: 2000,

  // Confidence thresholds
  CONFIDENCE_HIGH: 80,
  CONFIDENCE_MEDIUM: 60,
  CONFIDENCE_LOW: 40,

  // Activity log limits
  ACTIVITY_LOG_MAX_ENTRIES: 1000,
  ACTIVITY_LOG_RETENTION_DAYS: 30,
} as const;

// ====== Phase Weights (for progress calculation) ======

export const PHASE_WEIGHTS = {
  audit: 40,
  analysis: 35,
  generation: 25,
} as const;

// ====== Audit Module Weights ======

export const AUDIT_WEIGHTS = {
  tech_detection: 20,
  performance: 25,
  accessibility: 25,
  component_analysis: 20,
  seo: 5,
  security: 5,
} as const;

// ====== Expert Agent Configuration ======

export const EXPERT_AGENTS = {
  cms_agent: {
    name: 'CMS Expert',
    description: 'Analyzes CMS requirements and makes recommendations',
    weight: 30,
  },
  industry_agent: {
    name: 'Industry Expert',
    description: 'Evaluates industry-specific requirements',
    weight: 25,
  },
  migration_agent: {
    name: 'Migration Expert',
    description: 'Estimates migration complexity and effort',
    weight: 25,
  },
  ux_agent: {
    name: 'UX Expert',
    description: 'Analyzes user experience patterns',
    weight: 20,
  },
} as const;

// ====== Document Generation ======

export const DOCUMENT_CONFIG = {
  // Indication document sections
  INDICATION_SECTIONS: [
    'executive_summary',
    'current_state',
    'requirements',
    'recommendations',
    'migration_plan',
    'cost_estimate',
    'timeline',
    'risks',
  ] as const,

  // Storage settings
  STORAGE_PATH_PREFIX: 'deep-scan-v2/documents',
  PUBLIC_URL_EXPIRY_HOURS: 24,
} as const;

// ====== Error Codes ======

export const DEEP_SCAN_ERROR_CODES = {
  // Validation errors (4xx range)
  INVALID_URL: 'E4001',
  INVALID_QUALIFICATION: 'E4002',
  INVALID_CMS_IDS: 'E4003',
  RUN_NOT_FOUND: 'E4004',
  RUN_NOT_CANCELLABLE: 'E4005',
  RUN_NOT_RETRYABLE: 'E4006',

  // Processing errors (5xx range)
  AUDIT_FAILED: 'E5001',
  AGENT_FAILED: 'E5002',
  GENERATION_FAILED: 'E5003',
  CHECKPOINT_FAILED: 'E5004',
  STORAGE_FAILED: 'E5005',
  TIMEOUT: 'E5006',

  // External service errors (6xx range)
  WEBSITE_UNREACHABLE: 'E6001',
  AI_SERVICE_ERROR: 'E6002',
  DATABASE_ERROR: 'E6003',
} as const;

export type DeepScanErrorCode = (typeof DEEP_SCAN_ERROR_CODES)[keyof typeof DEEP_SCAN_ERROR_CODES];

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
} as const;
