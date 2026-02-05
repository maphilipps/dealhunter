/**
 * Business Rules Configuration
 *
 * Zentralisierte Geschäftslogik-Konfiguration für:
 * - BIT Scoring Weights
 * - CMS Industry Affinity
 * - Tech-to-BU Routing
 *
 * Diese Werte können über Admin UI angepasst werden.
 */

/**
 * BIT Evaluation Weights
 *
 * Gewichtung der einzelnen Faktoren bei der BID/NO-BID Entscheidung.
 * Summe muss 1.0 ergeben.
 */
export const BIT_EVALUATION_WEIGHTS = {
  capability: 0.25, // 25% - Capability Match
  dealQuality: 0.2, // 20% - Deal Quality
  strategicFit: 0.15, // 15% - Strategic Fit
  winProbability: 0.15, // 15% - Win Probability
  legal: 0.15, // 15% - Legal Constraints
  reference: 0.1, // 10% - Reference Match
} as const;

/**
 * BIT Decision Threshold
 *
 * Mindest-Score für BID-Empfehlung (0-100).
 * Score >= Threshold UND keine kritischen Blocker → BID
 */
export const BIT_THRESHOLD = 55;

/**
 * CMS Scoring Weights
 *
 * Gewichtung der einzelnen Faktoren beim CMS-Matching.
 * Summe muss 1.0 ergeben.
 */
export const CMS_SCORING_WEIGHTS = {
  feature: 0.4, // 40% - Feature Match
  industry: 0.2, // 20% - Industry Fit
  size: 0.15, // 15% - Size Match
  budget: 0.15, // 15% - Budget Match
  migration: 0.1, // 10% - Migration Complexity
} as const;

export type CmsScoringWeights = {
  [K in keyof typeof CMS_SCORING_WEIGHTS]: number;
};

/**
 * Helper: Calculate weighted CMS score
 *
 * Accepts optional weights parameter to allow injecting custom weights
 * (e.g. from database or A/B test config). Defaults to CMS_SCORING_WEIGHTS.
 */
export function calculateWeightedCmsScore(
  scores: {
    feature: number;
    industry: number;
    size: number;
    budget: number;
    migration: number;
  },
  weights: CmsScoringWeights = CMS_SCORING_WEIGHTS
): number {
  return Math.round(
    scores.feature * weights.feature +
      scores.industry * weights.industry +
      scores.size * weights.size +
      scores.budget * weights.budget +
      scores.migration * weights.migration
  );
}

/**
 * CMS Industry Affinity
 *
 * Branchen-spezifische CMS-Präferenzen (0-100 Scores).
 * Höherer Score = bessere Eignung für diese Branche.
 */
export const CMS_INDUSTRY_AFFINITY: Record<string, Record<string, number>> = {
  'Public Sector': {
    Drupal: 90,
    Ibexa: 70,
    Magnolia: 50,
    FirstSpirit: 40,
    Sulu: 60,
  },
  Government: {
    Drupal: 95,
    Ibexa: 75,
    Magnolia: 60,
    FirstSpirit: 50,
    Sulu: 55,
  },
  'Higher Education': {
    Drupal: 85,
    Ibexa: 70,
    Magnolia: 60,
    FirstSpirit: 65,
    Sulu: 75,
  },
  Healthcare: {
    Drupal: 80,
    Ibexa: 85,
    Magnolia: 70,
    FirstSpirit: 75,
    Sulu: 60,
  },
  Finance: {
    Drupal: 70,
    Ibexa: 80,
    Magnolia: 85,
    FirstSpirit: 90,
    Sulu: 50,
  },
  Retail: {
    Drupal: 75,
    Ibexa: 70,
    Magnolia: 65,
    FirstSpirit: 70,
    Sulu: 80,
  },
  Manufacturing: {
    Drupal: 65,
    Ibexa: 75,
    Magnolia: 80,
    FirstSpirit: 85,
    Sulu: 55,
  },
  Technology: {
    Drupal: 70,
    Ibexa: 65,
    Magnolia: 60,
    FirstSpirit: 65,
    Sulu: 85,
  },
  default: {
    Drupal: 70,
    Ibexa: 70,
    Magnolia: 70,
    FirstSpirit: 70,
    Sulu: 70,
  },
};

/**
 * Technology to Business Unit Mapping
 *
 * Deterministische Zuordnung von erkannten Technologien zu Business Units.
 * Verwendet für automatisches Routing ohne AI.
 */
export const TECH_TO_BU_MAPPING: Record<string, string> = {
  ibexa: 'PHP',
  firstspirit: 'WEM',
  'first spirit': 'WEM',
};

/**
 * Helper: Get CMS affinity score for industry
 */
export function getCmsAffinityScore(industry: string, cms: string): number {
  const industryMapping = CMS_INDUSTRY_AFFINITY[industry] || CMS_INDUSTRY_AFFINITY.default;
  return industryMapping[cms] || industryMapping.Drupal || 70;
}

export type BitWeights = {
  [K in keyof typeof BIT_EVALUATION_WEIGHTS]: number;
};

/**
 * Helper: Calculate weighted BIT score
 *
 * Accepts optional weights parameter to allow injecting custom weights
 * (e.g. from database or A/B test config). Defaults to BIT_EVALUATION_WEIGHTS.
 */
export function calculateWeightedBitScore(
  scores: {
    capability: number;
    dealQuality: number;
    strategicFit: number;
    winProbability: number;
    legal: number;
    reference: number;
  },
  weights: BitWeights = BIT_EVALUATION_WEIGHTS
): number {
  return (
    scores.capability * weights.capability +
    scores.dealQuality * weights.dealQuality +
    scores.strategicFit * weights.strategicFit +
    scores.winProbability * weights.winProbability +
    scores.legal * weights.legal +
    scores.reference * weights.reference
  );
}

/**
 * Helper: Check if score meets BID threshold
 *
 * Accepts optional threshold parameter to allow injecting custom thresholds
 * (e.g. from database or A/B test config). Defaults to BIT_THRESHOLD.
 */
export function meetsBidThreshold(
  score: number,
  hasCriticalBlockers: boolean,
  threshold: number = BIT_THRESHOLD
): boolean {
  return score >= threshold && !hasCriticalBlockers;
}

/**
 * Helper: Get Business Unit for technology
 */
export function getBusinessUnitForTech(tech: string): string | null {
  const normalizedTech = tech.toLowerCase().trim();
  return TECH_TO_BU_MAPPING[normalizedTech] || null;
}
