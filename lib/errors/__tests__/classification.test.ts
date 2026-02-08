/**
 * Unit tests for error classification
 *
 * Tests error categorization, type detection, and retry strategies.
 * Target: 100% coverage (critical module)
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

import {
  classifyError,
  isRetryableError,
  getUserFriendlyMessage,
  getRecommendedAction,
  type ErrorCategory,
} from '../classification';

describe('Error Classification', () => {
  describe('Network Errors → transient', () => {
    it('classifies ECONNREFUSED as transient', () => {
      const error = new Error('Network request failed');
      Object.assign(error, { cause: { code: 'ECONNREFUSED' } });

      const result = classifyError(error);

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies fetch failed as transient', () => {
      const error = new Error('fetch failed');

      const result = classifyError(error);

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies ENOTFOUND as transient', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');

      const result = classifyError(error);

      expect(result.type).toBe('NETWORK_ERROR');
      expect(result.category).toBe('transient');
    });
  });

  describe('Timeout Errors → transient', () => {
    it('classifies timeout as transient', () => {
      const error = new Error('Request timed out after 30000ms');

      const result = classifyError(error);

      expect(result.type).toBe('TIMEOUT');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies TimeoutError as transient', () => {
      const error = new Error('Operation timed out');
      error.name = 'TimeoutError';

      const result = classifyError(error);

      expect(result.type).toBe('TIMEOUT');
      expect(result.category).toBe('transient');
    });
  });

  describe('Rate Limiting → transient', () => {
    it('classifies rate limit as transient', () => {
      const error = new Error('Rate limit exceeded');

      const result = classifyError(error);

      expect(result.type).toBe('RATE_LIMIT');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies 429 status as transient', () => {
      const error = new Error('API returned 429 Too Many Requests');

      const result = classifyError(error);

      expect(result.type).toBe('RATE_LIMIT');
      expect(result.category).toBe('transient');
    });

    it('classifies too many requests as transient', () => {
      const error = new Error('too many requests');

      const result = classifyError(error);

      expect(result.type).toBe('RATE_LIMIT');
      expect(result.category).toBe('transient');
    });
  });

  describe('Authentication Errors → permanent', () => {
    it('classifies unauthorized as permanent', () => {
      const error = new Error('Unauthorized: Invalid API key');

      const result = classifyError(error);

      expect(result.type).toBe('AUTHENTICATION_ERROR');
      expect(result.category).toBe('permanent');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies 401 status as permanent', () => {
      const error = new Error('API returned 401');

      const result = classifyError(error);

      expect(result.type).toBe('AUTHENTICATION_ERROR');
      expect(result.category).toBe('permanent');
    });

    it('classifies 403 status as permanent', () => {
      const error = new Error('API returned 403 Forbidden');

      const result = classifyError(error);

      expect(result.type).toBe('AUTHENTICATION_ERROR');
      expect(result.category).toBe('permanent');
    });
  });

  describe('Validation Errors → permanent', () => {
    it('classifies Zod validation errors as permanent', () => {
      // Create a ZodError with a valid issue
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['customerName'],
          message: 'Expected string, received undefined',
        } as any,
      ]);

      const error = classifyError(zodError);

      expect(error.type).toBe('VALIDATION_ERROR');
      expect(error.category).toBe('permanent');
      expect(error.isRetryable).toBe(false);
      expect(error.message).toContain('Validation failed');
    });
  });

  describe('Missing Data Errors → user_fixable', () => {
    it('classifies missing required field as user_fixable', () => {
      const error = new Error('Missing required field: websiteUrl');

      const result = classifyError(error);

      expect(result.type).toBe('MISSING_DATA');
      expect(result.category).toBe('user_fixable');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies not found as user_fixable', () => {
      const error = new Error('URL not found in input');

      const result = classifyError(error);

      expect(result.type).toBe('MISSING_DATA');
      expect(result.category).toBe('user_fixable');
    });
  });

  describe('PDF Parsing Errors → permanent', () => {
    it('classifies PDF parsing failure as permanent', () => {
      const error = new Error('PDF parsing failed: file may be corrupted');

      const result = classifyError(error);

      expect(result.type).toBe('PDF_PARSING_ERROR');
      expect(result.category).toBe('permanent');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies parse error as permanent', () => {
      const error = new Error('Parse error in PDF extraction');

      const result = classifyError(error);

      expect(result.type).toBe('PDF_PARSING_ERROR');
      expect(result.category).toBe('permanent');
    });
  });

  describe('Browser Automation Errors → transient', () => {
    it('classifies Playwright error as transient', () => {
      const error = new Error('playwright: Target page closed');

      const result = classifyError(error);

      expect(result.type).toBe('BROWSER_AUTOMATION_ERROR');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies page.goto timeout as transient', () => {
      const error = new Error('page.goto: Timeout 30000ms exceeded');

      const result = classifyError(error);

      // Note: This matches TIMEOUT first, which is correct behavior
      expect(result.type).toBe('TIMEOUT');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies browser closed as transient', () => {
      const error = new Error('Browser has been closed');

      const result = classifyError(error);

      expect(result.type).toBe('BROWSER_AUTOMATION_ERROR');
      expect(result.category).toBe('transient');
    });
  });

  describe('API Errors', () => {
    it('classifies 5xx server errors as transient', () => {
      const error = new Error('API returned 503 Service Unavailable');

      const result = classifyError(error);

      expect(result.type).toBe('API_ERROR');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies 4xx client errors as permanent', () => {
      const error = new Error('API returned 400 Bad Request');

      const result = classifyError(error);

      expect(result.type).toBe('API_ERROR');
      expect(result.category).toBe('permanent');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies OpenAI API error as permanent by default', () => {
      const error = new Error('OpenAI API request failed');

      const result = classifyError(error);

      expect(result.type).toBe('API_ERROR');
      expect(result.category).toBe('permanent');
    });
  });

  describe('AI Empty Response Errors → transient (fallback-eligible)', () => {
    it('classifies AI_TypeValidationError as AI_EMPTY_RESPONSE', () => {
      const error = new Error('Type validation failed: Value: {"id":"..."}');
      error.name = 'AI_TypeValidationError';

      const result = classifyError(error);

      expect(result.type).toBe('AI_EMPTY_RESPONSE');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies missing choices array as AI_EMPTY_RESPONSE', () => {
      const error = new Error('"choices" — expected array, received undefined');

      const result = classifyError(error);

      expect(result.type).toBe('AI_EMPTY_RESPONSE');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies TypeValidationError in name as AI_EMPTY_RESPONSE', () => {
      const error = new Error('Validation failed');
      error.name = 'typevalidationerror';

      const result = classifyError(error);

      expect(result.type).toBe('AI_EMPTY_RESPONSE');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });

    it('classifies empty response message as AI_EMPTY_RESPONSE', () => {
      const error = new Error('AI model returned empty response');

      const result = classifyError(error);

      expect(result.type).toBe('AI_EMPTY_RESPONSE');
      expect(result.category).toBe('transient');
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('Unknown Errors → critical', () => {
    it('classifies unknown errors as critical', () => {
      const error = new Error('Something went terribly wrong');

      const result = classifyError(error);

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.category).toBe('critical');
      expect(result.isRetryable).toBe(false);
    });

    it('classifies non-Error objects as critical', () => {
      const error = { weird: 'object' };

      const result = classifyError(error);

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.category).toBe('critical');
    });

    it('classifies string errors as critical', () => {
      const error = 'plain string error';

      const result = classifyError(error);

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.category).toBe('critical');
    });
  });

  describe('isRetryableError', () => {
    it('returns true for transient errors', () => {
      expect(isRetryableError('transient')).toBe(true);
    });

    it('returns false for permanent errors', () => {
      expect(isRetryableError('permanent')).toBe(false);
    });

    it('returns false for user_fixable errors', () => {
      expect(isRetryableError('user_fixable')).toBe(false);
    });

    it('returns false for critical errors', () => {
      expect(isRetryableError('critical')).toBe(false);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('returns the error message', () => {
      const error = classifyError(new Error('Network request failed'));

      const message = getUserFriendlyMessage(error);

      expect(message).toBe('Network connection failed. Retrying...');
    });
  });

  describe('getRecommendedAction', () => {
    const testCases: Array<[ErrorCategory, string]> = [
      ['transient', 'retry'],
      ['user_fixable', 'manual_input'],
      ['permanent', 'skip'],
      ['critical', 'contact_support'],
    ];

    testCases.forEach(([category, expectedAction]) => {
      it(`returns ${expectedAction} for ${category} errors`, () => {
        const action = getRecommendedAction(category);
        expect(action).toBe(expectedAction);
      });
    });
  });
});
