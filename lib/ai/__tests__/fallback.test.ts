/**
 * Unit tests for model fallback functionality
 *
 * Tests the isFallbackEligibleError function and MODEL_FALLBACK_CONFIG.
 */

import { describe, it, expect } from 'vitest';

import { isFallbackEligibleError, MODEL_FALLBACK_CONFIG } from '../config';

describe('Model Fallback', () => {
  describe('isFallbackEligibleError', () => {
    it('returns true for AI_TypeValidationError', () => {
      const error = new Error('Type validation failed');
      error.name = 'AI_TypeValidationError';

      expect(isFallbackEligibleError(error)).toBe(true);
    });

    it('returns true for missing choices array error', () => {
      const error = new Error('"choices" — expected array, received undefined');

      expect(isFallbackEligibleError(error)).toBe(true);
    });

    it('returns true for typevalidationerror in lowercase', () => {
      const error = new Error('Validation failed');
      error.name = 'typevalidationerror';

      expect(isFallbackEligibleError(error)).toBe(true);
    });

    it('returns true for timeout errors', () => {
      const error = new Error('Request timed out after 60000ms');

      expect(isFallbackEligibleError(error)).toBe(true);
    });

    it('returns true for AbortError (timeout)', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';

      expect(isFallbackEligibleError(error)).toBe(true);
    });

    it('returns true for empty response errors', () => {
      const error = new Error('AI model returned empty response');

      expect(isFallbackEligibleError(error)).toBe(true);
    });

    it('returns false for network errors', () => {
      const error = new Error('Network request failed');

      expect(isFallbackEligibleError(error)).toBe(false);
    });

    it('returns false for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');

      expect(isFallbackEligibleError(error)).toBe(false);
    });

    it('returns false for authentication errors', () => {
      const error = new Error('Unauthorized: Invalid API key');

      expect(isFallbackEligibleError(error)).toBe(false);
    });

    it('returns false for non-Error objects', () => {
      expect(isFallbackEligibleError('string error')).toBe(false);
      expect(isFallbackEligibleError({ message: 'object error' })).toBe(false);
      expect(isFallbackEligibleError(null)).toBe(false);
      expect(isFallbackEligibleError(undefined)).toBe(false);
    });
  });

  describe('MODEL_FALLBACK_CONFIG', () => {
    it('has fallback for fast slot', () => {
      expect(MODEL_FALLBACK_CONFIG.fast).toBe('default');
    });

    it('has fallback for default slot', () => {
      expect(MODEL_FALLBACK_CONFIG.default).toBe('quality');
    });

    it('has fallback for quality slot', () => {
      expect(MODEL_FALLBACK_CONFIG.quality).toBe('premium');
    });

    it('has no fallback for premium slot', () => {
      expect(MODEL_FALLBACK_CONFIG.premium).toBeNull();
    });

    it('has no fallback for vision slot', () => {
      expect(MODEL_FALLBACK_CONFIG.vision).toBeNull();
    });

    it('has no fallback for embedding slot', () => {
      expect(MODEL_FALLBACK_CONFIG.embedding).toBeNull();
    });
  });
});
