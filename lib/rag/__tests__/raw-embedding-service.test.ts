import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RawChunk } from '../raw-chunk-service';
import {
  deleteRawChunks,
  embedRawText,
  generateRawChunkEmbeddings,
  getRawChunkCount,
  hasRawChunks,
} from '../raw-embedding-service';

// Mock embedding config
vi.mock('@/lib/ai/embedding-config', () => ({
  EMBEDDING_DIMENSIONS: 3072,
  isEmbeddingEnabled: vi.fn(async () => true),
  getEmbeddingApiOptions: vi.fn(async () => ({
    model: 'text-embedding-3-large',
    dimensions: 3072,
  })),
  getEmbeddingClient: vi.fn(async () => ({
    embeddings: {
      create: vi.fn(),
    },
  })),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
  },
}));

import {
  getEmbeddingApiOptions,
  getEmbeddingClient,
  isEmbeddingEnabled,
} from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';

describe('raw-embedding-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to enabled by default
    vi.mocked(isEmbeddingEnabled).mockResolvedValue(true);
  });

  describe('generateRawChunkEmbeddings', () => {
    it('should return empty array for empty input', async () => {
      const result = await generateRawChunkEmbeddings([]);
      expect(result).toEqual([]);
    });

    it('should return null when embeddings are disabled', async () => {
      vi.mocked(isEmbeddingEnabled).mockResolvedValue(true);
      vi.mocked(getEmbeddingClient).mockResolvedValue(null);

      const mockChunks: RawChunk[] = [
        {
          chunkIndex: 0,
          content: 'Test content',
          tokenCount: 100,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
      ];

      const result = await generateRawChunkEmbeddings(mockChunks);
      expect(result).toBeNull();
    });

    it('should generate embeddings for chunks', async () => {
      const mockChunks: RawChunk[] = [
        {
          chunkIndex: 0,
          content: 'Test content 1',
          tokenCount: 100,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
        {
          chunkIndex: 1,
          content: 'Test content 2',
          tokenCount: 150,
          metadata: { startPosition: 100, endPosition: 250, type: 'paragraph' },
        },
      ];

      const mockEmbedding = Array(3072).fill(0.1);
      const mockClient = {
        embeddings: {
          create: vi.fn().mockResolvedValue({
            data: [
              { embedding: mockEmbedding, index: 0 },
              { embedding: mockEmbedding, index: 1 },
            ],
            model: 'text-embedding-3-large',
            usage: { prompt_tokens: 10, total_tokens: 10 },
            object: 'list',
          }),
        },
      };
      vi.mocked(getEmbeddingClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof getEmbeddingClient>>
      );

      const result = await generateRawChunkEmbeddings(mockChunks);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].embedding).toEqual(mockEmbedding);
      expect(result![1].embedding).toEqual(mockEmbedding);
      expect(mockClient.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: ['Test content 1', 'Test content 2'],
        dimensions: 3072,
      });
    });

    it('should omit dimensions for non-OpenAI models', async () => {
      vi.mocked(getEmbeddingApiOptions).mockResolvedValue({
        model: 'intfloat/e5-mistral-7b-instruct',
      });

      const mockChunks: RawChunk[] = [
        {
          chunkIndex: 0,
          content: 'Test content',
          tokenCount: 100,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
      ];

      const mockEmbedding = Array(3072).fill(0.1);
      const mockClient = {
        embeddings: {
          create: vi.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding, index: 0 }],
            model: 'intfloat/e5-mistral-7b-instruct',
            usage: { prompt_tokens: 10, total_tokens: 10 },
            object: 'list',
          }),
        },
      };
      vi.mocked(getEmbeddingClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof getEmbeddingClient>>
      );

      const result = await generateRawChunkEmbeddings(mockChunks);

      expect(result).not.toBeNull();
      expect(mockClient.embeddings.create).toHaveBeenCalledWith({
        model: 'intfloat/e5-mistral-7b-instruct',
        input: ['Test content'],
      });
    });

    it('should return null on dimension mismatch', async () => {
      vi.mocked(getEmbeddingApiOptions).mockResolvedValue({
        model: 'intfloat/e5-mistral-7b-instruct',
      });

      const mockChunks: RawChunk[] = [
        {
          chunkIndex: 0,
          content: 'Test content',
          tokenCount: 100,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
      ];

      const wrongDimEmbedding = Array(1024).fill(0.1);
      const mockClient = {
        embeddings: {
          create: vi.fn().mockResolvedValue({
            data: [{ embedding: wrongDimEmbedding, index: 0 }],
            model: 'intfloat/e5-mistral-7b-instruct',
            usage: { prompt_tokens: 10, total_tokens: 10 },
            object: 'list',
          }),
        },
      };
      vi.mocked(getEmbeddingClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof getEmbeddingClient>>
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await generateRawChunkEmbeddings(mockChunks);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dimension mismatch: got 1024, expected 3072')
      );
      consoleSpy.mockRestore();
    });

    it('should batch large chunk arrays', async () => {
      // Create 2500 chunks (more than EMBEDDING_BATCH_SIZE of 2048)
      const mockChunks: RawChunk[] = Array(2500)
        .fill(null)
        .map((_, i) => ({
          chunkIndex: i,
          content: `Chunk ${i}`,
          tokenCount: 100,
          metadata: {
            startPosition: i * 100,
            endPosition: (i + 1) * 100,
            type: 'paragraph' as const,
          },
        }));

      const mockEmbedding = Array(3072).fill(0.1);
      const mockClient = {
        embeddings: {
          create: vi.fn().mockImplementation(({ input }) => ({
            data: input.map((_: string, i: number) => ({ embedding: mockEmbedding, index: i })),
            model: 'text-embedding-3-large',
            usage: { prompt_tokens: input.length, total_tokens: input.length },
            object: 'list',
          })),
        },
      };
      vi.mocked(getEmbeddingClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof getEmbeddingClient>>
      );

      const result = await generateRawChunkEmbeddings(mockChunks);

      // Should have been called twice (2048 + 452)
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2500);
    });
  });

  describe('embedRawText', () => {
    // Helper to mock pre-qualification existence check
    const mockPreQualExists = () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [{ id: 'preQualification-123' }]),
          })),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);
    };

    it('should return skipped when embeddings are disabled', async () => {
      vi.mocked(isEmbeddingEnabled).mockResolvedValue(false);
      mockPreQualExists();
      // Use longer text to ensure chunking happens
      const longText = 'Dies ist ein ausführlicher Text für das Embedding. '.repeat(10);

      const mockInsert = vi.fn(() => ({ values: vi.fn() }));
      const mockDelete = vi.fn(() => ({ where: vi.fn() }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.insert).mockImplementation(mockInsert as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.delete).mockImplementation(mockDelete as any);

      const result = await embedRawText('preQualification-123', longText);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.stats.totalChunks).toBeGreaterThanOrEqual(1);
    });

    it('should return success with zero chunks for empty text', async () => {
      mockPreQualExists();

      const result = await embedRawText('preQualification-123', '');

      expect(result.success).toBe(true);
      expect(result.stats.totalChunks).toBe(0);
    });

    it('should embed text and store in database', async () => {
      mockPreQualExists();
      const longText = 'Dies ist ein ausführlicher Projekttext mit allen Details. '.repeat(20);

      const mockEmbedding = Array(3072).fill(0.1);
      const mockClient = {
        embeddings: {
          create: vi.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding, index: 0 }],
            model: 'text-embedding-3-large',
            usage: { prompt_tokens: 100, total_tokens: 100 },
            object: 'list',
          }),
        },
      };
      vi.mocked(getEmbeddingClient).mockResolvedValue(
        mockClient as unknown as Awaited<ReturnType<typeof getEmbeddingClient>>
      );

      const mockInsert = vi.fn(() => ({ values: vi.fn() }));
      const mockDelete = vi.fn(() => ({ where: vi.fn() }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.insert).mockImplementation(mockInsert as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.delete).mockImplementation(mockDelete as any);

      const result = await embedRawText('preQualification-123', longText);

      expect(result.success).toBe(true);
      expect(result.stats.totalChunks).toBeGreaterThanOrEqual(1);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPreQualExists();
      vi.mocked(db.delete).mockImplementation((() => {
        throw new Error('Database error');
      }) as any);

      const result = await embedRawText('preQualification-123', 'Some text '.repeat(100));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('hasRawChunks', () => {
    it('should return false when no chunks exist', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => []),
          })),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await hasRawChunks('preQualification-123');
      expect(result).toBe(false);
    });

    it('should return true when chunks exist', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [{ id: 'chunk-1' }]),
          })),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await hasRawChunks('preQualification-123');
      expect(result).toBe(true);
    });
  });

  describe('getRawChunkCount', () => {
    it('should return correct count', async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ id: 'chunk-1' }, { id: 'chunk-2' }, { id: 'chunk-3' }]),
        })),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await getRawChunkCount('preQualification-123');
      expect(result).toBe(3);
    });
  });

  describe('deleteRawChunks', () => {
    it('should delete chunks for Qualification', async () => {
      const mockDelete = vi.fn(() => ({ where: vi.fn() }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.delete).mockImplementation(mockDelete as any);

      await deleteRawChunks('preQualification-123');

      expect(db.delete).toHaveBeenCalled();
    });
  });
});
