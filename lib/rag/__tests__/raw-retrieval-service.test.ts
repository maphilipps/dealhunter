import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCombinedContext,
  formatRAGContext,
  queryMultipleTopics,
  queryRawChunks,
  type RawRAGResult,
} from '../raw-retrieval-service';

// Mock embedding config
vi.mock('@/lib/ai/embedding-config', () => ({
  isEmbeddingEnabled: vi.fn(() => true),
  generateQueryEmbedding: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { generateQueryEmbedding, isEmbeddingEnabled } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';

describe('raw-retrieval-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEmbeddingEnabled).mockReturnValue(true);
  });

  describe('queryRawChunks', () => {
    it('should return empty array when embeddings are disabled', async () => {
      vi.mocked(isEmbeddingEnabled).mockReturnValue(false);

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Budget',
      });

      expect(result).toEqual([]);
      expect(generateQueryEmbedding).not.toHaveBeenCalled();
    });

    it('should return empty array when no chunks exist', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => []),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(Array(3072).fill(0.1));

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Budget',
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when query embedding fails', async () => {
      vi.mocked(generateQueryEmbedding).mockResolvedValue(null);

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Budget',
      });

      expect(result).toEqual([]);
    });

    it('should filter results by similarity threshold (>0.7)', async () => {
      // Create embeddings with different similarities
      // Similar vector (high dot product = high similarity)
      const similarEmbedding = Array(3072).fill(0.1);
      // Dissimilar vector (low dot product = low similarity)
      const dissimilarEmbedding = Array(3072).fill(-0.1);

      const mockChunks = [
        {
          id: 'chunk-1',
          rfpId: 'rfp-123',
          chunkIndex: 0,
          content: 'Budget: 100.000 EUR',
          tokenCount: 50,
          embedding: JSON.stringify(similarEmbedding),
          metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
          createdAt: new Date(),
        },
        {
          id: 'chunk-2',
          rfpId: 'rfp-123',
          chunkIndex: 1,
          content: 'Unrelated content',
          tokenCount: 50,
          embedding: JSON.stringify(dissimilarEmbedding),
          metadata: JSON.stringify({ startPosition: 100, endPosition: 200, type: 'paragraph' }),
          createdAt: new Date(),
        },
      ];

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => mockChunks),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(similarEmbedding);

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Budget',
      });

      // Only similar chunk should pass threshold
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].content).toBe('Budget: 100.000 EUR');
    });

    it('should sort results by similarity in descending order', async () => {
      // Create embeddings with varying similarities
      const baseEmbedding = Array(3072).fill(0);
      baseEmbedding[0] = 1;

      const highSimilar = [...baseEmbedding];
      highSimilar[0] = 0.95;

      const mediumSimilar = [...baseEmbedding];
      mediumSimilar[0] = 0.8;

      const mockChunks = [
        {
          id: 'chunk-1',
          preQualificationId: 'rfp-123',
          chunkIndex: 0,
          content: 'Medium similar',
          tokenCount: 50,
          embedding: JSON.stringify(mediumSimilar),
          metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
          createdAt: new Date(),
        },
        {
          id: 'chunk-2',
          preQualificationId: 'rfp-123',
          chunkIndex: 1,
          content: 'High similar',
          tokenCount: 50,
          embedding: JSON.stringify(highSimilar),
          metadata: JSON.stringify({ startPosition: 100, endPosition: 200, type: 'paragraph' }),
          createdAt: new Date(),
        },
      ];

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => mockChunks),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(baseEmbedding);

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Budget',
      });

      // Results should be sorted by similarity DESC
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].similarity).toBeGreaterThanOrEqual(result[i].similarity);
      }
    });

    it('should respect maxResults parameter', async () => {
      const similarEmbedding = Array(3072).fill(0.1);

      const mockChunks = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `chunk-${i}`,
          rfpId: 'rfp-123',
          chunkIndex: i,
          content: `Content ${i}`,
          tokenCount: 50,
          embedding: JSON.stringify(similarEmbedding),
          metadata: JSON.stringify({
            startPosition: i * 100,
            endPosition: (i + 1) * 100,
            type: 'paragraph',
          }),
          createdAt: new Date(),
        }));

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => mockChunks),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(similarEmbedding);

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Content',
        maxResults: 3,
      });

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(generateQueryEmbedding).mockRejectedValue(new Error('API error'));

      const result = await queryRawChunks({
        preQualificationId: 'rfp-123',
        question: 'Budget',
      });

      expect(result).toEqual([]);
    });
  });

  describe('queryMultipleTopics', () => {
    it('should return empty maps when embeddings are disabled', async () => {
      vi.mocked(isEmbeddingEnabled).mockReturnValue(false);

      const result = await queryMultipleTopics('rfp-123', [
        { topic: 'Budget', maxResults: 3 },
        { topic: 'Kontakt', maxResults: 2 },
      ]);

      expect(result.has('Budget')).toBe(true);
      expect(result.has('Kontakt')).toBe(true);
      expect(result.get('Budget')).toEqual([]);
      expect(result.get('Kontakt')).toEqual([]);
    });

    it('should query multiple topics in parallel', async () => {
      const similarEmbedding = Array(3072).fill(0.1);

      const mockChunks = [
        {
          id: 'chunk-1',
          rfpId: 'rfp-123',
          chunkIndex: 0,
          content: 'Budget info',
          tokenCount: 50,
          embedding: JSON.stringify(similarEmbedding),
          metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
          createdAt: new Date(),
        },
      ];

      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => mockChunks),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(similarEmbedding);

      const result = await queryMultipleTopics('rfp-123', [
        { topic: 'Budget', maxResults: 3 },
        { topic: 'Kontakt', maxResults: 2 },
      ]);

      expect(result.has('Budget')).toBe(true);
      expect(result.has('Kontakt')).toBe(true);
    });
  });

  describe('formatRAGContext', () => {
    it('should return empty string for empty results', () => {
      const result = formatRAGContext([]);
      expect(result).toBe('');
    });

    it('should format results with similarity scores', () => {
      const mockResults: RawRAGResult[] = [
        {
          chunkId: 'chunk-1',
          chunkIndex: 0,
          content: 'Budget: 100.000 EUR',
          similarity: 0.85,
          tokenCount: 50,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
        {
          chunkId: 'chunk-2',
          chunkIndex: 1,
          content: 'Deadline: Q3 2024',
          similarity: 0.72,
          tokenCount: 40,
          metadata: { startPosition: 100, endPosition: 200, type: 'paragraph' },
        },
      ];

      const result = formatRAGContext(mockResults, 'Budget Information');

      expect(result).toContain('### Budget Information');
      expect(result).toContain('Budget: 100.000 EUR');
      expect(result).toContain('Deadline: Q3 2024');
      expect(result).toContain('[Relevanz: 85%]');
      expect(result).toContain('[Relevanz: 72%]');
    });

    it('should work without label', () => {
      const mockResults: RawRAGResult[] = [
        {
          chunkId: 'chunk-1',
          chunkIndex: 0,
          content: 'Test content',
          similarity: 0.9,
          tokenCount: 50,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
      ];

      const result = formatRAGContext(mockResults);

      expect(result).not.toContain('###');
      expect(result).toContain('Test content');
    });
  });

  describe('buildCombinedContext', () => {
    it('should combine multiple topic results', () => {
      const topicResults = new Map<string, RawRAGResult[]>();

      topicResults.set('Budget', [
        {
          chunkId: 'chunk-1',
          chunkIndex: 0,
          content: 'Budget: 100k EUR',
          similarity: 0.9,
          tokenCount: 50,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
      ]);

      topicResults.set('Kontakt', [
        {
          chunkId: 'chunk-2',
          chunkIndex: 1,
          content: 'Email: test@test.de',
          similarity: 0.8,
          tokenCount: 40,
          metadata: { startPosition: 100, endPosition: 200, type: 'paragraph' },
        },
      ]);

      const result = buildCombinedContext(topicResults);

      expect(result).toContain('### Budget');
      expect(result).toContain('Budget: 100k EUR');
      expect(result).toContain('### Kontakt');
      expect(result).toContain('Email: test@test.de');
    });

    it('should skip empty topic results', () => {
      const topicResults = new Map<string, RawRAGResult[]>();

      topicResults.set('Budget', [
        {
          chunkId: 'chunk-1',
          chunkIndex: 0,
          content: 'Budget: 100k EUR',
          similarity: 0.9,
          tokenCount: 50,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
      ]);

      topicResults.set('EmptyTopic', []);

      const result = buildCombinedContext(topicResults);

      expect(result).toContain('### Budget');
      expect(result).not.toContain('### EmptyTopic');
    });
  });
});
