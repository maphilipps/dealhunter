import { describe, expect, it } from 'vitest';

import { buildIndicativeBudgetEstimateFromScanPayload } from '@/lib/qualifications/sections/budget-estimate';

describe('buildIndicativeBudgetEstimateFromScanPayload', () => {
  it('returns a budget indicator when qualification scan payload is usable', () => {
    const result = buildIndicativeBudgetEstimateFromScanPayload({
      contentVolume: { estimatedPageCount: 120 },
      features: { ecommerce: true, search: true, customFeatures: ['erp-sync'] },
      techStack: { cms: 'WordPress' },
      migrationComplexity: { recommendation: 'moderate' },
    });

    expect(result).not.toBeNull();
    expect(result?.scenarios.length).toBeGreaterThan(0);
    expect(result?.scenarios[0]?.totalCost).toBeGreaterThan(0);
  });

  it('returns null when required content volume data is missing', () => {
    const result = buildIndicativeBudgetEstimateFromScanPayload({
      features: { ecommerce: true },
      techStack: { cms: 'WordPress' },
    });

    expect(result).toBeNull();
  });
});
