/**
 * Agent Error Wrapper
 *
 * Wraps agent functions with error handling and retry logic:
 * - Automatic retry for transient errors
 * - Error logging with structured data
 * - Performance metrics (duration, attempts)
 * - Fallback values for optional agents
 */

import { type ClassifiedError } from './classification';
import { withRetry, type RetryConfig, type AgentResult, DEFAULT_RETRY_CONFIGS } from './retry';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentName = 'DuplicateCheck' | 'Extract' | 'QuickScan' | 'Timeline';

export interface AgentError {
  id: string;
  agentName: AgentName;
  timestamp: string;
  errorType: ClassifiedError['type'];
  errorCategory: ClassifiedError['category'];
  errorMessage: string;
  errorDetails?: unknown;
  attempts: number;
  isResolved: boolean;
  userAction?: 'retry' | 'skip' | 'manual_input';
  resolvedAt?: string;
}

export interface ErrorHandlingOptions {
  agentName: AgentName;
  retryConfig?: RetryConfig;
  onRetryProgress?: (attempt: number, maxAttempts: number, delay: number) => void;
  fallbackValue?: unknown;
  logErrors?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap an agent function with error handling and retry logic
 *
 * Usage:
 * ```ts
 * const result = await withErrorHandling(
 *   () => extractRequirements(input),
 *   { agentName: 'Extract' }
 * );
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 *   // Save error to DB for UI display
 *   await saveAgentError(rfpId, result.error, result.attempts);
 * }
 * ```
 *
 * @param fn - Agent function to execute
 * @param options - Error handling options
 * @returns Agent result with success status, data/error, attempts, and duration
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: ErrorHandlingOptions
): Promise<AgentResult<T>> {
  const { agentName, retryConfig, onRetryProgress, fallbackValue, logErrors = true } = options;

  // Get default retry config for this agent if not provided
  const config =
    retryConfig ||
    DEFAULT_RETRY_CONFIGS[agentNameToConfigKey(agentName)] ||
    DEFAULT_RETRY_CONFIGS.extract;

  console.error(`[${agentName} Agent] Starting with retry config:`, config);

  // Execute with retry
  const result = await withRetry(fn, config, onRetryProgress);

  // Log error if failed
  if (!result.success && logErrors) {
    console.error(`[${agentName} Agent] Failed after ${result.attempts} attempts:`, result.error);
    console.error(`[${agentName} Agent] Duration: ${result.duration}ms`);
  }

  // Log success
  if (result.success && logErrors) {
    console.error(
      `[${agentName} Agent] Succeeded on attempt ${result.attempts} in ${result.duration}ms`
    );
  }

  // Return result with fallback if available
  if (!result.success && fallbackValue !== undefined) {
    console.error(`[${agentName} Agent] Using fallback value`);
    return {
      ...result,
      success: true,
      data: fallbackValue as T,
    };
  }

  return result;
}

/**
 * Create an AgentError object for database storage
 *
 * @param agentName - Name of the agent
 * @param classifiedError - Classified error from agent execution
 * @param attempts - Number of attempts made
 * @returns AgentError object for DB
 */
export function createAgentError(
  agentName: AgentName,
  classifiedError: ClassifiedError,
  attempts: number
): AgentError {
  return {
    id: generateErrorId(),
    agentName,
    timestamp: new Date().toISOString(),
    errorType: classifiedError.type,
    errorCategory: classifiedError.category,
    errorMessage: classifiedError.message,
    errorDetails: classifiedError.details,
    attempts,
    isResolved: false,
  };
}

/**
 * Create a resolved AgentError (used when user skips or manually fixes)
 *
 * @param error - Original error
 * @param userAction - Action taken by user
 * @returns Resolved AgentError
 */
export function resolveAgentError(
  error: AgentError,
  userAction: 'retry' | 'skip' | 'manual_input'
): AgentError {
  return {
    ...error,
    isResolved: true,
    userAction,
    resolvedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map AgentName to retry config key
 */
function agentNameToConfigKey(agentName: AgentName): keyof typeof DEFAULT_RETRY_CONFIGS {
  const mapping: Record<AgentName, keyof typeof DEFAULT_RETRY_CONFIGS> = {
    DuplicateCheck: 'duplicateCheck',
    Extract: 'extract',
    QuickScan: 'quickScan',
    Timeline: 'timeline',
  };

  return mapping[agentName];
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if an agent error is critical (blocks workflow)
 *
 * Extract Agent is critical - must succeed or have manual input
 * Other agents are optional - can skip
 */
export function isCriticalAgent(agentName: AgentName): boolean {
  return agentName === 'Extract';
}

/**
 * Check if an agent can be skipped
 *
 * QuickScan and Timeline can be skipped
 * Extract and DuplicateCheck cannot
 */
export function canSkipAgent(agentName: AgentName): boolean {
  return agentName === 'QuickScan' || agentName === 'Timeline';
}

/**
 * Get user-friendly agent display name
 */
export function getAgentDisplayName(agentName: AgentName): string {
  const names: Record<AgentName, string> = {
    DuplicateCheck: 'Duplicate Check',
    Extract: 'Extract',
    QuickScan: 'Quick Scan',
    Timeline: 'Timeline & PT Estimation',
  };

  return names[agentName];
}

/**
 * Format error for user display (strips technical details)
 */
export function formatErrorForUser(error: ClassifiedError): string {
  return error.message;
}

/**
 * Get next recommended status after agent failure
 *
 * @param agentName - Failed agent
 * @param currentStatus - Current RFP status
 * @returns Next status for failed state
 */
export function getFailedStatus(agentName: AgentName, currentStatus: string): string {
  const statusMap: Record<AgentName, string> = {
    DuplicateCheck: 'duplicate_check_failed',
    Extract: 'extraction_failed',
    QuickScan: 'quick_scan_failed',
    Timeline: 'timeline_failed',
  };

  return statusMap[agentName] || currentStatus;
}

/**
 * Get next status after skipping agent
 *
 * @param agentName - Skipped agent
 * @returns Next workflow status
 */
export function getSkipStatus(agentName: AgentName): string | null {
  const statusMap: Record<AgentName, string | null> = {
    DuplicateCheck: 'extracting', // Can skip duplicate check
    Extract: null, // Cannot skip extract
    QuickScan: 'questions_ready', // Skip to 10 questions
    Timeline: 'decision_made', // Skip to BL routing
  };

  return statusMap[agentName];
}
