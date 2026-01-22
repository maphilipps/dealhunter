/**
 * Parse Utility Tests
 *
 * Tests for safe JSON parsing utilities:
 * - safeJsonParse
 * - safeJsonParseOrNull
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { safeJsonParse, safeJsonParseOrNull } from '../parse';

describe('Parse Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('safeJsonParse', () => {
    const fallbackValue = { error: 'fallback' };

    it('should parse valid JSON string', () => {
      const jsonString = '{"name":"test","value":123}';
      const result = safeJsonParse(jsonString, fallbackValue);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should return fallback for null value', () => {
      const result = safeJsonParse(null, fallbackValue);

      expect(result).toBe(fallbackValue);
    });

    it('should return fallback for undefined value', () => {
      const result = safeJsonParse(undefined, fallbackValue);

      expect(result).toBe(fallbackValue);
    });

    it('should return fallback for empty string', () => {
      const result = safeJsonParse('', fallbackValue);

      expect(result).toBe(fallbackValue);
    });

    it('should return fallback for invalid JSON', () => {
      const invalidJson = '{invalid json}';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = safeJsonParse(invalidJson, fallbackValue);

      expect(result).toBe(fallbackValue);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"name":"test",}';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = safeJsonParse(malformedJson, fallbackValue);

      expect(result).toBe(fallbackValue);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should parse arrays correctly', () => {
      const jsonArray = '[1,2,3,4,5]';
      const fallback: number[] = [];

      const result = safeJsonParse(jsonArray, fallback);

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse nested objects', () => {
      const nestedJson = '{"user":{"name":"test","age":30}}';
      const fallback = { user: null };

      const result = safeJsonParse(nestedJson, fallback);

      expect(result).toEqual({ user: { name: 'test', age: 30 } });
    });

    it('should parse boolean values', () => {
      const boolJson = 'true';
      const fallback = false;

      const result = safeJsonParse(boolJson, fallback);

      expect(result).toBe(true);
    });

    it('should parse null JSON value', () => {
      const nullJson = 'null';
      const fallback = 'default';

      const result = safeJsonParse(nullJson, fallback);

      expect(result).toBe(null);
    });
  });

  describe('safeJsonParseOrNull', () => {
    it('should parse valid JSON string', () => {
      const jsonString = '{"name":"test","value":123}';
      const result = safeJsonParseOrNull(jsonString);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should return null for null value', () => {
      const result = safeJsonParseOrNull(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined value', () => {
      const result = safeJsonParseOrNull(undefined);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = safeJsonParseOrNull('');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const invalidJson = '{invalid json}';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = safeJsonParseOrNull(invalidJson);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"name":"test",}';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = safeJsonParseOrNull(malformedJson);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should parse arrays correctly', () => {
      const jsonArray = '[1,2,3,4,5]';
      const result = safeJsonParseOrNull(jsonArray);

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse nested objects', () => {
      const nestedJson = '{"user":{"name":"test","age":30}}';
      const result = safeJsonParseOrNull(nestedJson);

      expect(result).toEqual({ user: { name: 'test', age: 30 } });
    });

    it('should parse boolean values', () => {
      const boolJson = 'true';
      const result = safeJsonParseOrNull(boolJson);

      expect(result).toBe(true);
    });

    it('should parse null JSON value', () => {
      const nullJson = 'null';
      const result = safeJsonParseOrNull(nullJson);

      expect(result).toBe(null);
    });

    it('should return null for truncated JSON', () => {
      const truncatedJson = '{"name":"test"';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = safeJsonParseOrNull(truncatedJson);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle numeric strings', () => {
      const numberJson = '123';
      const result = safeJsonParseOrNull(numberJson);

      expect(result).toBe(123);
    });

    it('should handle string values', () => {
      const stringJson = '"test string"';
      const result = safeJsonParseOrNull(stringJson);

      expect(result).toBe('test string');
    });
  });
});
