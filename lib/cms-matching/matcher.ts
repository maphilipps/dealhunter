/**
 * CMS Matching Module
 *
 * Matches Lead requirements against available CMS technologies using multi-criteria scoring.
 *
 * Scoring Weights:
 * - Feature Matching: 40%
 * - Industry Fit: 20%
 * - Size Match: 15%
 * - Budget Match: 15%
 * - Migration Complexity: 10%
 *
 * Returns top 3 ranked CMS options with reasoning.
 */

import { db } from '../db';
import { technologies, cmsMatchResults, type Technology } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ContentArchitectureResult } from '../agents/content-architecture-agent';
import type { MigrationComplexityResult } from '../agents/migration-complexity-agent';
import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { openai } from '../ai/providers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FeatureRequirement {
  name: string;
  importance: 'must_have' | 'nice_to_have';
  description?: string;
}

export interface CMSMatchScore {
  technologyId: string;
  technologyName: string;
  totalScore: number; // 0-100
  featureScore: number; // 0-100
  industryScore: number; // 0-100
  sizeScore: number; // 0-100
  budgetScore: number; // 0-100
  migrationScore: number; // 0-100
  matchedFeatures: {
    feature: string;
    supported: boolean;
    score: number;
  }[];
  reasoning: string;
  rank: number;
}

export interface CMSMatcherInput {
  leadId: string;
  industry?: string | null;
  budget?: string | null;
  pageCount: number;
  featureRequirements?: FeatureRequirement[];
  contentArchitecture: ContentArchitectureResult;
  migrationComplexity: MigrationComplexityResult;
  requiredBusinessUnitId?: string; // Optional: filter to specific BU
}

export interface CMSMatcherResult {
  success: boolean;
  matches: CMSMatchScore[];
  matchedAt: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scoring weights for different criteria
 */
const SCORING_WEIGHTS = {
  feature: 0.4, // 40%
  industry: 0.2, // 20%
  size: 0.15, // 15%
  budget: 0.15, // 15%
  migration: 0.1, // 10%
};

/**
 * Industry-to-CMS affinity mapping (0-100 scores)
 */
const INDUSTRY_AFFINITY = {
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
} as Record<string, Record<string, number>>;

/**
 * Size-based CMS affinity (based on page count)
 */
const SIZE_AFFINITY = {
  small: {
    min: 0,
    max: 100,
    cms: { Sulu: 90, Drupal: 75, Ibexa: 70, Magnolia: 60, FirstSpirit: 50 },
  },
  medium: {
    min: 100,
    max: 1000,
    cms: { Drupal: 90, Sulu: 85, Ibexa: 80, Magnolia: 75, FirstSpirit: 70 },
  },
  large: {
    min: 1000,
    max: 10000,
    cms: { Drupal: 85, Ibexa: 90, Magnolia: 85, FirstSpirit: 80, Sulu: 60 },
  },
  enterprise: {
    min: 10000,
    max: Infinity,
    cms: { Magnolia: 95, FirstSpirit: 95, Ibexa: 85, Drupal: 80, Sulu: 40 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Match CMS technologies against lead requirements
 *
 * @param input - Lead requirements and analysis results
 * @returns Top 3 CMS matches with scores and reasoning
 */
export async function matchCMS(input: CMSMatcherInput): Promise<CMSMatcherResult> {
  console.error(`[CMS Matcher] Starting CMS matching for lead ${input.leadId}`);

  try {
    const {
      leadId,
      industry,
      budget,
      pageCount,
      featureRequirements = [],
      contentArchitecture,
      migrationComplexity,
      requiredBusinessUnitId,
    } = input;

    // 1. Fetch all available CMS technologies
    const allTechnologies = await db.query.technologies.findMany({
      where: requiredBusinessUnitId
        ? eq(technologies.businessUnitId, requiredBusinessUnitId)
        : undefined,
    });

    if (allTechnologies.length === 0) {
      throw new Error('No CMS technologies found in database');
    }

    console.error(`[CMS Matcher] Found ${allTechnologies.length} CMS technologies`);

    // 2. Score each CMS
    const scoredMatches: CMSMatchScore[] = [];

    for (const technology of allTechnologies) {
      const score = await scoreCMS({
        technology,
        industry,
        budget,
        pageCount,
        featureRequirements,
        contentArchitecture,
        migrationComplexity,
      });

      scoredMatches.push(score);
    }

    // 3. Rank by total score (top 3)
    const rankedMatches = scoredMatches
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3)
      .map((match, index) => ({
        ...match,
        rank: index + 1,
      }));

    console.error('[CMS Matcher] Top 3 matches:', {
      matches: rankedMatches.map(m => ({ name: m.technologyName, score: m.totalScore })),
    });

    // 4. Save results to database
    await saveCMSMatchResults(leadId, rankedMatches);

    return {
      success: true,
      matches: rankedMatches,
      matchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[CMS Matcher] Error:', error);

    return {
      success: false,
      matches: [],
      matchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface ScoreCMSInput {
  technology: Technology;
  industry?: string | null;
  budget?: string | null;
  pageCount: number;
  featureRequirements: FeatureRequirement[];
  contentArchitecture: ContentArchitectureResult;
  migrationComplexity: MigrationComplexityResult;
}

/**
 * Calculate total score for a CMS technology
 */
async function scoreCMS(input: ScoreCMSInput): Promise<CMSMatchScore> {
  const { technology, industry, budget, pageCount, featureRequirements, migrationComplexity } =
    input;

  // 1. Feature Score (40%)
  const { featureScore, matchedFeatures } = calculateFeatureScore(technology, featureRequirements);

  // 2. Industry Score (20%)
  const industryScore = calculateIndustryScore(technology.name, industry);

  // 3. Size Score (15%)
  const sizeScore = calculateSizeScore(technology.name, pageCount);

  // 4. Budget Score (15%)
  const budgetScore = calculateBudgetScore(technology, budget);

  // 5. Migration Score (10%)
  const migrationScore = calculateMigrationScore(migrationComplexity);

  // 6. Calculate weighted total score
  const totalScore = Math.round(
    featureScore * SCORING_WEIGHTS.feature +
      industryScore * SCORING_WEIGHTS.industry +
      sizeScore * SCORING_WEIGHTS.size +
      budgetScore * SCORING_WEIGHTS.budget +
      migrationScore * SCORING_WEIGHTS.migration
  );

  // 7. Generate reasoning with AI
  const reasoning = await generateReasoning({
    technologyName: technology.name,
    totalScore,
    featureScore,
    industryScore,
    sizeScore,
    budgetScore,
    migrationScore,
    industry,
    pageCount,
    budget,
    matchedFeatures,
    migrationComplexity,
  });

  return {
    technologyId: technology.id,
    technologyName: technology.name,
    totalScore,
    featureScore,
    industryScore,
    sizeScore,
    budgetScore,
    migrationScore,
    matchedFeatures,
    reasoning,
    rank: 0, // Will be set during ranking
  };
}

/**
 * Calculate feature match score (40% weight)
 */
function calculateFeatureScore(
  technology: Technology,
  featureRequirements: FeatureRequirement[]
): {
  featureScore: number;
  matchedFeatures: { feature: string; supported: boolean; score: number }[];
} {
  if (featureRequirements.length === 0) {
    // No specific requirements → neutral score
    return { featureScore: 70, matchedFeatures: [] };
  }

  // Parse technology features (if available)
  const technologyFeatures = technology.features
    ? (JSON.parse(technology.features) as Record<string, { supported: boolean; score?: number }>)
    : {};

  const matchedFeatures: { feature: string; supported: boolean; score: number }[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  for (const requirement of featureRequirements) {
    const featureData = technologyFeatures[requirement.name];
    const supported = featureData?.supported ?? false;
    const featureScore = supported ? (featureData.score ?? 80) : 0;

    const weight = requirement.importance === 'must_have' ? 2 : 1;
    totalScore += featureScore * weight;
    totalWeight += 100 * weight;

    matchedFeatures.push({
      feature: requirement.name,
      supported,
      score: featureScore,
    });
  }

  const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 70;

  return { featureScore: finalScore, matchedFeatures };
}

/**
 * Calculate industry fit score (20% weight)
 */
function calculateIndustryScore(cmsName: string, industry?: string | null): number {
  if (!industry) {
    return 70; // Neutral score if industry unknown
  }

  const affinityMap = INDUSTRY_AFFINITY[industry] || INDUSTRY_AFFINITY.default;
  return affinityMap[cmsName] || 70;
}

/**
 * Calculate size match score (15% weight)
 */
function calculateSizeScore(cmsName: string, pageCount: number): number {
  for (const sizeCategory of Object.values(SIZE_AFFINITY)) {
    if (pageCount >= sizeCategory.min && pageCount < sizeCategory.max) {
      return (sizeCategory.cms[cmsName] as number | undefined) || 70;
    }
  }

  return 70; // Fallback
}

/**
 * Calculate budget match score (15% weight)
 *
 * Budget scoring logic:
 * - Extract min/max from budget range (e.g., "50-100k EUR")
 * - Compare against CMS typical project size
 * - Higher budget → better fit for enterprise CMS (Magnolia, FirstSpirit)
 * - Lower budget → better fit for open-source CMS (Drupal, Sulu)
 */
function calculateBudgetScore(technology: Technology, budget?: string | null): number {
  if (!budget) {
    return 70; // Neutral if budget unknown
  }

  // Extract budget range (simple regex)
  const match = budget.match(/(\d+)(?:-(\d+))?k?\s*(?:EUR|€)?/i);
  if (!match) {
    return 70; // Can't parse → neutral
  }

  const minBudget = parseInt(match[1], 10) * 1000;
  const maxBudget = match[2] ? parseInt(match[2], 10) * 1000 : minBudget;
  const avgBudget = (minBudget + maxBudget) / 2;

  // Budget affinity (higher budget → better for enterprise CMS)
  const budgetAffinity: Record<string, { minBudget: number; maxBudget: number }> = {
    Sulu: { minBudget: 20000, maxBudget: 100000 },
    Drupal: { minBudget: 30000, maxBudget: 200000 },
    Ibexa: { minBudget: 50000, maxBudget: 300000 },
    Magnolia: { minBudget: 100000, maxBudget: 500000 },
    FirstSpirit: { minBudget: 150000, maxBudget: 1000000 },
  };

  const affinity = budgetAffinity[technology.name];
  if (!affinity) {
    return 70; // Unknown CMS → neutral
  }

  // Score based on budget fit
  if (avgBudget >= affinity.minBudget && avgBudget <= affinity.maxBudget) {
    return 90; // Perfect fit
  } else if (avgBudget < affinity.minBudget) {
    // Budget too low
    const gap = (affinity.minBudget - avgBudget) / affinity.minBudget;
    return Math.max(30, Math.round(90 - gap * 60));
  } else {
    // Budget higher than max (still good, but maybe overkill)
    return 85;
  }
}

/**
 * Calculate migration complexity score (10% weight)
 *
 * Lower complexity → higher score (easier migration)
 */
function calculateMigrationScore(migrationComplexity: MigrationComplexityResult): number {
  if (!migrationComplexity.success) {
    return 70; // Neutral if analysis failed
  }

  // Invert complexity score (0-100) → higher complexity = lower migration score
  const complexityScore = migrationComplexity.complexityScore;

  // Linear inversion: 0 complexity = 100 score, 100 complexity = 30 score
  return Math.round(100 - complexityScore * 0.7);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI REASONING GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

interface GenerateReasoningInput {
  technologyName: string;
  totalScore: number;
  featureScore: number;
  industryScore: number;
  sizeScore: number;
  budgetScore: number;
  migrationScore: number;
  industry?: string | null;
  pageCount: number;
  budget?: string | null;
  matchedFeatures: { feature: string; supported: boolean; score: number }[];
  migrationComplexity: MigrationComplexityResult;
}

/**
 * Generate human-readable reasoning for CMS recommendation
 */
async function generateReasoning(input: GenerateReasoningInput): Promise<string> {
  const ReasoningSchema = z.object({
    reasoning: z
      .string()
      .describe(
        'Concise 2-3 sentence reasoning for why this CMS is a good/bad fit (focus on strengths/weaknesses)'
      ),
  });

  try {
    const { object } = await generateObject({
      model: openai('claude-sonnet-4') as unknown as LanguageModel,
      schema: ReasoningSchema,
      prompt: `Generate a concise recommendation reasoning for this CMS match.

**CMS:** ${input.technologyName}
**Total Score:** ${input.totalScore}/100

**Score Breakdown:**
- Feature Match: ${input.featureScore}/100
- Industry Fit: ${input.industryScore}/100 (Industry: ${input.industry || 'Unknown'})
- Size Match: ${input.sizeScore}/100 (Pages: ~${input.pageCount})
- Budget Fit: ${input.budgetScore}/100 (Budget: ${input.budget || 'Unknown'})
- Migration Ease: ${input.migrationScore}/100 (Complexity: ${input.migrationComplexity.complexityCategory})

**Matched Features:**
${input.matchedFeatures.map(f => `- ${f.feature}: ${f.supported ? '✓' : '✗'} (${f.score}/100)`).join('\n')}

**Instructions:**
- Keep it concise (2-3 sentences)
- Focus on the most impactful factors (highest/lowest scores)
- Mention key strengths and potential concerns
- Be specific about industry/size/budget fit if relevant`,
    });

    return object.reasoning;
  } catch (error) {
    console.error('[CMS Matcher] Failed to generate reasoning:', error);

    // Fallback reasoning
    return `${input.technologyName} scores ${input.totalScore}/100 overall. Strong fit for ${input.industry || 'general'} projects with ~${input.pageCount} pages.`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save CMS match results to database
 */
async function saveCMSMatchResults(leadId: string, matches: CMSMatchScore[]): Promise<void> {
  console.error(`[CMS Matcher] Saving ${matches.length} match results for lead ${leadId}`);

  // Delete existing results for this lead
  await db.delete(cmsMatchResults).where(eq(cmsMatchResults.leadId, leadId));

  // Insert new results
  for (const match of matches) {
    await db.insert(cmsMatchResults).values({
      leadId,
      technologyId: match.technologyId,
      totalScore: match.totalScore,
      featureScore: match.featureScore,
      industryScore: match.industryScore,
      sizeScore: match.sizeScore,
      budgetScore: match.budgetScore,
      migrationScore: match.migrationScore,
      matchedFeatures: JSON.stringify(match.matchedFeatures),
      reasoning: match.reasoning,
      rank: match.rank,
    });
  }

  console.error('[CMS Matcher] Match results saved successfully');
}
