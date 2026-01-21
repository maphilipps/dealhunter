import { describe, it, expect } from 'vitest';

/**
 * Unit tests for duplicate-check utility functions
 *
 * Testing pure utility functions without database dependencies
 */

// Helper functions extracted for testing (normally these would be exported or tested via public API)
function normalizeUrl(url: string): string {
  if (!url) return '';

  let normalized = url.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.split('?')[0].split('#')[0];

  return normalized;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

describe('normalizeUrl', () => {
  it('should remove protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('example.com');
    expect(normalizeUrl('http://example.com')).toBe('example.com');
  });

  it('should remove www prefix', () => {
    expect(normalizeUrl('https://www.example.com')).toBe('example.com');
    expect(normalizeUrl('www.example.com')).toBe('example.com');
  });

  it('should remove trailing slashes', () => {
    expect(normalizeUrl('https://example.com/')).toBe('example.com');
    expect(normalizeUrl('https://example.com///')).toBe('example.com');
  });

  it('should remove query strings and fragments', () => {
    expect(normalizeUrl('https://example.com?foo=bar')).toBe('example.com');
    expect(normalizeUrl('https://example.com#section')).toBe('example.com');
    expect(normalizeUrl('https://example.com/path?foo=bar#section')).toBe('example.com/path');
  });

  it('should convert to lowercase', () => {
    expect(normalizeUrl('HTTPS://EXAMPLE.COM')).toBe('example.com');
  });

  it('should handle empty string', () => {
    expect(normalizeUrl('')).toBe('');
  });
});

describe('levenshteinDistance', () => {
  it('should calculate distance for identical strings', () => {
    expect(levenshteinDistance('test', 'test')).toBe(0);
  });

  it('should calculate distance for completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('should calculate distance for single character difference', () => {
    expect(levenshteinDistance('test', 'text')).toBe(1);
  });

  it('should calculate distance for insertion', () => {
    expect(levenshteinDistance('test', 'tests')).toBe(1);
  });

  it('should calculate distance for deletion', () => {
    expect(levenshteinDistance('tests', 'test')).toBe(1);
  });

  it('should handle empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('test', '')).toBe(4);
    expect(levenshteinDistance('', 'test')).toBe(4);
  });
});

describe('calculateSimilarity', () => {
  it('should return 100 for identical strings', () => {
    expect(calculateSimilarity('Acme Corp', 'Acme Corp')).toBe(100);
  });

  it('should be case insensitive', () => {
    expect(calculateSimilarity('ACME CORP', 'acme corp')).toBe(100);
  });

  it('should return 0 for empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(100); // Both empty = identical
    expect(calculateSimilarity('test', '')).toBe(0);
    expect(calculateSimilarity('', 'test')).toBe(0);
  });

  it('should calculate high similarity for minor typos', () => {
    const similarity = calculateSimilarity('Acme Corporation', 'Acme Corporatoin');
    expect(similarity).toBeGreaterThan(90);
  });

  it('should calculate low similarity for different strings', () => {
    const similarity = calculateSimilarity('Acme Corp', 'XYZ Industries');
    expect(similarity).toBeLessThan(30);
  });

  it('should trim whitespace', () => {
    expect(calculateSimilarity('  Acme Corp  ', 'Acme Corp')).toBe(100);
  });
});
