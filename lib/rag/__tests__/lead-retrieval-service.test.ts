import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aggregateSources,
  batchQuerySections,
  calculateConfidenceScore,
  formatLeadContext,
  queryMultipleAgents,
  queryRagForLead,
  type LeadRAGResult,
} from '../lead-retrieval-service';

// Mock embedding service
vi.mock('../embedding-service', () => ({
  generateQueryEmbedding: vi.fn(),
}));

// Note: queryRAG is not used by the current implementation -
// queryRagForLead queries dealEmbeddings directly

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock navigation config
vi.mock('@/lib/leads/navigation-config', () => ({
  getRAGQueryTemplate: vi.fn(),
}));

import { generateQueryEmbedding } from '../embedding-service';

import { db } from '@/lib/db';
import { getRAGQueryTemplate } from '@/lib/leads/navigation-config';

describe('lead-retrieval-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateQueryEmbedding).mockResolvedValue(new Array(3072).fill(0.1));
  });

  describe('queryRagForLead', () => {
    it('should query dealEmbeddings directly by leadId', async () => {
      // Mock the chainable db.select().from().where() pattern
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'WordPress 6.0',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryRagForLead({
        leadId: 'lead-123',
        question: 'What is the current CMS?',
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('WordPress 6.0');
      expect(result[0].sources).toBeDefined();
      expect(result[0].sources[0].agentName).toBe('tech_agent');
    });

    it('should return empty array when no embeddings found', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryRagForLead({
        leadId: 'lead-nonexistent',
        question: 'Test',
      });

      expect(result).toEqual([]);
    });

    it('should use section RAG template when sectionId provided', async () => {
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'WordPress 6.0',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      vi.mocked(getRAGQueryTemplate).mockReturnValue(
        'What is the current technology stack including CMS, framework, hosting?'
      );

      await queryRagForLead({
        leadId: 'lead-123',
        sectionId: 'technology',
        question: '',
      });

      expect(getRAGQueryTemplate).toHaveBeenCalledWith('technology');
    });

    it('should filter by single agent name', async () => {
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Tech info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
        {
          id: 'chunk-2',
          leadId: 'lead-123',
          agentName: 'commercial_agent',
          chunkType: 'budget',
          content: 'Budget info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryRagForLead({
        leadId: 'lead-123',
        question: 'Test',
        agentNameFilter: 'tech_agent',
      });

      expect(result).toHaveLength(1);
      expect(result[0].agentName).toBe('tech_agent');
    });

    it('should filter by multiple agent names', async () => {
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Tech info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
        {
          id: 'chunk-2',
          leadId: 'lead-123',
          agentName: 'commercial_agent',
          chunkType: 'budget',
          content: 'Budget info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
        {
          id: 'chunk-3',
          leadId: 'lead-123',
          agentName: 'risk_agent',
          chunkType: 'risks',
          content: 'Risk info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryRagForLead({
        leadId: 'lead-123',
        question: 'Test',
        agentNameFilter: ['tech_agent', 'commercial_agent'],
      });

      expect(result).toHaveLength(2);
      expect(result.some(r => r.agentName === 'tech_agent')).toBe(true);
      expect(result.some(r => r.agentName === 'commercial_agent')).toBe(true);
      expect(result.some(r => r.agentName === 'risk_agent')).toBe(false);
    });

    it('should fallback to all results if agent filter yields no results', async () => {
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Tech info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryRagForLead({
        leadId: 'lead-123',
        question: 'Test',
        agentNameFilter: 'nonexistent_agent',
      });

      expect(result).toHaveLength(1);
      expect(result[0].agentName).toBe('tech_agent');
    });

    it('should handle errors gracefully', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('DB error'));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryRagForLead({
        leadId: 'lead-123',
        question: 'Test',
      });

      expect(result).toEqual([]);
    });
  });

  describe('batchQuerySections', () => {
    it('should query multiple sections in parallel', async () => {
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Tech info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      vi.mocked(getRAGQueryTemplate)
        .mockReturnValueOnce('Tech stack template')
        .mockReturnValueOnce('Budget template');

      const result = await batchQuerySections('lead-123', ['technology', 'costs']);

      expect(result.size).toBe(2);
      expect(result.has('technology')).toBe(true);
      expect(result.has('costs')).toBe(true);
      expect(result.get('technology')?.status).toBe('success');
    });

    it('should handle sections without RAG template', async () => {
      vi.mocked(getRAGQueryTemplate).mockReturnValue(undefined);

      const result = await batchQuerySections('lead-123', ['invalid-section']);

      expect(result.size).toBe(1);
      expect(result.get('invalid-section')?.status).toBe('error');
      expect(result.get('invalid-section')?.errorMessage).toContain('No RAG template found');
    });

    it('should calculate confidence scores for each section', async () => {
      const mockEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Tech info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      vi.mocked(getRAGQueryTemplate).mockReturnValue('Test template');

      const result = await batchQuerySections('lead-123', ['technology']);

      expect(result.get('technology')?.confidence).toBeGreaterThan(0);
    });

    it('should mark sections with no data', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      vi.mocked(getRAGQueryTemplate).mockReturnValue('Test template');

      const result = await batchQuerySections('lead-123', ['technology']);

      expect(result.get('technology')?.status).toBe('no_data');
      expect(result.get('technology')?.confidence).toBe(0);
    });
  });

  describe('queryMultipleAgents', () => {
    it('should query multiple agents in parallel', async () => {
      // This test returns all embeddings each time, and queryRagForLead filters by agentNameFilter
      const allEmbeddings = [
        {
          id: 'chunk-1',
          leadId: 'lead-123',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Tech info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
        {
          id: 'chunk-2',
          leadId: 'lead-123',
          agentName: 'commercial_agent',
          chunkType: 'budget',
          content: 'Budget info',
          embedding: JSON.stringify(new Array(3072).fill(0.1)),
          metadata: '{}',
          chunkCategory: null,
          confidence: null,
          validatedAt: null,
        },
      ];

      const mockWhere = vi.fn().mockResolvedValue(allEmbeddings);
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      const mockSelect = vi.fn(() => ({ from: mockFrom }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      const result = await queryMultipleAgents('lead-123', 'Test question', [
        'tech_agent',
        'commercial_agent',
      ]);

      expect(result.size).toBe(2);
      expect(result.has('tech_agent')).toBe(true);
      expect(result.has('commercial_agent')).toBe(true);
    });
  });

  describe('calculateConfidenceScore', () => {
    it('should return 0 for empty results', () => {
      const score = calculateConfidenceScore([]);
      expect(score).toBe(0);
    });

    it('should calculate score based on result count', () => {
      const mockResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
      ];

      const score = calculateConfidenceScore(mockResults);
      expect(score).toBeGreaterThan(0);
    });

    it('should give higher score for more results', () => {
      const fewResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
      ];

      const manyResults: LeadRAGResult[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          chunkId: `chunk-${i}`,
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        }));

      const scoreFew = calculateConfidenceScore(fewResults);
      const scoreMany = calculateConfidenceScore(manyResults);

      expect(scoreMany).toBeGreaterThan(scoreFew);
    });

    it('should give higher score for higher similarity', () => {
      const lowSimilarity: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.5,
          metadata: {},
          sources: [],
        },
      ];

      const highSimilarity: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.95,
          metadata: {},
          sources: [],
        },
      ];

      const scoreLow = calculateConfidenceScore(lowSimilarity);
      const scoreHigh = calculateConfidenceScore(highSimilarity);

      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    it('should give higher score for diverse agents', () => {
      const singleAgent: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
        {
          chunkId: 'chunk-2',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
      ];

      const multipleAgents: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
        {
          chunkId: 'chunk-2',
          agentName: 'commercial_agent',
          chunkType: 'budget',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
      ];

      const scoreSingle = calculateConfidenceScore(singleAgent);
      const scoreMultiple = calculateConfidenceScore(multipleAgents);

      expect(scoreMultiple).toBeGreaterThan(scoreSingle);
    });

    it('should cap score at 100', () => {
      const maxResults: LeadRAGResult[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          chunkId: `chunk-${i}`,
          agentName: `agent-${i}`,
          chunkType: 'test',
          content: 'Test',
          similarity: 1.0,
          metadata: {},
          sources: [],
        }));

      const score = calculateConfidenceScore(maxResults);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('aggregateSources', () => {
    it('should deduplicate sources by chunk ID', () => {
      const mockResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.9,
          metadata: {},
          sources: [
            {
              agentName: 'tech_agent',
              chunkId: 'chunk-1',
              chunkType: 'tech_stack',
              relevance: 0.9,
            },
          ],
        },
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.8,
          metadata: {},
          sources: [
            {
              agentName: 'tech_agent',
              chunkId: 'chunk-1',
              chunkType: 'tech_stack',
              relevance: 0.8,
            },
          ],
        },
      ];

      const sources = aggregateSources(mockResults);

      expect(sources).toHaveLength(1);
      expect(sources[0].relevance).toBe(0.9); // Keeps highest relevance
    });

    it('should sort sources by relevance descending', () => {
      const mockResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.8,
          metadata: {},
          sources: [
            {
              agentName: 'tech_agent',
              chunkId: 'chunk-1',
              chunkType: 'tech_stack',
              relevance: 0.8,
            },
          ],
        },
        {
          chunkId: 'chunk-2',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Test',
          similarity: 0.95,
          metadata: {},
          sources: [
            {
              agentName: 'tech_agent',
              chunkId: 'chunk-2',
              chunkType: 'tech_stack',
              relevance: 0.95,
            },
          ],
        },
      ];

      const sources = aggregateSources(mockResults);

      expect(sources[0].relevance).toBeGreaterThan(sources[1].relevance);
    });
  });

  describe('formatLeadContext', () => {
    it('should return empty string for empty results', () => {
      const result = formatLeadContext([]);
      expect(result).toBe('');
    });

    it('should format results without metadata by default', () => {
      const mockResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'WordPress 6.0',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
      ];

      const result = formatLeadContext(mockResults);

      expect(result).toContain('WordPress 6.0');
      expect(result).not.toContain('Agent:');
      expect(result).not.toContain('Type:');
    });

    it('should include metadata when requested', () => {
      const mockResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'WordPress 6.0',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
      ];

      const result = formatLeadContext(mockResults, true);

      expect(result).toContain('Agent: tech_agent');
      expect(result).toContain('Type: tech_stack');
      expect(result).toContain('Relevance: 90%');
      expect(result).toContain('WordPress 6.0');
    });

    it('should separate results with dividers', () => {
      const mockResults: LeadRAGResult[] = [
        {
          chunkId: 'chunk-1',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'First result',
          similarity: 0.9,
          metadata: {},
          sources: [],
        },
        {
          chunkId: 'chunk-2',
          agentName: 'tech_agent',
          chunkType: 'tech_stack',
          content: 'Second result',
          similarity: 0.8,
          metadata: {},
          sources: [],
        },
      ];

      const result = formatLeadContext(mockResults);

      expect(result).toContain('---');
    });
  });
});
