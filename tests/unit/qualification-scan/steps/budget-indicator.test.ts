import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/streaming/in-process/event-types', () => ({
  AgentEventType: {
    STEP_START: 'STEP_START',
    STEP_COMPLETE: 'STEP_COMPLETE',
    AGENT_COMPLETE: 'AGENT_COMPLETE',
    AGENT_PROGRESS: 'AGENT_PROGRESS',
  },
}));

import {
  calculateBudgetIndicator,
  budgetIndicatorStep,
} from '@/lib/qualification-scan/workflow/steps/budget-indicator';
import type { BudgetIndicatorResult } from '@/lib/qualification-scan/workflow/steps/budget-indicator';
import type {
  ContentVolume,
  Features,
  MigrationComplexity,
  TechStack,
} from '@/lib/qualification-scan/schema';

function createMinimalInput(
  overrides: {
    pageCount?: number;
    features?: Partial<Features>;
    migrationComplexity?: MigrationComplexity;
    techStack?: Partial<TechStack>;
  } = {}
) {
  const contentVolume: ContentVolume = {
    estimatedPageCount: overrides.pageCount ?? 100,
    actualPageCount: undefined,
  };

  const features: Features = {
    ecommerce: false,
    userAccounts: false,
    search: false,
    multiLanguage: false,
    blog: false,
    forms: false,
    api: false,
    mobileApp: false,
    customFeatures: [],
    ...overrides.features,
  };

  const techStack: TechStack = {
    cms: undefined,
    ...overrides.techStack,
  };

  return {
    contentVolume,
    features,
    migrationComplexity: overrides.migrationComplexity,
    techStack,
  };
}

describe('calculateBudgetIndicator', () => {
  describe('base PT calculation (degressive)', () => {
    it('should calculate base PT for small sites (<= 50 pages)', () => {
      const result = calculateBudgetIndicator(createMinimalInput({ pageCount: 30 }));
      // 30 * 0.5 = 15 PT
      expect(result.basePT).toBe(15);
    });

    it('should enforce minimum 10 PT for very small sites', () => {
      const result = calculateBudgetIndicator(createMinimalInput({ pageCount: 5 }));
      // max(10, 5 * 0.5) = max(10, 2.5) = 10
      expect(result.basePT).toBe(10);
    });

    it('should calculate degressive rate for 50-200 pages', () => {
      const result = calculateBudgetIndicator(createMinimalInput({ pageCount: 100 }));
      // 25 + (100-50) * 0.3 = 25 + 15 = 40
      expect(result.basePT).toBe(40);
    });

    it('should calculate degressive rate for 200-500 pages', () => {
      const result = calculateBudgetIndicator(createMinimalInput({ pageCount: 300 }));
      // 70 + (300-200) * 0.2 = 70 + 20 = 90
      expect(result.basePT).toBe(90);
    });

    it('should calculate degressive rate for 500+ pages', () => {
      const result = calculateBudgetIndicator(createMinimalInput({ pageCount: 1000 }));
      // 130 + (1000-500) * 0.1 = 130 + 50 = 180
      expect(result.basePT).toBe(180);
    });

    it('should prefer actualPageCount over estimatedPageCount', () => {
      const input = createMinimalInput({ pageCount: 100 });
      input.contentVolume.actualPageCount = 50;
      const result = calculateBudgetIndicator(input);
      // 50 * 0.5 = 25 PT
      expect(result.basePT).toBe(25);
    });
  });

  describe('multiplier effects', () => {
    it('should apply ecommerce multiplier (1.4x)', () => {
      const without = calculateBudgetIndicator(createMinimalInput({ pageCount: 50 }));
      const withEcom = calculateBudgetIndicator(
        createMinimalInput({ pageCount: 50, features: { ecommerce: true } })
      );
      expect(withEcom.basePT).toBeGreaterThan(without.basePT);
    });

    it('should apply multi-language multiplier (1.3x)', () => {
      const without = calculateBudgetIndicator(createMinimalInput({ pageCount: 50 }));
      const withML = calculateBudgetIndicator(
        createMinimalInput({ pageCount: 50, features: { multiLanguage: true } })
      );
      expect(withML.basePT).toBeGreaterThan(without.basePT);
    });

    it('should apply migration complexity multiplier', () => {
      const complexMigration: MigrationComplexity = {
        score: 80,
        recommendation: 'complex',
        factors: {
          cmsExportability: {
            score: 60,
            hasRestApi: false,
            hasXmlExport: true,
            hasCli: false,
            inconsistentStructure: false,
          } as any,
          dataQuality: { score: 70, inconsistentStructure: false } as any,
          contentComplexity: { score: 80, embeddedMedia: true, complexLayouts: true } as any,
          integrationComplexity: { score: 50, externalApis: 3, ssoRequired: false } as any,
        },
        warnings: ['Complex migration'],
      };

      const without = calculateBudgetIndicator(createMinimalInput({ pageCount: 100 }));
      const withMigration = calculateBudgetIndicator(
        createMinimalInput({ pageCount: 100, migrationComplexity: complexMigration })
      );
      expect(withMigration.basePT).toBeGreaterThan(without.basePT);
    });

    it('should apply CMS fallback multiplier (1.15x) when no migration complexity', () => {
      const without = calculateBudgetIndicator(createMinimalInput({ pageCount: 100 }));
      const withCms = calculateBudgetIndicator(
        createMinimalInput({ pageCount: 100, techStack: { cms: 'WordPress' } })
      );
      expect(withCms.basePT).toBeGreaterThan(without.basePT);
    });

    it('should compound multiple feature multipliers', () => {
      const result = calculateBudgetIndicator(
        createMinimalInput({
          pageCount: 100,
          features: {
            ecommerce: true, // 1.4x
            multiLanguage: true, // 1.3x
            api: true, // 1.2x
            userAccounts: true, // 1.15x
            search: true, // 1.1x
          },
        })
      );
      // Base 40 * 1.4 * 1.3 * 1.2 * 1.15 * 1.1 ≈ 110+
      expect(result.basePT).toBeGreaterThan(100);
    });

    it('should apply custom features multiplier for >5 features', () => {
      const result6 = calculateBudgetIndicator(
        createMinimalInput({
          pageCount: 100,
          features: { customFeatures: ['a', 'b', 'c', 'd', 'e', 'f'] },
        })
      );
      const result1 = calculateBudgetIndicator(
        createMinimalInput({
          pageCount: 100,
          features: { customFeatures: ['a'] },
        })
      );
      // >5 gets 1.2x, 1-5 gets 1.1x
      expect(result6.basePT).toBeGreaterThan(result1.basePT);
    });
  });

  describe('scenarios', () => {
    it('should always return 4 scenarios', () => {
      const result = calculateBudgetIndicator(createMinimalInput());
      expect(result.scenarios).toHaveLength(4);
    });

    it('should return scenarios in correct order', () => {
      const result = calculateBudgetIndicator(createMinimalInput());
      const names = result.scenarios.map(s => s.name);
      expect(names).toEqual(['Pessimistisch', 'Neutral', 'Optimistisch', 'AI-Powered']);
    });

    it('should have correct factors', () => {
      const result = calculateBudgetIndicator(createMinimalInput());
      const factors = result.scenarios.map(s => s.factor);
      expect(factors).toEqual([1.3, 1.0, 0.8, 0.4]);
    });

    it('should calculate totalCost as totalPT * 1200 EUR', () => {
      const result = calculateBudgetIndicator(createMinimalInput({ pageCount: 50 }));
      for (const scenario of result.scenarios) {
        expect(scenario.totalCost).toBe(scenario.totalPT * 1200);
      }
    });

    it('should order scenarios by PT descending', () => {
      const result = calculateBudgetIndicator(createMinimalInput());
      const pts = result.scenarios.map(s => s.totalPT);
      // Pessimistisch > Neutral > Optimistisch > AI-Powered
      for (let i = 0; i < pts.length - 1; i++) {
        expect(pts[i]).toBeGreaterThanOrEqual(pts[i + 1]);
      }
    });
  });
});

describe('budgetIndicatorStep', () => {
  it('should have correct configuration', () => {
    expect(budgetIndicatorStep.config.name).toBe('budgetIndicator');
    expect(budgetIndicatorStep.config.phase).toBe('synthesis');
    expect(budgetIndicatorStep.config.optional).toBe(true);
    expect(budgetIndicatorStep.config.dependencies).toContain('contentVolume');
    expect(budgetIndicatorStep.config.dependencies).toContain('features');
    expect(budgetIndicatorStep.config.dependencies).toContain('techStack');
  });
});
