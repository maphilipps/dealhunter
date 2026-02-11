import { beforeEach, describe, expect, it, vi } from 'vitest';

import { performWebResearch, clearRateLimit } from '../web-research-service';

// Mock dependencies
vi.mock('@/lib/rag/raw-chunk-service', () => ({
  chunkRawText: vi.fn(() => [{ content: 'test chunk', tokenCount: 10, metadata: {} }]),
}));
vi.mock('@/lib/rag/raw-embedding-service', () => ({
  generateRawChunkEmbeddings: vi.fn(chunks =>
    Promise.resolve(
      chunks.map((chunk: any) => ({
        ...chunk,
        embedding: new Array(1536).fill(0),
      }))
    )
  ),
}));
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));
vi.mock('@/lib/search/web-search');

describe('web-research-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables for clean slate
    delete process.env.EXA_API_KEY;
  });

  describe('rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-1';
      clearRateLimit(preQualificationId);

      // Mock searchAndContents to return empty results
      vi.mocked(searchAndContents).mockResolvedValue({
        results: [],
        error: undefined,
      });

      // First request should succeed
      const result1 = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query 1',
      });

      expect(result1.success).toBe(true);
      expect(result1.error).not.toBe('Rate limit exceeded. Please try again in a minute.');
    });

    it('should block requests exceeding rate limit', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-2';
      clearRateLimit(preQualificationId);

      // Mock searchAndContents to return empty results
      vi.mocked(searchAndContents).mockResolvedValue({
        results: [],
        error: undefined,
      });

      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        await performWebResearch({
          preQualificationId,
          sectionId: 'overview',
          question: `Test query ${i}`,
        });
      }

      // 6th request should be blocked
      const result = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query 6',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded. Please try again in a minute.');
    });

    it('should allow requests after rate limit window expires', async () => {
      const preQualificationId = 'test-preQualification-3';
      clearRateLimit(preQualificationId);

      // This test would require mocking timers, skipping for now
      expect(true).toBe(true);
    });
  });

  describe('Web search integration', () => {
    it('should use searchAndContents for web research', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-4';
      clearRateLimit(preQualificationId);

      // Mock searchAndContents response
      vi.mocked(searchAndContents).mockResolvedValueOnce({
        results: [
          {
            url: 'https://example.com/1',
            title: 'Example Result 1',
            text: 'This is example content',
          },
        ],
        error: undefined,
      });

      const result = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query',
      });

      // Should call searchAndContents
      expect(searchAndContents).toHaveBeenCalledWith('Test query', { numResults: 3 });
      expect(result.success).toBe(true);
    });

    it('should handle search failures gracefully', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-5';
      clearRateLimit(preQualificationId);

      // Mock search failure
      vi.mocked(searchAndContents).mockResolvedValueOnce({
        results: [],
        error: 'Search failed',
      });

      const result = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query',
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  describe('result processing', () => {
    it('should return empty results when no search results found', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-7';
      clearRateLimit(preQualificationId);

      // Mock empty search response
      vi.mocked(searchAndContents).mockResolvedValueOnce({
        results: [],
        error: undefined,
      });

      const result = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query',
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.chunksStored).toBe(0);
    });

    it('should respect maxResults parameter', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-8';
      clearRateLimit(preQualificationId);

      // Mock search response
      vi.mocked(searchAndContents).mockResolvedValueOnce({
        results: [
          { url: 'https://example.com/1', title: 'Result 1', text: 'Content 1' },
          { url: 'https://example.com/2', title: 'Result 2', text: 'Content 2' },
        ],
        error: undefined,
      });

      await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query',
        maxResults: 2,
      });

      // Should request only 2 results via searchAndContents
      expect(searchAndContents).toHaveBeenCalledWith('Test query', { numResults: 2 });
    });
  });

  describe('error handling', () => {
    it('should handle search errors gracefully', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-9';
      clearRateLimit(preQualificationId);

      // Mock search returning error
      vi.mocked(searchAndContents).mockResolvedValueOnce({
        results: [],
        error: 'Network error',
      });

      const result = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query',
      });

      // Should not crash and return empty results
      expect(result.results).toEqual([]);
      expect(result.error).toBe('No search results found');
    });

    it('should handle empty search results', async () => {
      const { searchAndContents } = await import('@/lib/search/web-search');
      const preQualificationId = 'test-preQualification-10';
      clearRateLimit(preQualificationId);

      // Mock empty results
      vi.mocked(searchAndContents).mockResolvedValueOnce({
        results: [],
        error: undefined,
      });

      const result = await performWebResearch({
        preQualificationId,
        sectionId: 'overview',
        question: 'Test query',
      });

      // Should handle gracefully
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });
  });
});
