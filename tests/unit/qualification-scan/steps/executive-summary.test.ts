import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/streaming/event-types', () => ({
  AgentEventType: {
    STEP_START: 'STEP_START',
    STEP_COMPLETE: 'STEP_COMPLETE',
    AGENT_COMPLETE: 'AGENT_COMPLETE',
    AGENT_PROGRESS: 'AGENT_PROGRESS',
  },
}));

const mockGenerateStructuredOutput = vi.fn();
vi.mock('@/lib/ai/config', () => ({
  generateStructuredOutput: (...args: any[]) => mockGenerateStructuredOutput(...args),
}));

import {
  executiveSummaryStep,
  executiveSummarySchema,
} from '@/lib/qualification-scan/workflow/steps/executive-summary';
import type { ExecutiveSummary } from '@/lib/qualification-scan/workflow/steps/executive-summary';
import type { WorkflowContext } from '@/lib/qualification-scan/workflow/types';
import type {
  BLRecommendation,
  TechStack,
  ContentVolume,
  Features,
} from '@/lib/qualification-scan/schema';

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

const sampleExecutiveSummary: ExecutiveSummary = {
  blRecommendation: 'Digital Experience',
  blConfidence: 85,
  budgetRange: { min: 100000, max: 250000, confidence: 70 },
  tShirtSize: 'M',
  goNoGoScore: 78,
  topRisks: [
    { title: 'Migration complexity', severity: 'medium', description: 'CMS migration from legacy' },
  ],
  opportunities: ['AI-powered content migration', 'Modern CMS platform'],
  oneLiner: 'Mittelgroßes Digital-Experience-Projekt mit CMS-Migration',
};

function createInput() {
  return {
    recommendBusinessLine: {
      primaryBusinessLine: 'Digital Experience',
      confidence: 85,
      reasoning: 'CMS relaunch project',
      alternativeBusinessLines: [],
      requiredSkills: ['Drupal', 'React'],
    } as BLRecommendation,
    techStack: { cms: 'WordPress', framework: 'jQuery' } as TechStack,
    contentVolume: { estimatedPageCount: 150 } as ContentVolume,
    features: {
      ecommerce: false,
      userAccounts: false,
      search: true,
      multiLanguage: true,
      blog: true,
      forms: true,
      api: false,
      mobileApp: false,
      customFeatures: [],
    } as Features,
    loadBusinessUnits: [{ name: 'Digital Experience', keywords: ['cms', 'web'] }],
  };
}

describe('executiveSummaryStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateStructuredOutput.mockResolvedValue(sampleExecutiveSummary);
  });

  describe('config', () => {
    it('should have correct step configuration', () => {
      expect(executiveSummaryStep.config.name).toBe('executiveSummary');
      expect(executiveSummaryStep.config.phase).toBe('synthesis');
      expect(executiveSummaryStep.config.optional).toBe(false);
      expect(executiveSummaryStep.config.dependencies).toContain('recommendBusinessLine');
      expect(executiveSummaryStep.config.dependencies).toContain('techStack');
      expect(executiveSummaryStep.config.dependencies).toContain('contentVolume');
      expect(executiveSummaryStep.config.dependencies).toContain('features');
      expect(executiveSummaryStep.config.dependencies).toContain('loadBusinessUnits');
    });

    it('should have 90s timeout for AI generation', () => {
      expect(executiveSummaryStep.config.timeout).toBe(90000);
    });
  });

  describe('AI generation', () => {
    it('should call generateStructuredOutput with correct schema', async () => {
      const ctx = createMockContext();
      await executiveSummaryStep.execute(createInput(), ctx);

      expect(mockGenerateStructuredOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: executiveSummarySchema,
          system: expect.stringContaining('Senior Business Development Consultant'),
          prompt: expect.stringContaining('Analyse-Ergebnisse'),
        })
      );
    });

    it('should include BL recommendation in prompt', async () => {
      const ctx = createMockContext();
      await executiveSummaryStep.execute(createInput(), ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Digital Experience');
      expect(callArgs.prompt).toContain('85');
    });

    it('should include tech stack in prompt', async () => {
      const ctx = createMockContext();
      await executiveSummaryStep.execute(createInput(), ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.prompt).toContain('WordPress');
    });

    it('should include content volume in prompt', async () => {
      const ctx = createMockContext();
      await executiveSummaryStep.execute(createInput(), ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.prompt).toContain('150');
    });

    it('should include features in prompt', async () => {
      const ctx = createMockContext();
      await executiveSummaryStep.execute(createInput(), ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Multi-Language: Ja');
      expect(callArgs.prompt).toContain('E-Commerce: Nein');
    });

    it('should pass context section to system prompt', async () => {
      const ctx = createMockContext({ contextSection: 'Extra context for the AI' });
      await executiveSummaryStep.execute(createInput(), ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.system).toContain('Extra context for the AI');
    });

    it('should return the generated executive summary', async () => {
      const ctx = createMockContext();
      const result = await executiveSummaryStep.execute(createInput(), ctx);

      expect(result.blRecommendation).toBe('Digital Experience');
      expect(result.goNoGoScore).toBe(78);
      expect(result.tShirtSize).toBe('M');
      expect(result.oneLiner).toBeDefined();
    });
  });

  describe('optional input fields', () => {
    it('should handle input with migration complexity', async () => {
      const ctx = createMockContext();
      const input = {
        ...createInput(),
        migrationComplexity: {
          score: 60,
          recommendation: 'moderate' as const,
          factors: {} as any,
          warnings: ['Legacy data format'],
          estimatedEffort: { minPT: 20, maxPT: 40, confidence: 60 },
        },
      };

      await executiveSummaryStep.execute(input, ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.prompt).toContain('moderate');
      expect(callArgs.prompt).toContain('Legacy data format');
      expect(callArgs.prompt).toContain('20-40 PT');
    });

    it('should handle input with company intelligence', async () => {
      const ctx = createMockContext();
      const input = {
        ...createInput(),
        companyIntelligence: {
          basicInfo: {
            name: 'Test AG',
            industry: 'Automotive',
            employeeCount: '5000',
            headquarters: 'Berlin',
            website: 'https://test.de',
          },
          dataQuality: {
            confidence: 80,
            sources: ['web'],
            lastUpdated: new Date().toISOString(),
          },
        } as any,
      };

      await executiveSummaryStep.execute(input, ctx);

      const callArgs = mockGenerateStructuredOutput.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Test AG');
      expect(callArgs.prompt).toContain('Automotive');
      expect(callArgs.prompt).toContain('5000');
    });
  });
});

describe('executiveSummarySchema', () => {
  it('should validate a correct executive summary', () => {
    const result = executiveSummarySchema.safeParse(sampleExecutiveSummary);
    expect(result.success).toBe(true);
  });

  it('should reject goNoGoScore above 100', () => {
    const invalid = { ...sampleExecutiveSummary, goNoGoScore: 150 };
    const result = executiveSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject goNoGoScore below 0', () => {
    const invalid = { ...sampleExecutiveSummary, goNoGoScore: -10 };
    const result = executiveSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require at least 1 risk', () => {
    const invalid = { ...sampleExecutiveSummary, topRisks: [] };
    const result = executiveSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject more than 5 risks', () => {
    const invalid = {
      ...sampleExecutiveSummary,
      topRisks: Array.from({ length: 6 }, (_, i) => ({
        title: `Risk ${i}`,
        severity: 'low' as const,
        description: `Description ${i}`,
      })),
    };
    const result = executiveSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept valid T-Shirt sizes', () => {
    for (const size of ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const) {
      const valid = { ...sampleExecutiveSummary, tShirtSize: size };
      const result = executiveSummarySchema.safeParse(valid);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid T-Shirt sizes', () => {
    const invalid = { ...sampleExecutiveSummary, tShirtSize: 'XXXL' };
    const result = executiveSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
