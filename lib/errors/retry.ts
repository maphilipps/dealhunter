/**
 * Retry Logic with Exponential Backoff
 *
 * Implements automatic retry for transient errors with:
 * - Exponential backoff: delay increases exponentially (1s → 2s → 4s)
 * - Max attempts limit
 * - Only retries transient errors
 * - Performance tracking (duration, attempts)
 */

import { classifyError, isRetryableError, type ClassifiedError } from './classification';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  backoffMultiplier: number;
  timeoutMs?: number; // optional timeout per attempt
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: ClassifiedError;
  attempts: number;
  duration: number; // milliseconds
}

export type RetryProgressCallback = (attempt: number, maxAttempts: number, delay: number) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGS
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_RETRY_CONFIGS = {
  duplicateCheck: {
    maxAttempts: 2,
    initialDelay: 1000,
    backoffMultiplier: 2,
  },
  extract: {
    maxAttempts: 3,
    initialDelay: 2000,
    backoffMultiplier: 2,
    timeoutMs: 30000, // 30s initial, increases with retries
  },
  quickScan: {
    maxAttempts: 2,
    initialDelay: 5000,
    backoffMultiplier: 2,
    timeoutMs: 120000, // 120s initial (browser boot time)
  },
  timeline: {
    maxAttempts: 2,
    initialDelay: 1000,
    backoffMultiplier: 2,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a function with automatic retry on transient errors
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @param onRetryProgress - Optional callback for retry progress updates
 * @returns Result with success status, data/error, attempts, and duration
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetryProgress?: RetryProgressCallback
): Promise<AgentResult<T>> {
  let lastError: unknown;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Execute function with optional timeout
      const result = config.timeoutMs
        ? await executeWithTimeout(fn, getTimeoutForAttempt(config.timeoutMs, attempt))
        : await fn();

      return {
        success: true,
        data: result,
        attempts: attempt,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;
      const classifiedError = classifyError(error);

      console.error(
        `[Retry] Attempt ${attempt}/${config.maxAttempts} failed:`,
        classifiedError.type,
        classifiedError.message
      );

      // Permanent or critical error → stop immediately
      if (!isRetryableError(classifiedError.category)) {
        console.error('[Retry] Non-retryable error, stopping retries');
        return {
          success: false,
          error: classifiedError,
          attempts: attempt,
          duration: Date.now() - startTime,
        };
      }

      // Last attempt → stop retrying
      if (attempt >= config.maxAttempts) {
        console.error('[Retry] Max attempts reached, stopping retries');
        return {
          success: false,
          error: classifiedError,
          attempts: attempt,
          duration: Date.now() - startTime,
        };
      }

      // Calculate exponential backoff delay
      const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

      console.error(`[Retry] Waiting ${delay}ms before retry ${attempt + 1}...`);

      // Notify progress callback
      if (onRetryProgress) {
        onRetryProgress(attempt, config.maxAttempts, delay);
      }

      // Wait before next retry
      await sleep(delay);
    }
  }

  // Should never reach here, but handle just in case
  const classifiedError = classifyError(lastError);
  return {
    success: false,
    error: classifiedError,
    attempts: config.maxAttempts,
    duration: Date.now() - startTime,
  };
}

/**
 * Execute a function with timeout
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns Result or throws timeout error
 */
async function executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Get timeout for specific attempt (increases with retries)
 *
 * Attempt 1: base timeout
 * Attempt 2: base * 2
 * Attempt 3: base * 4
 */
function getTimeoutForAttempt(baseTimeout: number, attempt: number): number {
  return baseTimeout * Math.pow(2, attempt - 1);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a retry wrapper for a specific agent
 *
 * @param agentName - Name of the agent (for config lookup)
 * @returns Retry function with agent-specific config
 */
export function createRetryWrapper(
  agentName: keyof typeof DEFAULT_RETRY_CONFIGS
): <T>(fn: () => Promise<T>, onRetryProgress?: RetryProgressCallback) => Promise<AgentResult<T>> {
  const config = DEFAULT_RETRY_CONFIGS[agentName];

  return <T>(fn: () => Promise<T>, onRetryProgress?: RetryProgressCallback) =>
    withRetry(fn, config, onRetryProgress);
}

/**
 * Calculate total max delay for a retry config (for UI messaging)
 *
 * Example: maxAttempts=3, initialDelay=1000ms, backoff=2
 * → delays: [2000ms, 4000ms] → total 6000ms (6s)
 */
export function calculateMaxDelay(config: RetryConfig): number {
  let totalDelay = 0;

  for (let attempt = 1; attempt < config.maxAttempts; attempt++) {
    const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    totalDelay += delay;
  }

  return totalDelay;
}

/**
 * Format duration for user display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
