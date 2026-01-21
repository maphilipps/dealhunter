/**
 * Unit Tests: CMS Matcher
 *
 * Tests CMS matching logic, scoring, and ranking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchCMS, type CMSMatcherInput, type FeatureRequirement } from '../matcher';
import type { ContentArchitectureResult } from '../../agents/content-architecture-agent';
import type { MigrationComplexityResult } from '../../agents/migration-complexity-agent';
import type { Technology } from '../../db/schema';

// Mock database with vi.hoisted
const { mockFindMany, mockDelete, mockInsert } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockDelete: vi.fn(() => ({ where: vi.fn() })),
  mockInsert: vi.fn(() => ({ values: vi.fn() })),
}));

vi.mock('../../db', () => ({
  db: {
    query: {
      technologies: {
        findMany: mockFindMany,
      },
    },
    delete: mockDelete,
    insert: mockInsert,
  },
}));

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      reasoning: 'Drupal is a strong fit for this project due to excellent feature match and industry alignment.',
    },
  }),
}));

describe('CMS Matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST DATA FIXTURES
  // ═══════════════════════════════════════════════════════════════════════════════

  function createMockTechnology(partial: Partial<Technology>): Technology {
    return {
      id: 'tech-1',
      name: 'Drupal',
      businessUnitId: 'bu-1',
      baselineHours: 693,
      baselineName: 'adessoCMS Drupal',
      baselineEntityCounts: JSON.stringify({ contentTypes: 15, paragraphs: 20 }),
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Extended nullable fields
      logoUrl: null,
      websiteUrl: null,
      description: null,
      category: null,
      license: null,
      latestVersion: null,
      githubUrl: null,
      githubStars: null,
      lastRelease: null,
      communitySize: null,
      pros: null,
      cons: null,
      usps: null,
      targetAudiences: null,
      useCases: null,
      features: null,
      adessoExpertise: null,
      adessoExpertiseLevel: null,
      adessoReferences: null,
      adessoCertifications: null,
      adessoTeamSize: null,
      adessoSuccessStories: null,
      ...partial,
    };
  }

  function createMockContentArchitecture(
    partial?: Partial<ContentArchitectureResult>
  ): ContentArchitectureResult {
    return {
      success: true,
      pageCount: 500,
      pageCountConfidence: 'high',
      contentTypes: [
        { name: 'Page', estimatedCount: 400, fields: [] },
        { name: 'News', estimatedCount: 100, fields: [] },
      ],
      navigationStructure: { depth: 3, breadth: 5 },
      contentVolume: { images: 200, videos: 10, documents: 50 },
      siteStructure: 'standard',
      analyzedAt: new Date().toISOString(),
      ...partial,
    };
  }

  function createMockMigrationComplexity(
    partial?: Partial<MigrationComplexityResult>
  ): MigrationComplexityResult {
    return {
      success: true,
      complexityScore: 45,
      complexityCategory: 'medium',
      factors: [],
      risks: [],
      recommendations: [],
      analyzedAt: new Date().toISOString(),
      ...partial,
    };
  }

  function createMockInput(partial?: Partial<CMSMatcherInput>): CMSMatcherInput {
    return {
      leadId: 'lead-123',
      industry: 'Public Sector',
      budget: '50-100k EUR',
      pageCount: 500,
      featureRequirements: [],
      contentArchitecture: createMockContentArchitecture(),
      migrationComplexity: createMockMigrationComplexity(),
      ...partial,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: CMS Matching
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('matchCMS', () => {
    it('should match CMS and return top 3 ranked results', async () => {
      const technologies = [
        createMockTechnology({ id: 'tech-1', name: 'Drupal' }),
        createMockTechnology({ id: 'tech-2', name: 'Ibexa' }),
        createMockTechnology({ id: 'tech-3', name: 'Sulu' }),
        createMockTechnology({ id: 'tech-4', name: 'Magnolia' }),
        createMockTechnology({ id: 'tech-5', name: 'FirstSpirit' }),
      ];

      mockFindMany.mockResolvedValueOnce(technologies);

      const input = createMockInput();
      const result = await matchCMS(input);

      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(3);
      expect(result.matches[0].rank).toBe(1);
      expect(result.matches[1].rank).toBe(2);
      expect(result.matches[2].rank).toBe(3);
      expect(result.matches[0].totalScore).toBeGreaterThanOrEqual(result.matches[1].totalScore);
      expect(result.matches[1].totalScore).toBeGreaterThanOrEqual(result.matches[2].totalScore);
    });

    it('should handle no technologies found', async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const input = createMockInput();
      const result = await matchCMS(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No CMS technologies found');
      expect(result.matches).toHaveLength(0);
    });

    it('should filter by businessUnitId if provided', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Drupal', businessUnitId: 'bu-php' }),
      ]);

      const input = createMockInput({ requiredBusinessUnitId: 'bu-php' });
      await matchCMS(input);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Industry Scoring
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Industry Scoring', () => {
    it('should score Drupal high for Public Sector', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Drupal' }),
        createMockTechnology({ id: 'tech-2', name: 'Sulu' }),
      ]);

      const input = createMockInput({ industry: 'Public Sector' });
      const result = await matchCMS(input);

      const drupalMatch = result.matches.find(m => m.technologyName === 'Drupal');
      expect(drupalMatch?.industryScore).toBeGreaterThan(70);
    });

    it('should return neutral score for unknown industry', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({ industry: null });
      const result = await matchCMS(input);

      expect(result.matches[0].industryScore).toBe(70);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Size Scoring
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Size Scoring', () => {
    it('should score Sulu high for small sites (<100 pages)', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Sulu' }),
        createMockTechnology({ id: 'tech-2', name: 'Magnolia' }),
      ]);

      const input = createMockInput({ pageCount: 50 });
      const result = await matchCMS(input);

      const suluMatch = result.matches.find(m => m.technologyName === 'Sulu');
      const magnoliaMatch = result.matches.find(m => m.technologyName === 'Magnolia');

      expect(suluMatch?.sizeScore).toBeGreaterThan(magnoliaMatch?.sizeScore || 0);
    });

    it('should score Magnolia high for enterprise sites (>10k pages)', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Sulu' }),
        createMockTechnology({ id: 'tech-2', name: 'Magnolia' }),
      ]);

      const input = createMockInput({ pageCount: 15000 });
      const result = await matchCMS(input);

      const suluMatch = result.matches.find(m => m.technologyName === 'Sulu');
      const magnoliaMatch = result.matches.find(m => m.technologyName === 'Magnolia');

      expect(magnoliaMatch?.sizeScore).toBeGreaterThan(suluMatch?.sizeScore || 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Budget Scoring
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Budget Scoring', () => {
    it('should score Sulu high for low budget (20-50k)', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Sulu' }),
        createMockTechnology({ id: 'tech-2', name: 'FirstSpirit' }),
      ]);

      const input = createMockInput({ budget: '30k EUR' });
      const result = await matchCMS(input);

      const suluMatch = result.matches.find(m => m.technologyName === 'Sulu');
      const firstSpiritMatch = result.matches.find(m => m.technologyName === 'FirstSpirit');

      expect(suluMatch?.budgetScore).toBeGreaterThan(firstSpiritMatch?.budgetScore || 0);
    });

    it('should score FirstSpirit high for high budget (200k+)', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Sulu' }),
        createMockTechnology({ id: 'tech-2', name: 'FirstSpirit' }),
      ]);

      const input = createMockInput({ budget: '250k EUR' });
      const result = await matchCMS(input);

      const suluMatch = result.matches.find(m => m.technologyName === 'Sulu');
      const firstSpiritMatch = result.matches.find(m => m.technologyName === 'FirstSpirit');

      expect(firstSpiritMatch?.budgetScore).toBeGreaterThan(suluMatch?.budgetScore || 0);
    });

    it('should return neutral score for missing budget', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({ budget: null });
      const result = await matchCMS(input);

      expect(result.matches[0].budgetScore).toBe(70);
    });

    it('should parse budget range (50-100k)', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({ budget: '50-100k EUR' });
      const result = await matchCMS(input);

      expect(result.matches[0].budgetScore).toBeGreaterThan(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Migration Scoring
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Migration Scoring', () => {
    it('should score high for low migration complexity', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({
          complexityScore: 20,
          complexityCategory: 'low',
        }),
      });

      const result = await matchCMS(input);
      expect(result.matches[0].migrationScore).toBeGreaterThan(80);
    });

    it('should score low for high migration complexity', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({
          complexityScore: 85,
          complexityCategory: 'very_high',
        }),
      });

      const result = await matchCMS(input);
      expect(result.matches[0].migrationScore).toBeLessThan(50);
    });

    it('should return neutral score if migration analysis failed', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({
        migrationComplexity: { ...createMockMigrationComplexity(), success: false },
      });

      const result = await matchCMS(input);
      expect(result.matches[0].migrationScore).toBe(70);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Feature Scoring
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Feature Scoring', () => {
    it('should score high when all must-have features are supported', async () => {
      const drupalWithFeatures = createMockTechnology({
        id: 'tech-1',
        name: 'Drupal',
        features: JSON.stringify({
          'Multi-language': { supported: true, score: 95 },
          'User Roles': { supported: true, score: 90 },
          Workflows: { supported: true, score: 85 },
        }),
      });

      mockFindMany.mockResolvedValueOnce([drupalWithFeatures]);

      const featureRequirements: FeatureRequirement[] = [
        { name: 'Multi-language', importance: 'must_have' },
        { name: 'User Roles', importance: 'must_have' },
        { name: 'Workflows', importance: 'nice_to_have' },
      ];

      const input = createMockInput({ featureRequirements });
      const result = await matchCMS(input);

      expect(result.matches[0].featureScore).toBeGreaterThan(80);
    });

    it('should score low when must-have features are missing', async () => {
      const drupalWithFeatures = createMockTechnology({
        id: 'tech-1',
        name: 'Drupal',
        features: JSON.stringify({
          'Multi-language': { supported: false, score: 0 },
          'User Roles': { supported: true, score: 90 },
        }),
      });

      mockFindMany.mockResolvedValueOnce([drupalWithFeatures]);

      const featureRequirements: FeatureRequirement[] = [
        { name: 'Multi-language', importance: 'must_have' },
        { name: 'User Roles', importance: 'must_have' },
      ];

      const input = createMockInput({ featureRequirements });
      const result = await matchCMS(input);

      expect(result.matches[0].featureScore).toBeLessThan(60);
    });

    it('should return neutral score when no features are specified', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput({ featureRequirements: [] });
      const result = await matchCMS(input);

      expect(result.matches[0].featureScore).toBe(70);
    });

    it('should handle CMS with no feature data', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Drupal', features: null }),
      ]);

      const featureRequirements: FeatureRequirement[] = [
        { name: 'Multi-language', importance: 'must_have' },
      ];

      const input = createMockInput({ featureRequirements });
      const result = await matchCMS(input);

      expect(result.matches[0].featureScore).toBeLessThan(50); // All features unsupported
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Weighted Total Score
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Weighted Total Score', () => {
    it('should calculate weighted total score correctly', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput();
      const result = await matchCMS(input);

      const match = result.matches[0];

      // Manual calculation (weights: 40%, 20%, 15%, 15%, 10%)
      const expectedTotal = Math.round(
        match.featureScore * 0.4 +
          match.industryScore * 0.2 +
          match.sizeScore * 0.15 +
          match.budgetScore * 0.15 +
          match.migrationScore * 0.1
      );

      expect(match.totalScore).toBe(expectedTotal);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Reasoning Generation
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Reasoning Generation', () => {
    it('should generate reasoning for each match', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Drupal' }),
        createMockTechnology({ id: 'tech-2', name: 'Sulu' }),
      ]);

      const input = createMockInput();
      const result = await matchCMS(input);

      expect(result.matches[0].reasoning).toBeTruthy();
      expect(result.matches[0].reasoning.length).toBeGreaterThan(0);
      expect(result.matches[1].reasoning).toBeTruthy();
    });

    it('should include CMS name in reasoning', async () => {
      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput();
      const result = await matchCMS(input);

      expect(result.matches[0].reasoning.toLowerCase()).toContain('drupal');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Database Persistence
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Database Persistence', () => {
    it('should save match results to database', async () => {
      mockFindMany.mockResolvedValueOnce([
        createMockTechnology({ id: 'tech-1', name: 'Drupal' }),
        createMockTechnology({ id: 'tech-2', name: 'Sulu' }),
      ]);

      const input = createMockInput({ leadId: 'lead-999' });
      await matchCMS(input);

      // Should delete existing results
      expect(mockDelete).toHaveBeenCalled();

      // Should insert new results (top 3)
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Error Handling
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockFindMany.mockRejectedValueOnce(new Error('Database connection failed'));

      const input = createMockInput();
      const result = await matchCMS(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
      expect(result.matches).toHaveLength(0);
    });

    it('should handle AI reasoning generation failure', async () => {
      const aiModule = await import('ai');
      const mockGenerate = vi.mocked(aiModule.generateObject);
      mockGenerate.mockRejectedValueOnce(new Error('AI service unavailable'));

      mockFindMany.mockResolvedValueOnce([createMockTechnology({ id: 'tech-1', name: 'Drupal' })]);

      const input = createMockInput();
      const result = await matchCMS(input);

      // Should still succeed with fallback reasoning
      expect(result.success).toBe(true);
      expect(result.matches[0].reasoning).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TESTS: Integration Test
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Integration Test', () => {
    it('should perform complete CMS matching workflow', async () => {
      const technologies = [
        createMockTechnology({
          id: 'tech-1',
          name: 'Drupal',
          features: JSON.stringify({
            'Multi-language': { supported: true, score: 95 },
            'User Roles': { supported: true, score: 90 },
          }),
        }),
        createMockTechnology({
          id: 'tech-2',
          name: 'Sulu',
          features: JSON.stringify({
            'Multi-language': { supported: true, score: 85 },
            'User Roles': { supported: true, score: 80 },
          }),
        }),
        createMockTechnology({
          id: 'tech-3',
          name: 'Magnolia',
          features: JSON.stringify({
            'Multi-language': { supported: false, score: 0 },
            'User Roles': { supported: true, score: 90 },
          }),
        }),
      ];

      mockFindMany.mockResolvedValueOnce(technologies);

      const featureRequirements: FeatureRequirement[] = [
        { name: 'Multi-language', importance: 'must_have' },
        { name: 'User Roles', importance: 'nice_to_have' },
      ];

      const input = createMockInput({
        leadId: 'lead-integration',
        industry: 'Public Sector',
        budget: '75k EUR',
        pageCount: 800,
        featureRequirements,
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 35 }),
      });

      const result = await matchCMS(input);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(3);
      expect(result.matches[0].rank).toBe(1);
      expect(result.matches[0].technologyName).toBeTruthy();
      expect(result.matches[0].totalScore).toBeGreaterThan(0);
      expect(result.matches[0].reasoning).toBeTruthy();

      // Drupal should rank higher than Magnolia (better feature match)
      const drupalMatch = result.matches.find(m => m.technologyName === 'Drupal');
      const magnoliaMatch = result.matches.find(m => m.technologyName === 'Magnolia');

      expect(drupalMatch?.totalScore).toBeGreaterThan(magnoliaMatch?.totalScore || 0);
    });
  });
});
