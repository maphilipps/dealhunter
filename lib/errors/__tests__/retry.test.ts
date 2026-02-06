/**
 * Unit tests for retry logic
 *
 * Tests automatic retry with exponential backoff, timeout handling, and retry strategies.
 * Target: 100% coverage (critical module)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  withRetry,
  sleep,
  createRetryWrapper,
  calculateMaxDelay,
  formatDuration,
  DEFAULT_RETRY_CONFIGS,
  type RetryConfig,
} from '../retry';

describe('Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withRetry - Success Cases', () => {
    it('returns success on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries transient errors and succeeds on second attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries transient errors and succeeds on third attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('withRetry - Failure Cases', () => {
    it('does not retry permanent errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Unauthorized: Invalid API key'));

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.error?.type).toBe('AUTHENTICATION_ERROR');
      expect(result.error?.category).toBe('permanent');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('stops after max attempts for transient errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error?.type).toBe('NETWORK_ERROR');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('returns error details on failure', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

      const promise = withRetry(fn, {
        maxAttempts: 2,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('RATE_LIMIT');
      expect(result.error?.category).toBe('transient');
      expect(result.error?.message).toContain('Rate limit');
    });
  });

  describe('Exponential Backoff', () => {
    it('uses exponential backoff between retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));
      const delays: number[] = [];

      const onRetryProgress = vi.fn((attempt: number, maxAttempts: number, delay: number) => {
        delays.push(delay);
      });

      const promise = withRetry(
        fn,
        {
          maxAttempts: 3,
          initialDelay: 100,
          backoffMultiplier: 2,
        },
        onRetryProgress
      );

      // Fast-forward through retries
      await vi.runAllTimersAsync();
      await promise;

      // Check that delays increase exponentially
      expect(delays).toEqual([100, 200]); // 100 * 2^0, 100 * 2^1
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not delay after last attempt', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));
      const delays: number[] = [];

      const onRetryProgress = vi.fn((attempt: number, maxAttempts: number, delay: number) => {
        delays.push(delay);
      });

      const promise = withRetry(
        fn,
        {
          maxAttempts: 2,
          initialDelay: 100,
          backoffMultiplier: 2,
        },
        onRetryProgress
      );

      await vi.runAllTimersAsync();
      await promise;

      // Only 1 delay (between 2 attempts)
      expect(delays).toEqual([100]);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Progress Callback', () => {
    it('calls onRetryProgress on each retry', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));
      const onRetryProgress = vi.fn();

      const promise = withRetry(
        fn,
        {
          maxAttempts: 3,
          initialDelay: 100,
          backoffMultiplier: 2,
        },
        onRetryProgress
      );

      await vi.runAllTimersAsync();
      await promise;

      expect(onRetryProgress).toHaveBeenCalledTimes(2); // 2 retries (3 attempts)
      expect(onRetryProgress).toHaveBeenNthCalledWith(1, 1, 3, 100); // attempt 1, max 3, delay 100ms
      expect(onRetryProgress).toHaveBeenNthCalledWith(2, 2, 3, 200); // attempt 2, max 3, delay 200ms
    });

    it('does not call onRetryProgress if not provided', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();

      // Should not throw
      await expect(promise).resolves.toBeDefined();
    });
  });

  describe('Duration Tracking', () => {
    it('tracks total duration', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const startTime = Date.now();
      vi.setSystemTime(startTime);

      const promise = withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      // Simulate 50ms execution
      vi.advanceTimersByTime(50);

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sleep', () => {
    it('waits for specified milliseconds', async () => {
      const promise = sleep(1000);

      vi.advanceTimersByTime(999);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      vi.advanceTimersByTime(1);
      await promise;

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('createRetryWrapper', () => {
    it('creates retry wrapper with agent-specific config', async () => {
      const retryWrapper = createRetryWrapper('extract');
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retryWrapper(fn);

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('uses correct config for duplicateCheck', async () => {
      const retryWrapper = createRetryWrapper('duplicateCheck');
      const fn = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = retryWrapper(fn);

      await vi.runAllTimersAsync();
      const result = await promise;

      // duplicateCheck config: maxAttempts=2
      expect(result.attempts).toBe(2);
    });

    it('uses correct config for qualificationScan', async () => {
      const retryWrapper = createRetryWrapper('qualificationScan');
      const fn = vi.fn().mockRejectedValue(new Error('Browser timeout'));

      const promise = retryWrapper(fn);

      await vi.runAllTimersAsync();
      const result = await promise;

      // qualificationScan config: maxAttempts=2
      expect(result.attempts).toBe(2);
    });
  });

  describe('calculateMaxDelay', () => {
    it('calculates total delay for 3 attempts', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      };

      const maxDelay = calculateMaxDelay(config);

      // Delays: 1000ms (2^0*1000), 2000ms (2^1*1000) = 3000ms total
      expect(maxDelay).toBe(3000);
    });

    it('calculates total delay for 2 attempts', () => {
      const config: RetryConfig = {
        maxAttempts: 2,
        initialDelay: 1000,
        backoffMultiplier: 2,
      };

      const maxDelay = calculateMaxDelay(config);

      // Delays: 1000ms (2^0*1000) = 1000ms total
      expect(maxDelay).toBe(1000);
    });

    it('returns 0 for 1 attempt (no retries)', () => {
      const config: RetryConfig = {
        maxAttempts: 1,
        initialDelay: 1000,
        backoffMultiplier: 2,
      };

      const maxDelay = calculateMaxDelay(config);

      expect(maxDelay).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(45000)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('DEFAULT_RETRY_CONFIGS', () => {
    it('has config for duplicateCheck', () => {
      expect(DEFAULT_RETRY_CONFIGS.duplicateCheck).toEqual({
        maxAttempts: 2,
        initialDelay: 1000,
        backoffMultiplier: 2,
      });
    });

    it('has config for extract', () => {
      expect(DEFAULT_RETRY_CONFIGS.extract).toEqual({
        maxAttempts: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
        timeoutMs: 30000,
      });
    });

    it('has config for qualificationScan', () => {
      expect(DEFAULT_RETRY_CONFIGS.qualificationScan).toEqual({
        maxAttempts: 2,
        initialDelay: 5000,
        backoffMultiplier: 2,
        timeoutMs: 120000,
      });
    });

    it('has config for timeline', () => {
      expect(DEFAULT_RETRY_CONFIGS.timeline).toEqual({
        maxAttempts: 2,
        initialDelay: 1000,
        backoffMultiplier: 2,
      });
    });
  });
});
