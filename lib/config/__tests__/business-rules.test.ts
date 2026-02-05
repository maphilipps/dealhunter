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
