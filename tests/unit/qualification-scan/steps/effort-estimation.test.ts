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
  calculateEffortEstimation,
  effortEstimationStep,
} from '@/lib/qualification-scan/workflow/steps/effort-estimation';
import type {
  EffortEstimationResult,
  TShirtSize,
} from '@/lib/qualification-scan/workflow/steps/effort-estimation';
import type { ContentVolume, Features, MigrationComplexity } from '@/lib/qualification-scan/schema';

function createInput(
  overrides: {
    pageCount?: number;
    actualPageCount?: number;
    features?: Partial<Features>;
    migrationComplexity?: MigrationComplexity;
  } = {}
) {
  const contentVolume: ContentVolume = {
    estimatedPageCount: overrides.pageCount ?? 100,
    actualPageCount: overrides.actualPageCount,
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

  return {
    contentVolume,
    features,
    migrationComplexity: overrides.migrationComplexity,
  };
}

describe('calculateEffortEstimation', () => {
  describe('base size from page count', () => {
    it('should return S for < 50 pages', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 30 }));
      expect(result.baseSize).toBe('S');
    });

    it('should return M for 50-199 pages', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 100 }));
      expect(result.baseSize).toBe('M');
    });

    it('should return L for 200-499 pages', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 300 }));
      expect(result.baseSize).toBe('L');
    });

    it('should return XL for 500+ pages', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 1000 }));
      expect(result.baseSize).toBe('XL');
    });

    it('should prefer actualPageCount over estimatedPageCount', () => {
      const result = calculateEffortEstimation(
        createInput({ pageCount: 300, actualPageCount: 30 })
      );
      expect(result.baseSize).toBe('S');
    });
  });

  describe('boundary values', () => {
    it('should return S for exactly 49 pages', () => {
      expect(calculateEffortEstimation(createInput({ pageCount: 49 })).baseSize).toBe('S');
    });

    it('should return M for exactly 50 pages', () => {
      expect(calculateEffortEstimation(createInput({ pageCount: 50 })).baseSize).toBe('M');
    });

    it('should return M for exactly 199 pages', () => {
      expect(calculateEffortEstimation(createInput({ pageCount: 199 })).baseSize).toBe('M');
    });

    it('should return L for exactly 200 pages', () => {
      expect(calculateEffortEstimation(createInput({ pageCount: 200 })).baseSize).toBe('L');
    });

    it('should return L for exactly 499 pages', () => {
      expect(calculateEffortEstimation(createInput({ pageCount: 499 })).baseSize).toBe('L');
    });

    it('should return XL for exactly 500 pages', () => {
      expect(calculateEffortEstimation(createInput({ pageCount: 500 })).baseSize).toBe('XL');
    });
  });

  describe('multi-language multiplier', () => {
    it('should not bump size when multiLanguage is false', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 30 }));
      expect(result.finalSize).toBe('S');
      expect(result.multipliers).toHaveLength(0);
    });

    it('should bump size by 1 when multiLanguage is true', () => {
      const result = calculateEffortEstimation(
        createInput({ pageCount: 30, features: { multiLanguage: true } })
      );
      // S base -> M final
      expect(result.baseSize).toBe('S');
      expect(result.finalSize).toBe('M');
      expect(result.multipliers).toContainEqual(
        expect.objectContaining({ name: 'Multi-Language' })
      );
    });
  });

  describe('integration score multiplier', () => {
    it('should bump size when integration score > 5', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          features: {
            api: true, // +1
            ecommerce: true, // +2
            customFeatures: ['a', 'b', 'c'], // +3 = total 6
          },
        })
      );
      expect(result.multipliers).toContainEqual(
        expect.objectContaining({ name: 'Viele Integrationen' })
      );
    });

    it('should not bump size when integration score <= 5', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          features: {
            api: true, // +1
            customFeatures: ['a', 'b'], // +2 = total 3
          },
        })
      );
      expect(result.multipliers.find(m => m.name === 'Viele Integrationen')).toBeUndefined();
    });
  });

  describe('custom features multiplier', () => {
    it('should bump size for > 10 custom features', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          features: {
            customFeatures: Array.from({ length: 11 }, (_, i) => `feature-${i}`),
          },
        })
      );
      expect(result.multipliers).toContainEqual(
        expect.objectContaining({ name: 'Viele Custom-Features' })
      );
    });

    it('should not bump size for <= 10 custom features', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          features: {
            customFeatures: Array.from({ length: 10 }, (_, i) => `feature-${i}`),
          },
        })
      );
      expect(result.multipliers.find(m => m.name === 'Viele Custom-Features')).toBeUndefined();
    });
  });

  describe('migration complexity multiplier', () => {
    it('should bump size for complex migration', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          migrationComplexity: {
            score: 80,
            recommendation: 'complex',
            factors: {} as any,
            warnings: [],
          },
        })
      );
      expect(result.multipliers).toContainEqual(
        expect.objectContaining({ name: 'Hohe Migrationskomplexität' })
      );
    });

    it('should bump size for very_complex migration', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          migrationComplexity: {
            score: 90,
            recommendation: 'very_complex',
            factors: {} as any,
            warnings: [],
          },
        })
      );
      expect(result.multipliers).toContainEqual(
        expect.objectContaining({ name: 'Hohe Migrationskomplexität' })
      );
    });

    it('should not bump size for moderate migration', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 30,
          migrationComplexity: {
            score: 50,
            recommendation: 'moderate',
            factors: {} as any,
            warnings: [],
          },
        })
      );
      expect(result.multipliers.find(m => m.name === 'Hohe Migrationskomplexität')).toBeUndefined();
    });
  });

  describe('size clamping', () => {
    it('should clamp at XL when multiple multipliers stack', () => {
      const result = calculateEffortEstimation(
        createInput({
          pageCount: 500, // XL base
          features: {
            multiLanguage: true,
            api: true,
            ecommerce: true,
            customFeatures: Array.from({ length: 12 }, (_, i) => `f-${i}`),
          },
          migrationComplexity: {
            score: 90,
            recommendation: 'very_complex',
            factors: {} as any,
            warnings: [],
          },
        })
      );
      // Should not exceed XL
      expect(result.finalSize).toBe('XL');
    });

    it('should clamp at S as minimum', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 1 }));
      expect(result.finalSize).toBe('S');
    });
  });

  describe('result structure', () => {
    it('should include reasoning string', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 100 }));
      expect(result.reasoning).toContain('100 Seiten');
      expect(result.reasoning).toContain('Basis M');
      expect(result.reasoning.endsWith('.')).toBe(true);
    });

    it('should set tShirtSize equal to finalSize', () => {
      const result = calculateEffortEstimation(createInput({ pageCount: 100 }));
      expect(result.tShirtSize).toBe(result.finalSize);
    });
  });
});

describe('effortEstimationStep', () => {
  it('should have correct configuration', () => {
    expect(effortEstimationStep.config.name).toBe('effortEstimation');
    expect(effortEstimationStep.config.phase).toBe('synthesis');
    expect(effortEstimationStep.config.optional).toBe(true);
    expect(effortEstimationStep.config.dependencies).toContain('contentVolume');
    expect(effortEstimationStep.config.dependencies).toContain('features');
  });
});
