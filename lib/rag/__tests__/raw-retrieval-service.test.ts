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
  isEmbeddingEnabled: vi.fn(async () => true),
  generateQueryEmbedding: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

import { generateQueryEmbedding, isEmbeddingEnabled } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';

describe('raw-retrieval-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEmbeddingEnabled).mockResolvedValue(true);
  });

  describe('queryRawChunks', () => {
    it('should use keyword fallback when embeddings are disabled', async () => {
      vi.mocked(isEmbeddingEnabled).mockResolvedValue(false);

      const mockChunks = [
        {
          id: 'chunk-1',
          preQualificationId: 'preQualification-123',
          chunkIndex: 0,
          content: 'Budget: 100.000 EUR für das Projekt',
          tokenCount: 50,
          embedding: Array(3072).fill(0),
          metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
          createdAt: new Date(),
        },
        {
          id: 'chunk-2',
          preQualificationId: 'preQualification-123',
          chunkIndex: 1,
          content: 'Unrelated content about nothing',
          tokenCount: 50,
          embedding: Array(3072).fill(0),
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

      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Budget Projekt',
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].content).toContain('Budget');
      expect(generateQueryEmbedding).not.toHaveBeenCalled();
    });

    it('should return empty array when no chunks exist', async () => {
      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => []),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(Array(3072).fill(0.1));

      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Budget',
      });

      expect(result).toEqual([]);
    });

    it('should use keyword fallback when query embedding fails', async () => {
      vi.mocked(generateQueryEmbedding).mockResolvedValue(null);

      const mockChunks = [
        {
          id: 'chunk-1',
          preQualificationId: 'preQualification-123',
          chunkIndex: 0,
          content: 'Budget: 100.000 EUR für das Projekt',
          tokenCount: 50,
          embedding: Array(3072).fill(0),
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

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Budget Projekt',
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].content).toContain('Budget');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query embedding failed, falling back to keyword matching')
      );
      consoleSpy.mockRestore();
    });

    it('should filter results by similarity threshold', async () => {
      const queryEmbedding = Array(3072).fill(0.1);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(queryEmbedding);

      // The SQL query applies the threshold in WHERE, so only "similar" rows are returned.
      vi.mocked(db.execute).mockResolvedValue({
        rows: [
          {
            id: 'chunk-1',
            chunk_index: 0,
            content: 'Budget: 100.000 EUR',
            token_count: 50,
            metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
            similarity: 0.85,
          },
        ],
      } as never);

      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Budget',
      });

      // Only similar chunk should pass threshold
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].content).toBe('Budget: 100.000 EUR');
    });

    it('should sort results by similarity in descending order', async () => {
      const queryEmbedding = Array(3072).fill(0.1);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(queryEmbedding);

      vi.mocked(db.execute).mockResolvedValue({
        rows: [
          {
            id: 'chunk-2',
            chunk_index: 1,
            content: 'High similar',
            token_count: 50,
            metadata: JSON.stringify({ startPosition: 100, endPosition: 200, type: 'paragraph' }),
            similarity: 0.9,
          },
          {
            id: 'chunk-1',
            chunk_index: 0,
            content: 'Medium similar',
            token_count: 50,
            metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
            similarity: 0.8,
          },
        ],
      } as never);

      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Budget',
      });

      // Results should be sorted by similarity DESC
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].similarity).toBeGreaterThanOrEqual(result[i].similarity);
      }
    });

    it('should respect maxResults parameter', async () => {
      const queryEmbedding = Array(3072).fill(0.1);
      vi.mocked(generateQueryEmbedding).mockResolvedValue(queryEmbedding);

      vi.mocked(db.execute).mockResolvedValue({
        rows: Array.from({ length: 3 }).map((_, i) => ({
          id: `chunk-${i}`,
          chunk_index: i,
          content: `Content ${i}`,
          token_count: 50,
          metadata: JSON.stringify({
            startPosition: i * 100,
            endPosition: (i + 1) * 100,
            type: 'paragraph',
          }),
          similarity: 0.5,
        })),
      } as never);

      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Content',
        maxResults: 3,
      });

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(generateQueryEmbedding).mockRejectedValue(new Error('API error'));

      const result = await queryRawChunks({
        preQualificationId: 'preQualification-123',
        question: 'Budget',
      });

      expect(result).toEqual([]);
    });
  });

  describe('queryMultipleTopics', () => {
    it('should use keyword fallback when embeddings are disabled', async () => {
      vi.mocked(isEmbeddingEnabled).mockResolvedValue(false);

      const mockChunks = [
        {
          id: 'chunk-1',
          preQualificationId: 'preQualification-123',
          chunkIndex: 0,
          content: 'Budget: 100.000 EUR für das Projekt',
          tokenCount: 50,
          embedding: Array(3072).fill(0),
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

      const result = await queryMultipleTopics('preQualification-123', [
        { topic: 'Budget Projekt', maxResults: 3 },
        { topic: 'Kontakt Email', maxResults: 2 },
      ]);

      expect(result.has('Budget Projekt')).toBe(true);
      expect(result.has('Kontakt Email')).toBe(true);
      // Budget keyword matches, so should return results
      const budgetResults = result.get('Budget Projekt')!;
      expect(budgetResults.length).toBeGreaterThanOrEqual(1);
    });

    it('should query multiple topics in parallel', async () => {
      const similarEmbedding = Array(3072).fill(0.1);

      vi.mocked(generateQueryEmbedding).mockResolvedValue(similarEmbedding);
      vi.mocked(db.execute).mockResolvedValue({
        rows: [
          {
            id: 'chunk-1',
            chunk_index: 0,
            content: 'Budget info',
            token_count: 50,
            metadata: JSON.stringify({ startPosition: 0, endPosition: 100, type: 'paragraph' }),
            similarity: 0.7,
          },
        ],
      } as never);

      const result = await queryMultipleTopics('preQualification-123', [
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
