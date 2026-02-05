import { describe, it, expect } from 'vitest';

import {
  BIT_EVALUATION_WEIGHTS,
  BIT_THRESHOLD,
  calculateWeightedBitScore,
  meetsBidThreshold,
  getCmsAffinityScore,
  getBusinessUnitForTech,
  CMS_SCORING_WEIGHTS,
  calculateWeightedCmsScore,
  CMS_SIZE_AFFINITY,
  getCmsSizeAffinityScore,
  CMS_INDUSTRY_AFFINITY,
} from '../business-rules';

describe('BIT_EVALUATION_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum = Object.values(BIT_EVALUATION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
});

describe('calculateWeightedBitScore', () => {
  const uniformScores = {
    capability: 80,
    dealQuality: 80,
    strategicFit: 80,
    winProbability: 80,
    legal: 80,
    reference: 80,
  };

  it('returns 80 when all scores are 80 (default weights)', () => {
    expect(calculateWeightedBitScore(uniformScores)).toBeCloseTo(80, 1);
  });

  it('returns 0 when all scores are 0', () => {
    const zeroScores = {
      capability: 0,
      dealQuality: 0,
      strategicFit: 0,
      winProbability: 0,
      legal: 0,
      reference: 0,
    };
    expect(calculateWeightedBitScore(zeroScores)).toBe(0);
  });

  it('weights capability highest with default weights', () => {
    const capabilityOnly = {
      capability: 100,
      dealQuality: 0,
      strategicFit: 0,
      winProbability: 0,
      legal: 0,
      reference: 0,
    };
    expect(calculateWeightedBitScore(capabilityOnly)).toBeCloseTo(25, 1);
  });

  it('accepts custom weights', () => {
    const customWeights = {
      capability: 0.5,
      dealQuality: 0.1,
      strategicFit: 0.1,
      winProbability: 0.1,
      legal: 0.1,
      reference: 0.1,
    } as const;

    const scores = {
      capability: 100,
      dealQuality: 0,
      strategicFit: 0,
      winProbability: 0,
      legal: 0,
      reference: 0,
    };

    expect(calculateWeightedBitScore(scores, customWeights)).toBeCloseTo(50, 1);
  });

  it('uses default weights when none provided', () => {
    const result1 = calculateWeightedBitScore(uniformScores);
    const result2 = calculateWeightedBitScore(uniformScores, BIT_EVALUATION_WEIGHTS);
    expect(result1).toBe(result2);
  });
});

describe('meetsBidThreshold', () => {
  it('returns true when score meets threshold and no blockers', () => {
    expect(meetsBidThreshold(55, false)).toBe(true);
  });

  it('returns false when score is below threshold', () => {
    expect(meetsBidThreshold(54, false)).toBe(false);
  });

  it('returns false when there are critical blockers', () => {
    expect(meetsBidThreshold(90, true)).toBe(false);
  });

  it('returns false when score is below AND blockers exist', () => {
    expect(meetsBidThreshold(30, true)).toBe(false);
  });

  it('accepts custom threshold', () => {
    expect(meetsBidThreshold(70, false, 70)).toBe(true);
    expect(meetsBidThreshold(69, false, 70)).toBe(false);
  });

  it('uses default threshold when none provided', () => {
    expect(meetsBidThreshold(BIT_THRESHOLD, false)).toBe(true);
    expect(meetsBidThreshold(BIT_THRESHOLD - 1, false)).toBe(false);
  });
});

describe('CMS_INDUSTRY_AFFINITY', () => {
  it('has a default entry', () => {
    expect(CMS_INDUSTRY_AFFINITY).toHaveProperty('default');
  });

  it('has at least 8 industry entries plus default', () => {
    expect(Object.keys(CMS_INDUSTRY_AFFINITY).length).toBeGreaterThanOrEqual(9);
  });

  it('has scores in 0-100 range for all entries', () => {
    for (const [, cmsScores] of Object.entries(CMS_INDUSTRY_AFFINITY)) {
      for (const [, score] of Object.entries(cmsScores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('getCmsAffinityScore', () => {
  it('returns known score for valid industry and CMS', () => {
    expect(getCmsAffinityScore('Finance', 'FirstSpirit')).toBe(90);
  });

  it('falls back to default for unknown industry', () => {
    expect(getCmsAffinityScore('Unknown Industry', 'Drupal')).toBe(70);
  });

  it('falls back to Drupal score for unknown CMS in known industry', () => {
    expect(getCmsAffinityScore('Finance', 'UnknownCMS')).toBe(70);
  });

  it('accepts custom industry affinity config', () => {
    const customAffinity = {
      Automotive: { CustomCMS: 95, Drupal: 60 },
      default: { CustomCMS: 50, Drupal: 70 },
    };

    expect(getCmsAffinityScore('Automotive', 'CustomCMS', customAffinity)).toBe(95);
    expect(getCmsAffinityScore('Automotive', 'Drupal', customAffinity)).toBe(60);
  });

  it('falls back to custom default for unknown industry in custom config', () => {
    const customAffinity = {
      Automotive: { CustomCMS: 95 },
      default: { CustomCMS: 50, Drupal: 80 },
    };

    expect(getCmsAffinityScore('Unknown', 'CustomCMS', customAffinity)).toBe(50);
    expect(getCmsAffinityScore('Unknown', 'Drupal', customAffinity)).toBe(80);
  });

  it('returns 70 fallback when custom config has no default and industry is unknown', () => {
    const customAffinity = {
      Automotive: { CustomCMS: 95 },
    };

    expect(getCmsAffinityScore('Unknown', 'CustomCMS', customAffinity)).toBe(70);
  });

  it('uses default config when none provided', () => {
    const result1 = getCmsAffinityScore('Finance', 'FirstSpirit');
    const result2 = getCmsAffinityScore('Finance', 'FirstSpirit', CMS_INDUSTRY_AFFINITY);
    expect(result1).toBe(result2);
  });
});

describe('getBusinessUnitForTech', () => {
  it('maps ibexa to PHP', () => {
    expect(getBusinessUnitForTech('ibexa')).toBe('PHP');
  });

  it('maps firstspirit to WEM', () => {
    expect(getBusinessUnitForTech('FirstSpirit')).toBe('WEM');
  });

  it('returns null for unknown tech', () => {
    expect(getBusinessUnitForTech('react')).toBeNull();
  });
});

describe('CMS_SCORING_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum = Object.values(CMS_SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('has all required keys', () => {
    expect(CMS_SCORING_WEIGHTS).toHaveProperty('feature');
    expect(CMS_SCORING_WEIGHTS).toHaveProperty('industry');
    expect(CMS_SCORING_WEIGHTS).toHaveProperty('size');
    expect(CMS_SCORING_WEIGHTS).toHaveProperty('budget');
    expect(CMS_SCORING_WEIGHTS).toHaveProperty('migration');
  });
});

describe('calculateWeightedCmsScore', () => {
  const uniformScores = {
    feature: 80,
    industry: 80,
    size: 80,
    budget: 80,
    migration: 80,
  };

  it('returns 80 when all scores are 80 (default weights)', () => {
    expect(calculateWeightedCmsScore(uniformScores)).toBe(80);
  });

  it('returns 0 when all scores are 0', () => {
    const zeroScores = { feature: 0, industry: 0, size: 0, budget: 0, migration: 0 };
    expect(calculateWeightedCmsScore(zeroScores)).toBe(0);
  });

  it('weights feature highest with default weights', () => {
    const featureOnly = { feature: 100, industry: 0, size: 0, budget: 0, migration: 0 };
    expect(calculateWeightedCmsScore(featureOnly)).toBe(40);
  });

  it('weights industry second highest with default weights', () => {
    const industryOnly = { feature: 0, industry: 100, size: 0, budget: 0, migration: 0 };
    expect(calculateWeightedCmsScore(industryOnly)).toBe(20);
  });

  it('accepts custom weights', () => {
    const customWeights = {
      feature: 0.6,
      industry: 0.1,
      size: 0.1,
      budget: 0.1,
      migration: 0.1,
    };

    const scores = { feature: 100, industry: 0, size: 0, budget: 0, migration: 0 };
    expect(calculateWeightedCmsScore(scores, customWeights)).toBe(60);
  });

  it('uses default weights when none provided', () => {
    const result1 = calculateWeightedCmsScore(uniformScores);
    const result2 = calculateWeightedCmsScore(uniformScores, CMS_SCORING_WEIGHTS);
    expect(result1).toBe(result2);
  });

  it('rounds to nearest integer', () => {
    const scores = { feature: 33, industry: 67, size: 51, budget: 89, migration: 12 };
    const result = calculateWeightedCmsScore(scores);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('handles equal custom weights', () => {
    const equalWeights = { feature: 0.2, industry: 0.2, size: 0.2, budget: 0.2, migration: 0.2 };
    const scores = { feature: 100, industry: 50, size: 50, budget: 50, migration: 50 };
    expect(calculateWeightedCmsScore(scores, equalWeights)).toBe(60);
  });
});

describe('CMS_SIZE_AFFINITY', () => {
  it('has all four size tiers', () => {
    expect(CMS_SIZE_AFFINITY).toHaveProperty('small');
    expect(CMS_SIZE_AFFINITY).toHaveProperty('medium');
    expect(CMS_SIZE_AFFINITY).toHaveProperty('large');
    expect(CMS_SIZE_AFFINITY).toHaveProperty('enterprise');
  });

  it('has contiguous page count ranges with no gaps', () => {
    expect(CMS_SIZE_AFFINITY.small.min).toBe(0);
    expect(CMS_SIZE_AFFINITY.small.max).toBe(CMS_SIZE_AFFINITY.medium.min);
    expect(CMS_SIZE_AFFINITY.medium.max).toBe(CMS_SIZE_AFFINITY.large.min);
    expect(CMS_SIZE_AFFINITY.large.max).toBe(CMS_SIZE_AFFINITY.enterprise.min);
    expect(CMS_SIZE_AFFINITY.enterprise.max).toBe(Infinity);
  });

  it('has CMS scores in each tier', () => {
    for (const tier of Object.values(CMS_SIZE_AFFINITY)) {
      expect(Object.keys(tier.cms).length).toBeGreaterThan(0);
    }
  });
});

describe('getCmsSizeAffinityScore', () => {
  it('returns correct score for small site (Sulu)', () => {
    expect(getCmsSizeAffinityScore('Sulu', 50)).toBe(90);
  });

  it('returns correct score for medium site (Drupal)', () => {
    expect(getCmsSizeAffinityScore('Drupal', 500)).toBe(90);
  });

  it('returns correct score for large site (Ibexa)', () => {
    expect(getCmsSizeAffinityScore('Ibexa', 5000)).toBe(90);
  });

  it('returns correct score for enterprise site (Magnolia)', () => {
    expect(getCmsSizeAffinityScore('Magnolia', 20000)).toBe(95);
  });

  it('returns 70 fallback for unknown CMS in known tier', () => {
    expect(getCmsSizeAffinityScore('UnknownCMS', 50)).toBe(70);
  });

  it('returns score at exact tier boundary (lower bound inclusive)', () => {
    // 100 pages = medium tier (min: 100, max: 1000)
    expect(getCmsSizeAffinityScore('Drupal', 100)).toBe(90);
  });

  it('returns score at tier boundary (upper bound exclusive)', () => {
    // 99 pages = small tier (min: 0, max: 100)
    expect(getCmsSizeAffinityScore('Drupal', 99)).toBe(75);
  });

  it('handles 0 page count (small tier)', () => {
    expect(getCmsSizeAffinityScore('Sulu', 0)).toBe(90);
  });

  it('accepts custom size affinity tiers', () => {
    const customTiers = {
      tiny: { min: 0, max: 10, cms: { CustomCMS: 99 } as Record<string, number> },
      huge: { min: 10, max: Infinity, cms: { CustomCMS: 50 } as Record<string, number> },
    };

    expect(getCmsSizeAffinityScore('CustomCMS', 5, customTiers)).toBe(99);
    expect(getCmsSizeAffinityScore('CustomCMS', 100, customTiers)).toBe(50);
  });

  it('uses default tiers when none provided', () => {
    const result1 = getCmsSizeAffinityScore('Drupal', 500);
    const result2 = getCmsSizeAffinityScore('Drupal', 500, CMS_SIZE_AFFINITY);
    expect(result1).toBe(result2);
  });
});
