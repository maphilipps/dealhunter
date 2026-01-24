/**
 * Zod Validation Schemas für Business Rules Config
 *
 * Validiert Admin-Input bevor Config-Änderungen übernommen werden.
 */

import { z } from 'zod';

/**
 * BIT Evaluation Weights Schema
 *
 * Validierung:
 * - Alle Werte zwischen 0 und 1
 * - Summe muss 1.0 ergeben (±0.001 Toleranz für Rundungsfehler)
 */
export const bitEvaluationWeightsSchema = z
  .object({
    capability: z.number().min(0).max(1),
    dealQuality: z.number().min(0).max(1),
    strategicFit: z.number().min(0).max(1),
    winProbability: z.number().min(0).max(1),
    legal: z.number().min(0).max(1),
    reference: z.number().min(0).max(1),
  })
  .refine(
    data => {
      const sum =
        data.capability +
        data.dealQuality +
        data.strategicFit +
        data.winProbability +
        data.legal +
        data.reference;
      return Math.abs(sum - 1.0) < 0.001;
    },
    {
      message: 'Sum of weights must equal 1.0',
    }
  );

export type BitEvaluationWeights = z.infer<typeof bitEvaluationWeightsSchema>;

/**
 * BIT Threshold Schema
 *
 * Validierung: Wert zwischen 0 und 100
 */
export const bitThresholdSchema = z.number().min(0).max(100);

/**
 * CMS Score Schema
 *
 * Validierung: Score zwischen 0 und 100 für jedes CMS
 */
export const cmsScoreSchema = z.record(z.string(), z.number().min(0).max(100));

/**
 * CMS Industry Affinity Schema
 *
 * Validierung:
 * - Jede Branche hat CMS-Scores
 * - Alle Scores zwischen 0 und 100
 */
export const cmsIndustryAffinitySchema = z.record(z.string(), cmsScoreSchema);

export type CmsIndustryAffinity = z.infer<typeof cmsIndustryAffinitySchema>;

/**
 * Tech-to-BU Mapping Schema
 *
 * Validierung:
 * - Technologie-Name → Business Unit Name
 * - Beide müssen nicht-leere Strings sein
 */
export const techToBuMappingSchema = z.record(z.string().min(1), z.string().min(1));

export type TechToBuMapping = z.infer<typeof techToBuMappingSchema>;

/**
 * Complete Business Rules Config Schema
 */
export const businessRulesConfigSchema = z.object({
  bitEvaluationWeights: bitEvaluationWeightsSchema,
  bitThreshold: bitThresholdSchema,
  cmsIndustryAffinity: cmsIndustryAffinitySchema,
  techToBuMapping: techToBuMappingSchema,
});

export type BusinessRulesConfig = z.infer<typeof businessRulesConfigSchema>;
