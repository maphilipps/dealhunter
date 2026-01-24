/**
 * Unit Tests: PT Estimation Calculator
 *
 * Tests baseline matching, delta calculation, PT estimation, and breakdown generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ContentArchitectureResult } from '../../agents/content-architecture-agent';
import type { MigrationComplexityResult } from '../../agents/migration-complexity-agent';
import { db } from '../../db';
import { calculatePTEstimation, type CalculatePTEstimationInput } from '../pt-calculator';

// Mock database with vi.hoisted to ensure mockFindFirst is available during hoisting
const { mockFindFirst } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: {
    query: {
      technologies: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

describe('PT Estimation Calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST DATA FIXTURES
  // ═══════════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMockTechnology = (overrides: Partial<any> = {}) => ({
    id: 'tech-123',
    name: 'Drupal',
    businessUnitId: 'bu-php',
    baselineHours: 693,
    baselineName: 'adessoCMS Drupal',
    baselineEntityCounts: JSON.stringify({
      contentTypes: 15,
      paragraphs: 20,
      taxonomies: 8,
      views: 12,
      blocks: 10,
    }),
    isDefault: true,
    // Required fields from extended schema
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
    adessoReferenceCount: null,
    lastResearchedAt: null,
    researchStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

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

  const createMockMigrationComplexity = (
    overrides: Partial<MigrationComplexityResult> = {}
  ): MigrationComplexityResult => ({
    success: true,
    complexityScore: 50,
    complexityCategory: 'medium',
    factors: [],
    risks: [],
    recommendations: [],
    analyzedAt: new Date().toISOString(),
    ...overrides,
  });

  const createMockInput = (
    overrides: Partial<CalculatePTEstimationInput> = {}
  ): CalculatePTEstimationInput => ({
    leadId: 'lead-123',
    technologyId: 'tech-123',
    contentArchitecture: createMockContentArchitecture(),
    migrationComplexity: createMockMigrationComplexity(),
    ...overrides,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // BASELINE MATCHING TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Baseline Matching', () => {
    it('should load baseline data from technology table', async () => {
      const mockTech = createMockTechnology();
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.baselineName).toBe('adessoCMS Drupal');
      expect(result.baselineHours).toBe(693);
      expect(result.baselineEntityCounts).toEqual({
        contentTypes: 15,
        paragraphs: 20,
        taxonomies: 8,
        views: 12,
        blocks: 10,
      });
    });

    it('should fail if technology not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail if technology has no baseline data', async () => {
      const mockTech = createMockTechnology({
        baselineHours: null,
        baselineEntityCounts: null,
      });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no baseline data');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTITY EXTRACTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Customer Entity Extraction', () => {
    it('should extract entity counts from content architecture', async () => {
      const mockTech = createMockTechnology();
      mockFindFirst.mockResolvedValue(mockTech);

      // 3 content types → 3 content types, ~9 paragraphs, ~2 taxonomies, ~1 view, 5 blocks
      const contentArchitecture = createMockContentArchitecture({
        contentTypes: [
          {
            name: 'Blog',
            pattern: '/blog/',
            estimatedCount: 100,
            characteristics: [],
            migrationComplexity: 'M' as const,
            estimatedHours: 10,
          },
          {
            name: 'Product',
            pattern: '/product/',
            estimatedCount: 50,
            characteristics: [],
            migrationComplexity: 'M' as const,
            estimatedHours: 10,
          },
          {
            name: 'Page',
            pattern: '/page/',
            estimatedCount: 50,
            characteristics: [],
            migrationComplexity: 'M' as const,
            estimatedHours: 10,
          },
        ],
        navigationStructure: {
          depth: 3,
          breadth: 5,
          mainNavItems: ['Home', 'Products', 'Blog'],
        },
      });

      const input = createMockInput({ contentArchitecture });
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.customerEntityCounts.contentTypes).toBe(3);
      expect(result.customerEntityCounts.paragraphs).toBe(9); // 3 × 3
      expect(result.customerEntityCounts.taxonomies).toBe(2); // ceil(3/2)
      expect(result.customerEntityCounts.views).toBe(1); // ceil(3/3)
      expect(result.customerEntityCounts.blocks).toBe(5); // navigation breadth
    });

    it('should scale entity counts with more content types', async () => {
      const mockTech = createMockTechnology();
      mockFindFirst.mockResolvedValue(mockTech);

      // 20 content types → 20 content types, ~60 paragraphs, ~10 taxonomies, ~7 views
      const contentArchitecture = createMockContentArchitecture({
        contentTypes: Array.from({ length: 20 }, (_, i) => ({
          name: `Type ${i + 1}`,
          pattern: `/type${i + 1}/`,
          estimatedCount: 50,
          characteristics: [] as string[],
          migrationComplexity: 'M' as const,
          estimatedHours: 10,
        })),
      });

      const input = createMockInput({ contentArchitecture });
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.customerEntityCounts.contentTypes).toBe(20);
      expect(result.customerEntityCounts.paragraphs).toBe(60); // 20 × 3
      expect(result.customerEntityCounts.taxonomies).toBe(10); // ceil(20/2)
      expect(result.customerEntityCounts.views).toBe(7); // ceil(20/3)
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DELTA CALCULATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Delta Calculation', () => {
    it('should calculate delta when customer > baseline', async () => {
      const mockTech = createMockTechnology({
        baselineEntityCounts: JSON.stringify({
          contentTypes: 15,
          paragraphs: 20,
          taxonomies: 8,
          views: 12,
          blocks: 10,
        }),
      });
      mockFindFirst.mockResolvedValue(mockTech);

      // Customer: 20 CT, 60 Para, 10 Tax, 7 Views, 5 Blocks
      // Baseline: 15 CT, 20 Para, 8 Tax, 12 Views, 10 Blocks
      // Delta: +5 CT, +40 Para, +2 Tax, -5 Views (0), -5 Blocks (0)
      const contentArchitecture = createMockContentArchitecture({
        contentTypes: Array.from({ length: 20 }, (_, i) => ({
          name: `Type ${i + 1}`,
          pattern: `/type${i + 1}/`,
          estimatedCount: 50,
          characteristics: [] as string[],
          migrationComplexity: 'M' as const,
          estimatedHours: 10,
        })),
        navigationStructure: {
          depth: 3,
          breadth: 5,
          mainNavItems: ['Home', 'Products', 'Blog'],
        },
      });

      const input = createMockInput({ contentArchitecture });
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.delta.contentTypes).toBe(5); // 20 - 15
      expect(result.delta.paragraphs).toBe(40); // 60 - 20
      expect(result.delta.taxonomies).toBe(2); // 10 - 8
      expect(result.delta.views).toBe(0); // max(0, 7 - 12)
      expect(result.delta.blocks).toBe(0); // max(0, 5 - 10)
    });

    it('should NOT calculate negative delta (use 0 instead)', async () => {
      const mockTech = createMockTechnology({
        baselineEntityCounts: JSON.stringify({
          contentTypes: 30, // Baseline > Customer
          paragraphs: 50,
          taxonomies: 20,
          views: 20,
          blocks: 20,
        }),
      });
      mockFindFirst.mockResolvedValue(mockTech);

      const contentArchitecture = createMockContentArchitecture({
        contentTypes: [
          {
            name: 'Blog',
            pattern: '/blog/',
            estimatedCount: 100,
            characteristics: [],
            migrationComplexity: 'M' as const,
            estimatedHours: 10,
          },
        ],
      });

      const input = createMockInput({ contentArchitecture });
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      // All deltas should be 0 (no negative deltas)
      expect(result.delta.contentTypes).toBe(0);
      expect(result.delta.paragraphs).toBe(0);
      expect(result.delta.taxonomies).toBe(0);
      expect(result.delta.views).toBe(0);
      expect(result.delta.blocks).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PT CALCULATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('PT Calculation', () => {
    it('should calculate additional PT from delta using multipliers', async () => {
      const mockTech = createMockTechnology({
        baselineHours: 693,
        baselineEntityCounts: JSON.stringify({
          contentTypes: 15,
          paragraphs: 20,
          taxonomies: 8,
          views: 12,
          blocks: 10,
        }),
      });
      mockFindFirst.mockResolvedValue(mockTech);

      // Delta: +5 CT, +40 Para, +2 Tax, 0 Views, 0 Blocks
      // Additional PT: 5×15 + 40×6 + 2×4 + 0×8 + 0×5 = 75 + 240 + 8 = 323h
      const contentArchitecture = createMockContentArchitecture({
        contentTypes: Array.from({ length: 20 }, (_, i) => ({
          name: `Type ${i + 1}`,
          pattern: `/type${i + 1}/`,
          estimatedCount: 50,
          characteristics: [] as string[],
          migrationComplexity: 'M' as const,
          estimatedHours: 10,
        })),
        navigationStructure: {
          depth: 3,
          breadth: 5,
          mainNavItems: ['Home'],
        },
      });

      const input = createMockInput({
        contentArchitecture,
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 25 }), // Low complexity → 10% buffer
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.additionalPT).toBe(323); // 5×15 + 40×6 + 2×4
      // Total PT = Baseline (693) + Additional (323) + Buffer (10% of 1016 = 102) = 1118
      expect(result.totalPT).toBeGreaterThanOrEqual(1115); // Allow small rounding differences
      expect(result.totalPT).toBeLessThanOrEqual(1120);
    });

    it('should calculate total PT = baseline + additional + buffer', async () => {
      const mockTech = createMockTechnology({
        baselineHours: 500,
        baselineEntityCounts: JSON.stringify({
          contentTypes: 10,
          paragraphs: 10,
          taxonomies: 5,
          views: 5,
          blocks: 5,
        }),
      });
      mockFindFirst.mockResolvedValue(mockTech);

      // Customer: 10 CT, 30 Para, 5 Tax, 3 Views, 5 Blocks (same as baseline)
      // Delta: 0 CT, 20 Para, 0 Tax, 0 Views, 0 Blocks
      // Additional PT: 0×15 + 20×6 + 0×4 + 0×8 + 0×5 = 120h
      // Base PT: 500 + 120 = 620h
      // Buffer (20% for medium complexity): 620 × 0.20 = 124h
      // Total: 620 + 124 = 744h
      const contentArchitecture = createMockContentArchitecture({
        contentTypes: Array.from({ length: 10 }, (_, i) => ({
          name: `Type ${i + 1}`,
          pattern: `/type${i + 1}/`,
          estimatedCount: 50,
          characteristics: [] as string[],
          migrationComplexity: 'M' as const,
          estimatedHours: 10,
        })),
      });

      const input = createMockInput({
        contentArchitecture,
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 50 }), // Medium → 20% buffer
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.additionalPT).toBe(120);
      expect(result.totalPT).toBe(744); // 500 + 120 + 124
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // RISK BUFFER TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Risk Buffer Calculation', () => {
    it('should apply 10% buffer for LOW complexity (0-25)', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 20 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.riskBuffer).toBe(10);
      expect(result.confidenceLevel).toBe('high');
    });

    it('should apply 20% buffer for MEDIUM complexity (26-50)', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 40 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.riskBuffer).toBe(20);
      expect(result.confidenceLevel).toBe('medium');
    });

    it('should apply 30% buffer for HIGH complexity (51-75)', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 65 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.riskBuffer).toBe(30);
      expect(result.confidenceLevel).toBe('medium');
    });

    it('should apply 40% buffer for VERY HIGH complexity (76-100)', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 90 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.riskBuffer).toBe(40);
      expect(result.confidenceLevel).toBe('low');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE BREAKDOWN TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Phase Breakdown', () => {
    it('should generate 5 phases with correct percentages', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 25 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.phases).toHaveLength(5);

      // Check phase names
      const phaseNames = result.phases.map(p => p.name);
      expect(phaseNames).toContain('Foundation Setup');
      expect(phaseNames).toContain('Custom Development');
      expect(phaseNames).toContain('Integrations');
      expect(phaseNames).toContain('Content Migration');
      expect(phaseNames).toContain('Testing & QA');

      // Check percentages sum to 100%
      const totalPercentage = result.phases.reduce((sum, p) => sum + p.percentage, 0);
      expect(totalPercentage).toBe(100);

      // Check hours sum to total PT (allowing rounding differences)
      const totalHours = result.phases.reduce((sum, p) => sum + p.hours, 0);
      expect(Math.abs(totalHours - result.totalPT)).toBeLessThanOrEqual(5); // Allow ±5h rounding
    });

    it('should distribute hours according to phase percentages', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 25 }),
      });

      const result = await calculatePTEstimation(input);

      const foundation = result.phases.find(p => p.name === 'Foundation Setup');
      const customDev = result.phases.find(p => p.name === 'Custom Development');
      const integrations = result.phases.find(p => p.name === 'Integrations');
      const migration = result.phases.find(p => p.name === 'Content Migration');
      const testing = result.phases.find(p => p.name === 'Testing & QA');

      expect(foundation?.percentage).toBe(30);
      expect(customDev?.percentage).toBe(35);
      expect(integrations?.percentage).toBe(10);
      expect(migration?.percentage).toBe(15);
      expect(testing?.percentage).toBe(10);

      // Verify hours match percentages (with rounding tolerance)
      const expectedFoundation = Math.round(result.totalPT * 0.3);
      const expectedCustomDev = Math.round(result.totalPT * 0.35);
      expect(foundation?.hours).toBe(expectedFoundation);
      expect(customDev?.hours).toBe(expectedCustomDev);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DISCIPLINE MATRIX TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Discipline Matrix', () => {
    it('should generate 6 disciplines with correct percentages', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 25 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.disciplines).toHaveLength(6);

      // Check discipline roles
      const roles = result.disciplines.map(d => d.role);
      expect(roles).toContain('Solution Architect');
      expect(roles).toContain('Backend Developer');
      expect(roles).toContain('Frontend Developer');
      expect(roles).toContain('QA Engineer');
      expect(roles).toContain('Project Manager');
      expect(roles).toContain('DevOps Engineer');

      // Check percentages sum to 100%
      const totalPercentage = result.disciplines.reduce((sum, d) => sum + d.percentage, 0);
      expect(totalPercentage).toBe(100);

      // Check hours sum to total PT (allowing rounding differences)
      const totalHours = result.disciplines.reduce((sum, d) => sum + d.hours, 0);
      expect(Math.abs(totalHours - result.totalPT)).toBeLessThanOrEqual(6); // Allow ±6h rounding
    });

    it('should allocate most hours to Backend Developer (40%)', async () => {
      const mockTech = createMockTechnology({ baselineHours: 1000 });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 25 }),
      });

      const result = await calculatePTEstimation(input);

      const backend = result.disciplines.find(d => d.role === 'Backend Developer');
      const frontend = result.disciplines.find(d => d.role === 'Frontend Developer');

      expect(backend?.percentage).toBe(40);
      expect(frontend?.percentage).toBe(25);

      // Backend should have more hours than any other discipline
      const maxHours = Math.max(...result.disciplines.map(d => d.hours));
      expect(backend?.hours).toBe(maxHours);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ASSUMPTIONS TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Assumptions Generation', () => {
    it('should generate baseline assumption', async () => {
      const mockTech = createMockTechnology({
        baselineName: 'adessoCMS Drupal',
        baselineHours: 693,
      });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(result.assumptions.some(a => a.includes('Baseline: adessoCMS Drupal (693h)'))).toBe(
        true
      );
    });

    it('should add high complexity assumption for score > 50', async () => {
      const mockTech = createMockTechnology();
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        migrationComplexity: createMockMigrationComplexity({ complexityScore: 75 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(
        result.assumptions.some(a =>
          a.includes('High complexity requires additional architecture workshops')
        )
      ).toBe(true);
    });

    it('should add large content assumption for >1000 pages', async () => {
      const mockTech = createMockTechnology();
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput({
        contentArchitecture: createMockContentArchitecture({ pageCount: 5000 }),
      });

      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(
        result.assumptions.some(a =>
          a.includes('Large content volume requires dedicated migration tooling')
        )
      ).toBe(true);
    });

    it('should add many content types assumption for delta > 10', async () => {
      const mockTech = createMockTechnology({
        baselineEntityCounts: JSON.stringify({
          contentTypes: 5, // Low baseline
          paragraphs: 10,
          taxonomies: 5,
          views: 5,
          blocks: 5,
        }),
      });
      mockFindFirst.mockResolvedValue(mockTech);

      // Customer has 20 CT → delta = 15
      const contentArchitecture = createMockContentArchitecture({
        contentTypes: Array.from({ length: 20 }, (_, i) => ({
          name: `Type ${i + 1}`,
          pattern: `/type${i + 1}/`,
          estimatedCount: 50,
          characteristics: [] as string[],
          migrationComplexity: 'M' as const,
          estimatedHours: 10,
        })),
      });

      const input = createMockInput({ contentArchitecture });
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(true);
      expect(
        result.assumptions.some(a =>
          a.includes('Many custom content types require extensive content modeling')
        )
      ).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB Connection Failed'));

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB Connection Failed');
      expect(result.totalPT).toBe(0);
    });

    it('should handle missing baseline entity counts', async () => {
      const mockTech = createMockTechnology({
        baselineEntityCounts: null,
      });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no baseline data');
    });

    it('should handle invalid JSON in baseline entity counts', async () => {
      const mockTech = createMockTechnology({
        baselineEntityCounts: 'invalid-json',
      });
      mockFindFirst.mockResolvedValue(mockTech);

      const input = createMockInput();
      const result = await calculatePTEstimation(input);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('End-to-End Integration', () => {
    it('should calculate complete estimation for realistic scenario', async () => {
      const mockTech = createMockTechnology({
        baselineName: 'adessoCMS Drupal',
        baselineHours: 693,
        baselineEntityCounts: JSON.stringify({
          contentTypes: 15,
          paragraphs: 20,
          taxonomies: 8,
          views: 12,
          blocks: 10,
        }),
      });
      mockFindFirst.mockResolvedValue(mockTech);

      const contentArchitecture = createMockContentArchitecture({
        pageCount: 1500,
        contentTypes: Array.from({ length: 25 }, (_, i) => ({
          name: `Type ${i + 1}`,
          pattern: `/type${i + 1}/`,
          estimatedCount: 60,
          characteristics: [] as string[],
          migrationComplexity: 'M' as const,
          estimatedHours: 10,
        })),
        navigationStructure: {
          depth: 4,
          breadth: 15,
          mainNavItems: Array.from({ length: 7 }, (_, i) => `Nav ${i + 1}`),
        },
      });

      const migrationComplexity = createMockMigrationComplexity({
        complexityScore: 60,
        complexityCategory: 'high',
      });

      const input = createMockInput({
        contentArchitecture,
        migrationComplexity,
      });

      const result = await calculatePTEstimation(input);

      // Verify success
      expect(result.success).toBe(true);

      // Verify structure
      expect(result.baselineName).toBe('adessoCMS Drupal');
      expect(result.baselineHours).toBe(693);

      // Verify delta is positive
      expect(result.delta.contentTypes).toBeGreaterThan(0);
      expect(result.additionalPT).toBeGreaterThan(0);

      // Verify total PT > baseline
      expect(result.totalPT).toBeGreaterThan(result.baselineHours);

      // Verify risk buffer for high complexity
      expect(result.riskBuffer).toBe(30); // High complexity
      expect(result.confidenceLevel).toBe('medium');

      // Verify breakdowns
      expect(result.phases).toHaveLength(5);
      expect(result.disciplines).toHaveLength(6);
      expect(result.assumptions.length).toBeGreaterThan(0);
    });
  });
});
