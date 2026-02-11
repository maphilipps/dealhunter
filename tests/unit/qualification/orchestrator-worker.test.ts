import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const runPreQualSectionAgent = vi.fn(async () => ({
    success: false,
    error: 'section failed',
  }));
  const queryRawChunks = vi.fn(async () => []);
  const generateEmbeddingsWithConcurrency = vi.fn(async (texts: string[]) => texts.map(() => null));
  const where = vi.fn(async () => undefined);
  const values = vi.fn(async () => undefined);
  const db = {
    delete: vi.fn(() => ({ where })),
    insert: vi.fn(() => ({ values })),
    select: vi.fn(),
  };

  return {
    runPreQualSectionAgent,
    queryRawChunks,
    generateEmbeddingsWithConcurrency,
    where,
    values,
    db,
  };
});

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (left: unknown, right: unknown) => ({ eq: [left, right] }),
  sql: (...args: unknown[]) => ({ sql: args }),
}));

vi.mock('@/lib/json-render/prequal-section-agent', () => ({
  runPreQualSectionAgent: mocks.runPreQualSectionAgent,
}));

vi.mock('@/lib/rag/raw-retrieval-service', () => ({
  queryRawChunks: mocks.queryRawChunks,
  formatRAGContext: vi.fn(() => ''),
}));

vi.mock('@/lib/qualifications/sections/section-utils', () => ({
  generateEmbeddingsWithConcurrency: mocks.generateEmbeddingsWithConcurrency,
}));

vi.mock('@/lib/json-render/prequal-visualization-utils', () => ({
  buildSourcesFromRawChunks: vi.fn(() => []),
  injectSourcesPanel: vi.fn(tree => tree),
}));

vi.mock('@/lib/db', () => ({
  db: mocks.db,
}));

vi.mock('@/lib/db/schema', () => ({
  dealEmbeddings: {
    preQualificationId: 'preQualificationId',
    chunkType: 'chunkType',
    agentName: 'agentName',
    metadata: 'metadata',
  },
}));

import {
  runPreQualSectionOrchestrator,
  SECTION_IDS,
} from '@/lib/qualification/orchestrator-worker';

describe('runPreQualSectionOrchestrator', () => {
  it('retries sections even when the initial execution failed', async () => {
    const result = await runPreQualSectionOrchestrator('prequal-1', {
      skipPlanning: true,
      enableEvaluation: true,
      maxRetries: 1,
      maxConcurrency: 1,
    });

    expect(result.success).toBe(false);
    expect(result.failedSections).toHaveLength(SECTION_IDS.length);
    expect(mocks.runPreQualSectionAgent).toHaveBeenCalledTimes(SECTION_IDS.length * 2);
  });
});
