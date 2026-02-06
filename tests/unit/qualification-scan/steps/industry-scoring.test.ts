import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  references: { status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockReturnValue('eq_condition'),
}));

vi.mock('@/lib/streaming/event-types', () => ({
  AgentEventType: {
    STEP_START: 'STEP_START',
    STEP_COMPLETE: 'STEP_COMPLETE',
    AGENT_COMPLETE: 'AGENT_COMPLETE',
    AGENT_PROGRESS: 'AGENT_PROGRESS',
  },
}));

import { industryScoringStep } from '@/lib/qualification-scan/workflow/steps/industry-scoring';
import type { IndustryScoringResult } from '@/lib/qualification-scan/workflow/steps/industry-scoring';
import type { WorkflowContext, BusinessUnit } from '@/lib/qualification-scan/workflow/types';
import type { CompanyIntelligence } from '@/lib/qualification-scan/schema';
import { db } from '@/lib/db';

function createMockContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    input: { url: 'https://example.com', preQualificationId: '1' } as any,
    emit: vi.fn(),
    results: new Map(),
    getResult: vi.fn(),
    fullUrl: 'https://example.com',
    ...overrides,
  };
}

const sampleBusinessUnits: BusinessUnit[] = [
  { name: 'Insurance', keywords: ['versicherung', 'insurance', 'fintech'] },
  { name: 'Automotive', keywords: ['automotive', 'auto', 'fahrzeug', 'mobility'] },
  { name: 'Healthcare', keywords: ['health', 'gesundheit', 'pharma', 'medical'] },
  { name: 'Retail', keywords: ['retail', 'handel', 'e-commerce', 'shop'] },
];

function createCompanyIntelligence(industry: string): CompanyIntelligence {
  return {
    basicInfo: {
      name: 'Test GmbH',
      industry,
      website: 'https://example.com',
    },
    dataQuality: {
      confidence: 80,
      sources: ['web'],
      lastUpdated: new Date().toISOString(),
    },
  } as CompanyIntelligence;
}

describe('industryScoringStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  describe('config', () => {
    it('should have correct step configuration', () => {
      expect(industryScoringStep.config.name).toBe('industryScoring');
      expect(industryScoringStep.config.phase).toBe('analysis');
      expect(industryScoringStep.config.optional).toBe(true);
      expect(industryScoringStep.config.dependencies).toContain('companyIntelligence');
      expect(industryScoringStep.config.dependencies).toContain('loadBusinessUnits');
    });
  });

  describe('industry matching', () => {
    it('should match industry to business units by keyword', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('Insurance & Fintech'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.industry).toBe('Insurance & Fintech');
      expect(result.matchedBusinessUnits.length).toBeGreaterThan(0);
      expect(result.matchedBusinessUnits[0].name).toBe('Insurance');
    });

    it('should match automotive industry', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('Automotive Manufacturing'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.matchedBusinessUnits.some(bu => bu.name === 'Automotive')).toBe(true);
    });

    it('should return empty matches for unknown industry', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('Space Exploration'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.matchedBusinessUnits).toHaveLength(0);
      expect(result.isCoreBranch).toBe(false);
    });

    it('should sort matches by score descending', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('insurance fintech retail'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      for (let i = 0; i < result.matchedBusinessUnits.length - 1; i++) {
        expect(result.matchedBusinessUnits[i].score).toBeGreaterThanOrEqual(
          result.matchedBusinessUnits[i + 1].score
        );
      }
    });
  });

  describe('isCoreBranch', () => {
    it('should be true when top match has score >= 3', async () => {
      const ctx = createMockContext();
      // 'insurance' exact match in keyword = 3 points
      const input = {
        companyIntelligence: createCompanyIntelligence('insurance'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.isCoreBranch).toBe(true);
    });

    it('should be false when no matches', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('alien technology'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.isCoreBranch).toBe(false);
    });
  });

  describe('null companyIntelligence', () => {
    it('should use "Unbekannt" when companyIntelligence is null', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: null,
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.industry).toBe('Unbekannt');
      expect(result.matchedBusinessUnits).toHaveLength(0);
    });
  });

  describe('reference counting', () => {
    it('should count matching references from DB', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { industry: 'Insurance', status: 'approved' },
            { industry: 'Automotive Insurance', status: 'approved' },
            { industry: 'Banking', status: 'approved' },
          ]),
        }),
      });

      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('Insurance'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      // "Insurance" matches "Insurance" and "Automotive Insurance"
      expect(result.referenceCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle DB error gracefully', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('Insurance'),
        loadBusinessUnits: sampleBusinessUnits,
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.referenceCount).toBe(0);
      // Should still return industry and matches
      expect(result.industry).toBe('Insurance');
    });
  });

  describe('empty business units', () => {
    it('should handle empty business units list', async () => {
      const ctx = createMockContext();
      const input = {
        companyIntelligence: createCompanyIntelligence('Insurance'),
        loadBusinessUnits: [],
      };

      const result = await industryScoringStep.execute(input, ctx);

      expect(result.matchedBusinessUnits).toHaveLength(0);
      expect(result.isCoreBranch).toBe(false);
    });
  });
});
