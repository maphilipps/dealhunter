import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const where = vi.fn();
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const generateQueryEmbedding = vi.fn();
  return { where, from, select, generateQueryEmbedding };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock('../embedding-service', () => ({
  generateQueryEmbedding: mocks.generateQueryEmbedding,
}));

import { queryRAG } from '../retrieval-service';

describe('queryRAG', () => {
  it('falls back to top-N when all similarities are below the threshold', async () => {
    mocks.generateQueryEmbedding.mockResolvedValue([1, 0]);

    mocks.where.mockResolvedValue([
      {
        id: 'a',
        agentName: 'agent_a',
        chunkType: 'facts',
        content: 'A',
        embedding: [0.6, 0.8],
        metadata: null,
      },
      {
        id: 'b',
        agentName: 'agent_b',
        chunkType: 'facts',
        content: 'B',
        embedding: [0.5, 0.8660254037844386],
        metadata: null,
      },
      {
        id: 'c',
        agentName: 'agent_c',
        chunkType: 'facts',
        content: 'C',
        embedding: [0.65, 0.7599342076785332],
        metadata: null,
      },
      {
        id: 'd',
        agentName: 'agent_d',
        chunkType: 'facts',
        content: 'D',
        embedding: [0.1, 0.99498743710662],
        metadata: null,
      },
      {
        id: 'ignored',
        agentName: 'agent_e',
        chunkType: 'facts',
        content: 'ignored',
        embedding: null,
        metadata: null,
      },
    ]);

    const results = await queryRAG({
      preQualificationId: 'prequal-1',
      question: 'budget',
      maxResults: 3,
    });

    expect(results).toHaveLength(3);
    expect(results.map(r => r.chunkId)).toEqual(['c', 'a', 'b']);
    expect(results[0]!.similarity).toBeGreaterThan(results[1]!.similarity);
    expect(results[1]!.similarity).toBeGreaterThan(results[2]!.similarity);
  });
});
