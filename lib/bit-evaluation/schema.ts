import { z } from 'zod';

/**
 * BIT-002: Capability Match Schema
 * Evaluates if adesso has the technical capabilities to deliver this project
 */
export const capabilityMatchSchema = z.object({
  hasRequiredTechnologies: z.boolean().describe('Does adesso have expertise in the required technologies?'),
  technologyMatchScore: z.number().min(0).max(100).describe('Score for technology match (0-100)'),
  missingCapabilities: z.array(z.string()).describe('List of capabilities adesso does not have'),

  hasRequiredScale: z.boolean().describe('Can adesso handle the project scale (team size, timeline)?'),
  scaleMatchScore: z.number().min(0).max(100).describe('Score for scale match (0-100)'),
  scaleGaps: z.array(z.string()).describe('List of scale-related gaps'),

  overallCapabilityScore: z.number().min(0).max(100).describe('Overall capability match score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of capability assessment'),
  criticalBlockers: z.array(z.string()).describe('Critical capability blockers that would prevent success'),
});

export type CapabilityMatch = z.infer<typeof capabilityMatchSchema>;

/**
 * BIT-003: Deal Quality Schema
 * Evaluates budget, timeline, and margin potential
 */
export const dealQualitySchema = z.object({
  budgetAssessment: z.object({
    isAdequate: z.boolean().describe('Is the budget adequate for the scope?'),
    estimatedMargin: z.number().min(0).max(100).describe('Estimated margin percentage (0-100)'),
    budgetRisks: z.array(z.string()).describe('Budget-related risks'),
  }),

  timelineAssessment: z.object({
    isRealistic: z.boolean().describe('Is the timeline realistic for the scope?'),
    timelinePressure: z.enum(['low', 'medium', 'high']).describe('Pressure level for timeline'),
    timelineRisks: z.array(z.string()).describe('Timeline-related risks'),
  }),

  commercialViability: z.object({
    expectedRevenue: z.string().describe('Expected revenue range (e.g., "€100k-€500k")'),
    profitabilityRating: z.enum(['low', 'medium', 'high']).describe('Expected profitability'),
    commercialRisks: z.array(z.string()).describe('Commercial risks'),
  }),

  overallDealQualityScore: z.number().min(0).max(100).describe('Overall deal quality score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of deal quality assessment'),
  criticalBlockers: z.array(z.string()).describe('Critical deal quality blockers'),
});

export type DealQuality = z.infer<typeof dealQualitySchema>;

/**
 * BIT-004: Strategic Fit Schema
 * Evaluates alignment with adesso strategy and customer type
 */
export const strategicFitSchema = z.object({
  customerTypeAssessment: z.object({
    customerType: z.string().describe('Type of customer (enterprise, mid-market, startup, etc.)'),
    isTargetCustomer: z.boolean().describe('Is this our target customer profile?'),
    customerFitScore: z.number().min(0).max(100).describe('How well customer fits our profile'),
  }),

  industryAlignment: z.object({
    industry: z.string().describe('Customer industry'),
    isTargetIndustry: z.boolean().describe('Is this a target industry for adesso?'),
    industryExperience: z.enum(['none', 'limited', 'moderate', 'extensive']).describe('Our experience in this industry'),
    industryFitScore: z.number().min(0).max(100).describe('Industry alignment score'),
  }),

  strategicValue: z.object({
    isReferenceProject: z.boolean().describe('Could this become a reference project?'),
    enablesNewMarket: z.boolean().describe('Opens doors to new markets?'),
    expandsExistingRelationship: z.boolean().describe('Expands relationship with existing customer?'),
    longTermPotential: z.enum(['low', 'medium', 'high']).describe('Long-term relationship potential'),
  }),

  overallStrategicFitScore: z.number().min(0).max(100).describe('Overall strategic fit score'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of strategic fit'),
  criticalBlockers: z.array(z.string()).describe('Strategic fit blockers'),
});

export type StrategicFit = z.infer<typeof strategicFitSchema>;

/**
 * BIT-005: Competition Check Schema
 * Analyzes competitive situation and win probability
 */
export const competitionCheckSchema = z.object({
  competitiveAnalysis: z.object({
    competitionLevel: z.enum(['none', 'low', 'medium', 'high', 'very_high']).describe('Level of competition'),
    knownCompetitors: z.array(z.string()).describe('List of known/likely competitors'),
    ourDifferentiators: z.array(z.string()).describe('What differentiates adesso from competitors'),
    competitiveWeaknesses: z.array(z.string()).describe('Areas where competitors might be stronger'),
  }),

  winProbabilityFactors: z.object({
    hasIncumbentAdvantage: z.boolean().describe('Do we have incumbent advantage?'),
    hasExistingRelationship: z.boolean().describe('Do we have existing relationship with customer?'),
    hasUniqueCapability: z.boolean().describe('Do we have unique capabilities competitors lack?'),
    pricingPosition: z.enum(['low', 'competitive', 'premium']).describe('Our likely pricing position'),
  }),

  estimatedWinProbability: z.number().min(0).max(100).describe('Estimated win probability (0-100)'),
  confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
  reasoning: z.string().describe('Detailed explanation of competition analysis'),
  criticalBlockers: z.array(z.string()).describe('Competition-related blockers'),
});

export type CompetitionCheck = z.infer<typeof competitionCheckSchema>;

/**
 * BIT-006: BIT Decision Schema
 * Final coordinated decision
 */
export const bitDecisionSchema = z.object({
  decision: z.enum(['bit', 'no_bit']).describe('Final BIT or NO BIT decision'),

  scores: z.object({
    capability: z.number().min(0).max(100).describe('Capability score (30% weight)'),
    dealQuality: z.number().min(0).max(100).describe('Deal quality score (25% weight)'),
    strategicFit: z.number().min(0).max(100).describe('Strategic fit score (20% weight)'),
    winProbability: z.number().min(0).max(100).describe('Win probability (25% weight)'),
    overall: z.number().min(0).max(100).describe('Weighted overall score'),
  }),

  overallConfidence: z.number().min(0).max(100).describe('Overall confidence in decision'),

  keyStrengths: z.array(z.string()).describe('Top 3-5 strengths for this opportunity'),
  keyRisks: z.array(z.string()).describe('Top 3-5 risks for this opportunity'),
  criticalBlockers: z.array(z.string()).describe('Any critical blockers found'),

  reasoning: z.string().describe('Executive summary of decision reasoning'),
  nextSteps: z.array(z.string()).describe('Recommended next steps'),
});

export type BitDecision = z.infer<typeof bitDecisionSchema>;

/**
 * BIT-007: Alternative Recommendation Schema
 * For NO BIT decisions - suggest alternatives
 */
export const alternativeRecSchema = z.object({
  recommendedAlternative: z.enum([
    'partner_collaboration',
    'partial_scope',
    'delay_and_reassess',
    'refer_to_competitor',
    'decline_gracefully',
  ]).describe('Recommended alternative approach'),

  partnerSuggestions: z.array(z.string()).describe('Potential partners if applicable'),

  reducedScopeOptions: z.array(z.object({
    scope: z.string().describe('Reduced scope description'),
    viability: z.enum(['low', 'medium', 'high']).describe('Viability of this reduced scope'),
  })).describe('Options for reduced scope if applicable'),

  reasoning: z.string().describe('Why this alternative is recommended'),

  customerCommunication: z.string().describe('Suggested communication to customer'),
});

export type AlternativeRec = z.infer<typeof alternativeRecSchema>;

/**
 * Complete BIT Evaluation Result
 * Combines all agent outputs
 */
export const bitEvaluationResultSchema = z.object({
  // Individual agent results
  capabilityMatch: capabilityMatchSchema,
  dealQuality: dealQualitySchema,
  strategicFit: strategicFitSchema,
  competitionCheck: competitionCheckSchema,

  // Coordinated decision
  decision: bitDecisionSchema,

  // Alternative (if NO BIT)
  alternative: alternativeRecSchema.optional(),

  // Metadata
  evaluatedAt: z.string().describe('ISO timestamp of evaluation'),
  evaluationDuration: z.number().describe('Duration in milliseconds'),
});

export type BitEvaluationResult = z.infer<typeof bitEvaluationResultSchema>;
