/**
 * Unit Tests: Migration Complexity Agent
 *
 * Tests complexity score calculation and categorization logic.
 */

import { generateText } from 'ai';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ContentArchitectureResult } from '../content-architecture-agent';
import {
  analyzeMigrationComplexity,
  type AnalyzeMigrationComplexityInput,
} from '../migration-complexity-agent';

// Mock AI SDK (agent uses generateText + Output.object for structured output)
vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn() },
}));

vi.mock('@/lib/ai/providers', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

describe('Migration Complexity Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST DATA FIXTURES
  // ═══════════════════════════════════════════════════════════════════════════════

  const createMockContentArchitecture = (
    overrides: Partial<ContentArchitectureResult> = {}
  ): ContentArchitectureResult => ({
    success: true,
    pageCount: 500,
    pageCountConfidence: 'medium',
    pageCountMethod: 'AI-based estimation',
    contentTypes: [
      {
        name: 'Blog Post',
        pattern: '/blog/',
        estimatedCount: 200,
        characteristics: [],
        migrationComplexity: 'M' as const,
        estimatedHours: 12,
      },
      {
        name: 'Product Page',
        pattern: '/products/',
        estimatedCount: 150,
        characteristics: [],
        migrationComplexity: 'H' as const,
        estimatedHours: 20,
      },
      {
        name: 'Landing Page',
        pattern: '/pages/',
        estimatedCount: 150,
        characteristics: [],
        migrationComplexity: 'L' as const,
        estimatedHours: 6,
      },
    ],
    navigationStructure: {
      depth: 3,
      breadth: 5,
      mainNavItems: ['Home', 'Products', 'Blog', 'About', 'Contact'],
    },
    siteTree: [],
    contentVolume: {
      images: 1000,
      videos: 50,
      documents: 30,
      totalAssets: 1080,
    },
    calculatorSummary: {
      totalContentTypes: 3,
      totalEstimatedHours: 38,
      complexityDistribution: { H: 1, M: 1, L: 1 },
      recommendedDrupalModules: ['paragraphs', 'media', 'pathauto'],
      migrationRiskLevel: 'medium' as const,
      migrationRiskFactors: ['Multiple content types'],
    },
    analyzedAt: new Date().toISOString(),
    ...overrides,
  });

  const createMockInput = (
    overrides: Partial<AnalyzeMigrationComplexityInput> = {}
  ): AnalyzeMigrationComplexityInput => ({
    websiteUrl: 'https://example.com',
    techStack: {
      cms: 'WordPress',
      cmsVersion: '6.4',
      framework: 'React',
      backend: 'PHP',
      database: 'MySQL',
      hosting: 'AWS',
      server: 'Apache',
      technologies: ['WordPress', 'React', 'PHP', 'MySQL'],
    },
    contentArchitecture: createMockContentArchitecture(),
    ...overrides,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPLEXITY SCORE CALCULATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Complexity Score Calculation', () => {
    it('should calculate LOW complexity (score 0-25) for simple sites', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Standard CMS',
              impact: 'positive' as const,
              score: -10,
              description: 'WordPress is well supported',
            },
            {
              factor: 'Small site',
              impact: 'positive' as const,
              score: -15,
              description: 'Only 100 pages',
            },
          ],
          risks: [],
          recommendations: ['Use automated migration tools'],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 100 }),
      });

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(true);
      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexityScore).toBeLessThanOrEqual(25);
      expect(result.complexityCategory).toBe('low');
    });

    it('should calculate MEDIUM complexity (score 26-50) for average sites', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Standard CMS',
              impact: 'positive' as const,
              score: -5,
              description: 'WordPress is well supported',
            },
            {
              factor: 'Moderate size',
              impact: 'negative' as const,
              score: 5,
              description: '500 pages',
            },
          ],
          risks: [],
          recommendations: ['Plan phased migration'],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 500 }),
      });

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(true);
      expect(result.complexityScore).toBeGreaterThanOrEqual(26);
      expect(result.complexityScore).toBeLessThanOrEqual(50);
      expect(result.complexityCategory).toBe('medium');
    });

    it('should calculate HIGH complexity (score 51-75) for complex sites', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Custom CMS',
              impact: 'negative' as const,
              score: 12,
              description: 'Proprietary system',
            },
            {
              factor: 'Large site',
              impact: 'negative' as const,
              score: 8,
              description: '2000 pages',
            },
            {
              factor: 'Many integrations',
              impact: 'negative' as const,
              score: 5,
              description: 'Multiple 3rd-party APIs',
            },
          ],
          risks: [
            {
              category: 'technical' as const,
              title: 'Data Loss Risk',
              description: 'Custom data structures may not map cleanly',
              impact: 'high' as const,
              mitigation: 'Extensive data mapping and validation',
            },
          ],
          recommendations: ['Hire specialized migration team', 'Allow 6+ months timeline'],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        techStack: {
          cms: 'Custom CMS',
          cmsVersion: null,
          framework: 'jQuery',
          backend: 'PHP',
          database: 'Oracle',
          hosting: 'On-premise',
          server: 'IIS',
          technologies: ['Custom CMS', 'jQuery', 'PHP', 'Oracle'],
        },
        contentArchitecture: createMockContentArchitecture({ pageCount: 2000 }),
      });

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(true);
      expect(result.complexityScore).toBeGreaterThanOrEqual(51);
      expect(result.complexityScore).toBeLessThanOrEqual(75);
      expect(result.complexityCategory).toBe('high');
    });

    it('should calculate VERY HIGH complexity (score 76-100) for extremely complex sites', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Legacy custom CMS',
              impact: 'negative' as const,
              score: 20,
              description: '15-year-old proprietary system',
            },
            {
              factor: 'Massive site',
              impact: 'negative' as const,
              score: 15,
              description: '15000 pages',
            },
            {
              factor: 'Complex integrations',
              impact: 'negative' as const,
              score: 12,
              description: '20+ integrated systems',
            },
            {
              factor: 'Outdated tech',
              impact: 'negative' as const,
              score: 10,
              description: 'PHP 5.6, jQuery 1.x',
            },
          ],
          risks: [
            {
              category: 'technical' as const,
              title: 'Critical Data Loss Risk',
              description: 'Legacy data structures incompatible',
              impact: 'high' as const,
              mitigation: 'Custom migration scripts required',
            },
            {
              category: 'timeline' as const,
              title: 'Extended Timeline',
              description: 'Project may take 12+ months',
              impact: 'high' as const,
              mitigation: 'Phased approach with clear milestones',
            },
          ],
          recommendations: [
            'Dedicated migration team',
            'Budget 18+ months',
            'Extensive testing phase',
          ],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        techStack: {
          cms: 'Custom CMS',
          cmsVersion: null,
          framework: 'jQuery',
          backend: 'PHP',
          database: 'Oracle',
          hosting: 'On-premise',
          server: 'IIS',
          technologies: ['Custom CMS', 'jQuery 1.x', 'PHP 5.6', 'Oracle'],
        },
        contentArchitecture: createMockContentArchitecture({ pageCount: 15000 }),
      });

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(true);
      expect(result.complexityScore).toBeGreaterThanOrEqual(76);
      expect(result.complexityScore).toBeLessThanOrEqual(100);
      expect(result.complexityCategory).toBe('very_high');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAGE COUNT MULTIPLIER TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Page Count Multiplier', () => {
    it('should add +5 complexity for sites with 5000-10000 pages', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Standard CMS',
              impact: 'positive' as const,
              score: 0,
              description: 'Neutral',
            },
          ],
          risks: [],
          recommendations: [],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 7500 }),
      });

      const result = await analyzeMigrationComplexity(input);

      // Base score 50 + 0 (factor) + 5 (page multiplier) = 55
      expect(result.complexityScore).toBe(55);
      expect(result.complexityCategory).toBe('high');
    });

    it('should add +10 complexity for sites with >10000 pages', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Standard CMS',
              impact: 'positive' as const,
              score: 0,
              description: 'Neutral',
            },
          ],
          risks: [],
          recommendations: [],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 15000 }),
      });

      const result = await analyzeMigrationComplexity(input);

      // Base score 50 + 0 (factor) + 10 (page multiplier) = 60
      expect(result.complexityScore).toBe(60);
      expect(result.complexityCategory).toBe('high');
    });

    it('should NOT add page multiplier for sites with <5000 pages', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Standard CMS',
              impact: 'positive' as const,
              score: 0,
              description: 'Neutral',
            },
          ],
          risks: [],
          recommendations: [],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 1000 }),
      });

      const result = await analyzeMigrationComplexity(input);

      // Base score 50 + 0 (factor) + 0 (no page multiplier) = 50
      expect(result.complexityScore).toBe(50);
      expect(result.complexityCategory).toBe('medium');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CATEGORY ASSIGNMENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Category Assignment', () => {
    it.each([
      [0, 'low'],
      [12, 'low'],
      [25, 'low'],
      [26, 'medium'],
      [38, 'medium'],
      [50, 'medium'],
      [51, 'high'],
      [63, 'high'],
      [75, 'high'],
      [76, 'very_high'],
      [88, 'very_high'],
      [100, 'very_high'],
    ])('should categorize score %d as %s', async (targetScore, expectedCategory) => {
      // Calculate needed factor score to achieve target score
      // Formula: score = 50 (base) + factorScore + pageMultiplier
      // For <5000 pages: factorScore = targetScore - 50
      const factorScore = targetScore - 50;

      const mockAIResponse = {
        output: {
          complexityFactors: [
            {
              factor: 'Test Factor',
              impact: factorScore >= 0 ? ('negative' as const) : ('positive' as const),
              score: factorScore,
              description: 'Test',
            },
          ],
          risks: [],
          recommendations: [],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 100 }), // No page multiplier
      });

      const result = await analyzeMigrationComplexity(input);

      expect(result.complexityScore).toBe(targetScore);
      expect(result.complexityCategory).toBe(expectedCategory);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should return error result if content architecture failed', async () => {
      const input = createMockInput({
        contentArchitecture: {
          success: false,
          pageCount: 0,
          pageCountConfidence: 'low',
          pageCountMethod: 'Failed',
          contentTypes: [],
          navigationStructure: { depth: 0, breadth: 0, mainNavItems: [] },
          siteTree: [],
          contentVolume: { images: 0, videos: 0, documents: 0, totalAssets: 0 },
          calculatorSummary: {
            totalContentTypes: 0,
            totalEstimatedHours: 0,
            complexityDistribution: { H: 0, M: 0, L: 0 },
            recommendedDrupalModules: [],
            migrationRiskLevel: 'low',
            migrationRiskFactors: ['Analysis failed'],
          },
          analyzedAt: new Date().toISOString(),
          error: 'Content architecture analysis failed',
        },
      });

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content architecture analysis failed');
      expect(result.complexityScore).toBe(0);
      expect(result.complexityCategory).toBe('low');
    });

    it('should return error result if AI call fails', async () => {
      vi.mocked(generateText).mockRejectedValue(new Error('AI API Error'));

      const input = createMockInput();

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI API Error');
      expect(result.complexityScore).toBe(0);
      expect(result.complexityCategory).toBe('low');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // RISKS AND RECOMMENDATIONS TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Risks and Recommendations', () => {
    it('should return risks identified by AI', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [],
          risks: [
            {
              category: 'technical' as const,
              title: 'Data Migration Risk',
              description: 'Complex data structures',
              impact: 'high' as const,
              mitigation: 'Thorough data mapping',
            },
            {
              category: 'timeline' as const,
              title: 'Timeline Risk',
              description: 'Large site migration',
              impact: 'medium' as const,
              mitigation: 'Phased approach',
            },
          ],
          recommendations: ['Use migration specialists', 'Plan for 6 months'],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput();

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(true);
      expect(result.risks).toHaveLength(2);
      expect(result.risks[0].title).toBe('Data Migration Risk');
      expect(result.risks[0].impact).toBe('high');
      expect(result.risks[1].category).toBe('timeline');
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0]).toBe('Use migration specialists');
    });

    it('should return all risk categories', async () => {
      const mockAIResponse = {
        output: {
          complexityFactors: [],
          risks: [
            {
              category: 'technical' as const,
              title: 'Technical Risk',
              description: 'Tech issue',
              impact: 'high' as const,
              mitigation: 'Tech solution',
            },
            {
              category: 'content' as const,
              title: 'Content Risk',
              description: 'Content issue',
              impact: 'medium' as const,
              mitigation: 'Content solution',
            },
            {
              category: 'integration' as const,
              title: 'Integration Risk',
              description: 'Integration issue',
              impact: 'low' as const,
              mitigation: 'Integration solution',
            },
            {
              category: 'timeline' as const,
              title: 'Timeline Risk',
              description: 'Timeline issue',
              impact: 'high' as const,
              mitigation: 'Timeline solution',
            },
            {
              category: 'business' as const,
              title: 'Business Risk',
              description: 'Business issue',
              impact: 'medium' as const,
              mitigation: 'Business solution',
            },
          ],
          recommendations: [],
        },
      };

      vi.mocked(generateText).mockResolvedValue(
        mockAIResponse as unknown as Awaited<ReturnType<typeof generateText>>
      );

      const input = createMockInput();

      const result = await analyzeMigrationComplexity(input);

      expect(result.success).toBe(true);
      expect(result.risks).toHaveLength(5);
      expect(result.risks.map(r => r.category).sort()).toEqual([
        'business',
        'content',
        'integration',
        'technical',
        'timeline',
      ]);
    });
  });
});
