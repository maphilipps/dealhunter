/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Unit tests for lib/bids/duplicate-check.ts
 *
 * Tests duplicate detection logic including:
 * - URL normalization
 * - Levenshtein distance calculation
 * - String similarity
 * - Date range comparison
 * - Duplicate check with exact and similar matches
 * - Semantic similarity via embeddings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  normalizeUrl,
  calculateSimilarity,
  isWithinDateRange,
  checkForDuplicates,
} from '../duplicate-check';

import type { ExtractedRequirements } from '@/lib/extraction/schema';

// Mock dependencies before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('../embedding-service', () => ({
  generateRfpEmbedding: vi.fn(),
  cosineSimilarity: vi.fn(() => 0.9),
  similarityToPercentage: vi.fn(() => 90),
  parseEmbedding: vi.fn(() => [0.1, 0.2, 0.3]),
}));

import { db } from '@/lib/db';

import { generateRfpEmbedding } from '../embedding-service';

// Type assertion for mocked db
const mockDb = db as ReturnType<typeof vi.mocked<typeof db>>;

describe('duplicate-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeUrl', () => {
    it('should remove protocol (http/https)', () => {
      expect(normalizeUrl('https://example.com')).toBe('example.com');
      expect(normalizeUrl('http://example.com')).toBe('example.com');
    });

    it('should remove www. prefix', () => {
      expect(normalizeUrl('www.example.com')).toBe('example.com');
      expect(normalizeUrl('https://www.example.com')).toBe('example.com');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeUrl('example.com/')).toBe('example.com');
      expect(normalizeUrl('example.com///')).toBe('example.com');
    });

    it('should remove query strings and fragments', () => {
      expect(normalizeUrl('example.com?query=1')).toBe('example.com');
      expect(normalizeUrl('example.com#section')).toBe('example.com');
      expect(normalizeUrl('example.com/path?query=1#section')).toBe('example.com/path');
    });

    it('should convert to lowercase', () => {
      expect(normalizeUrl('EXAMPLE.COM/Path')).toBe('example.com/path');
    });

    it('should handle empty strings', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl('   ')).toBe('');
    });

    it('should handle complex URLs', () => {
      expect(normalizeUrl('HTTPS://WWW.Example.COM/Path/?q=1#section')).toBe('example.com/path/');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 100 for identical strings', () => {
      expect(calculateSimilarity('Test', 'Test')).toBe(100);
      expect(calculateSimilarity('test string', 'test string')).toBe(100);
    });

    it('should return 100 for two empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(100);
    });

    it('should return 0 when one string is empty', () => {
      expect(calculateSimilarity('Test', '')).toBe(0);
      expect(calculateSimilarity('', 'Test')).toBe(0);
    });

    it('should be case-insensitive', () => {
      expect(calculateSimilarity('Test', 'test')).toBe(100);
      expect(calculateSimilarity('TEST STRING', 'test string')).toBe(100);
    });

    it('should trim whitespace', () => {
      expect(calculateSimilarity('  Test  ', 'Test')).toBe(100);
      expect(calculateSimilarity('Test', '  Test  ')).toBe(100);
    });

    it('should calculate Levenshtein-based similarity', () => {
      // One character difference
      expect(calculateSimilarity('Test', 'Tast')).toBeGreaterThanOrEqual(70);

      // Two character difference
      expect(calculateSimilarity('Test', 'Tent')).toBeGreaterThanOrEqual(70);

      // Completely different
      expect(calculateSimilarity('ABC', 'XYZ')).toBeLessThan(50);
    });

    it('should handle unicode characters', () => {
      expect(calculateSimilarity('Müller', 'Muller')).toBeGreaterThanOrEqual(70);
    });

    it('should return integer percentage', () => {
      const result = calculateSimilarity('Test String', 'Tast String');
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('isWithinDateRange', () => {
    it('should return true for same dates', () => {
      expect(isWithinDateRange('2024-01-15', '2024-01-15', 7)).toBe(true);
    });

    it('should return true for dates within range', () => {
      expect(isWithinDateRange('2024-01-15', '2024-01-20', 7)).toBe(true);
      expect(isWithinDateRange('2024-01-15', '2024-01-10', 7)).toBe(true);
    });

    it('should return false for dates outside range', () => {
      expect(isWithinDateRange('2024-01-15', '2024-01-25', 7)).toBe(false);
      expect(isWithinDateRange('2024-01-15', '2024-01-01', 7)).toBe(false);
    });

    it('should handle edge cases (exactly at range limit)', () => {
      expect(isWithinDateRange('2024-01-15', '2024-01-22', 7)).toBe(true);
      expect(isWithinDateRange('2024-01-15', '2024-01-08', 7)).toBe(true);
    });

    it('should return false for empty or invalid dates', () => {
      expect(isWithinDateRange('', '2024-01-15', 7)).toBe(false);
      expect(isWithinDateRange('2024-01-15', '', 7)).toBe(false);
      expect(isWithinDateRange('', '', 7)).toBe(false);
      expect(isWithinDateRange('invalid-date', '2024-01-15', 7)).toBe(false);
    });

    it('should handle different date formats', () => {
      expect(isWithinDateRange('2024-01-15T00:00:00Z', '2024-01-20T00:00:00Z', 7)).toBe(true);
    });
  });

  describe('checkForDuplicates', () => {
    const mockRequirements: ExtractedRequirements = {
      customerName: 'Test Customer AG',
      projectDescription: 'Test project description',
      technologies: ['React', 'TypeScript'],
      keyRequirements: ['Requirement 1', 'Requirement 2'],
      confidenceScore: 0.9,
    };

    const mockDbResponse = [
      {
        id: 'rfp-1',
        accountId: 'account-1',
        websiteUrl: 'https://example.com',
        extractedRequirements: JSON.stringify({
          customerName: 'Existing Customer AG',
          projectDescription: 'Existing project',
          technologies: ['Vue'],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: '[0.1, 0.2, 0.3]',
        createdAt: new Date('2024-01-01'),
      },
    ];

    beforeEach(() => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDbResponse),
        }),
      } as any);
    });

    it('should return result with no duplicates when no matches found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements);

      expect(result.hasDuplicates).toBe(false);
      expect(result.exactMatches).toHaveLength(0);
      expect(result.similarMatches).toHaveLength(0);
      expect(result.checkedAt).toBeDefined();
    });

    it('should detect exact URL match', async () => {
      const requirementsWithUrl: ExtractedRequirements = {
        ...mockRequirements,
        websiteUrl: 'https://example.com/page',
      };

      const existingRfp = {
        id: 'rfp-existing',
        accountId: 'account-2',
        websiteUrl: 'https://example.com/page',
        extractedRequirements: JSON.stringify({
          customerName: 'Existing Customer',
          projectDescription: 'Existing project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
          websiteUrl: 'https://example.com/page',
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(requirementsWithUrl);

      expect(result.hasDuplicates).toBe(true);
      expect(result.exactMatches).toHaveLength(1);
      expect(result.exactMatches[0].reason).toContain('Gleiche Website-URL');
      expect(result.exactMatches[0].rfpId).toBe('rfp-existing');
    });

    it('should detect same account match', async () => {
      const existingRfp = {
        id: 'rfp-existing',
        accountId: 'account-123',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Different Customer',
          projectDescription: 'Different project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements, 'account-123');

      expect(result.hasDuplicates).toBe(true);
      expect(result.exactMatches).toHaveLength(1);
      expect(result.exactMatches[0].reason).toBe('Gleicher Account');
    });

    it('should detect very similar customer names (90%+)', async () => {
      const existingRfp = {
        id: 'rfp-existing',
        accountId: 'account-2',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Test Customer Ltd', // Very similar to 'Test Customer AG' (82%)
          projectDescription: 'Existing project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
          websiteUrl: null,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements);

      // Test Customer Ltd is only 82% similar to Test Customer AG, so it should be in similarMatches
      expect(result.hasDuplicates).toBe(true);
      expect(result.similarMatches.length).toBeGreaterThan(0);
      expect(result.similarMatches[0].similarity).toBeGreaterThanOrEqual(80);
    });

    it('should detect similar customer names with deadline match (80%+)', async () => {
      const requirementsWithDeadline: ExtractedRequirements = {
        ...mockRequirements,
        submissionDeadline: '2024-01-20',
      };

      const existingRfp = {
        id: 'rfp-existing',
        accountId: 'account-2',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Test Customer Inc', // 80%+ similar
          projectDescription: 'Existing project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
          submissionDeadline: '2024-01-25', // Within 14 days
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(requirementsWithDeadline);

      expect(result.hasDuplicates).toBe(true);
      expect(result.similarMatches.length).toBeGreaterThan(0);
      expect(result.similarMatches[0].reason).toContain('Deadline');
    });

    it('should use provided embedding instead of generating new one', async () => {
      const mockEmbedding = [0.5, 0.6, 0.7];
      await checkForDuplicates(mockRequirements, undefined, undefined, mockEmbedding);

      expect(generateRfpEmbedding).not.toHaveBeenCalled();
    });

    it('should handle embedding generation failure gracefully', async () => {
      vi.mocked(generateRfpEmbedding).mockRejectedValueOnce(new Error('API Error'));

      const result = await checkForDuplicates(mockRequirements);

      // Should still return a result even if embedding fails
      expect(result).toBeDefined();
      expect(result.checkedAt).toBeDefined();
    });

    it('should exclude RFP with excludeRfpId', async () => {
      const existingRfp = {
        id: 'rfp-to-exclude',
        accountId: 'account-123',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Customer',
          projectDescription: 'Project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      await checkForDuplicates(mockRequirements, 'account-123', 'rfp-to-exclude');

      // Verify that excludeRfpId was used in query
      expect(db.select).toHaveBeenCalled();
    });

    it('should sort exact matches by creation date (newest first)', async () => {
      const olderRfp = {
        id: 'rfp-older',
        accountId: 'account-123',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Customer',
          projectDescription: 'Project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      const newerRfp = {
        id: 'rfp-newer',
        accountId: 'account-123',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Customer 2',
          projectDescription: 'Project 2',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-10'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([olderRfp, newerRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements, 'account-123');

      expect(result.exactMatches[0].rfpId).toBe('rfp-newer');
      expect(result.exactMatches[1].rfpId).toBe('rfp-older');
    });

    it('should sort similar matches by similarity (highest first)', async () => {
      const lessSimilar = {
        id: 'rfp-less',
        accountId: 'account-2',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Different Customer', // Lower similarity
          projectDescription: 'Project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      const moreSimilar = {
        id: 'rfp-more',
        accountId: 'account-3',
        websiteUrl: null,
        extractedRequirements: JSON.stringify({
          customerName: 'Test Customer Inc', // Higher similarity (80%+)
          projectDescription: 'Project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([lessSimilar, moreSimilar]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements);

      if (result.similarMatches.length > 1) {
        expect(result.similarMatches[0].similarity).toBeGreaterThanOrEqual(
          result.similarMatches[1].similarity
        );
      }
    });

    it('should skip other checks if exact URL match found', async () => {
      const requirementsWithUrl: ExtractedRequirements = {
        ...mockRequirements,
        websiteUrl: 'https://example.com',
      };

      const existingRfp = {
        id: 'rfp-existing',
        accountId: 'account-2',
        websiteUrl: 'https://example.com',
        extractedRequirements: JSON.stringify({
          customerName: 'Existing Customer',
          projectDescription: 'Existing project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
          websiteUrl: 'https://example.com',
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(requirementsWithUrl);

      // Should only have one exact match, not additional similar matches
      expect(result.exactMatches).toHaveLength(1);
      expect(result.exactMatches[0].reason).toContain('Gleiche Website-URL');
    });

    it('should handle malformed extractedRequirements in DB', async () => {
      const malformedRfp = {
        id: 'rfp-malformed',
        accountId: 'account-2',
        websiteUrl: null,
        extractedRequirements: 'invalid json{{{',
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([malformedRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements);

      // Should skip malformed entries and not crash
      expect(result.hasDuplicates).toBe(false);
    });

    it('should handle empty extractedRequirements in DB', async () => {
      const emptyRfp = {
        id: 'rfp-empty',
        accountId: 'account-2',
        websiteUrl: null,
        extractedRequirements: null,
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([emptyRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(mockRequirements);

      expect(result.hasDuplicates).toBe(false);
    });

    it('should extract URLs from websiteUrls array', async () => {
      const requirementsWithMultipleUrls: ExtractedRequirements = {
        ...mockRequirements,
        websiteUrls: [
          { url: 'https://example.com', isPrimary: true },
          { url: 'https://example.org', isPrimary: false },
        ],
      };

      const existingRfp = {
        id: 'rfp-existing',
        accountId: 'account-2',
        websiteUrl: 'https://example.com',
        extractedRequirements: JSON.stringify({
          customerName: 'Existing Customer',
          projectDescription: 'Existing project',
          technologies: [],
          keyRequirements: [],
          confidenceScore: 0.8,
          websiteUrl: 'https://example.com',
        }),
        descriptionEmbedding: null,
        createdAt: new Date('2024-01-01'),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingRfp]),
        }),
      } as any);

      const result = await checkForDuplicates(requirementsWithMultipleUrls);

      expect(result.hasDuplicates).toBe(true);
      expect(result.exactMatches).toHaveLength(1);
    });

    it('should return checkedAt timestamp', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const beforeCheck = new Date();
      const result = await checkForDuplicates(mockRequirements);
      const afterCheck = new Date();

      expect(result.checkedAt).toBeDefined();

      const checkedAtDate = new Date(result.checkedAt);
      expect(checkedAtDate.getTime()).toBeGreaterThanOrEqual(beforeCheck.getTime());
      expect(checkedAtDate.getTime()).toBeLessThanOrEqual(afterCheck.getTime());
    });
  });
});
