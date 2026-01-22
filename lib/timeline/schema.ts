import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

const sanitizedString = z.string().transform(val => {
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
});

/**
 * Project Phase (Simplified for Phase 1 Timeline)
 *
 * Lightweight phase structure for early timeline estimates
 * during Quick Scan. More detailed than just duration,
 * but simpler than full project planning.
 */
export const projectPhaseSchema = z.object({
  name: sanitizedString.describe('Phase name (e.g., "Setup & Discovery", "Development")'),
  durationDays: z.number().int().positive().describe('Duration in working days'),
  startDay: z
    .number()
    .int()
    .nonnegative()
    .describe('Start day relative to project start (0-based)'),
  endDay: z.number().int().nonnegative().describe('End day relative to project start'),
  dependencies: z.array(sanitizedString).optional().describe('Phase dependencies'),
  keyActivities: z.array(sanitizedString).describe('Main activities in this phase'),
  canParallelize: z.boolean().optional().describe('Can this phase run in parallel with others'),
});

export type ProjectPhase = z.infer<typeof projectPhaseSchema>;

/**
 * Project Timeline (Phase 1 - Quick Estimate)
 *
 * Early timeline estimate generated during Quick Scan.
 * Provides BD Manager and BL with realistic timeline expectations
 * BEFORE deep analysis.
 */
export const projectTimelineSchema = z.object({
  // Summary
  totalDays: z.number().int().positive().describe('Total project duration in working days'),
  totalWeeks: z.number().int().positive().describe('Total duration in weeks'),
  totalMonths: z.number().positive().describe('Total duration in months'),

  // Timeline
  estimatedStart: z
    .string()
    .nullable()
    .describe('Estimated start date (ISO format) or null if not specified'),
  estimatedGoLive: z
    .string()
    .nullable()
    .describe('Estimated go-live date (ISO format) or null if not specified'),

  // Phases
  phases: z.array(projectPhaseSchema).describe('Project phases with durations'),

  // Team Assumptions
  assumedTeamSize: z
    .object({
      min: z.number().int().positive(),
      optimal: z.number().int().positive(),
      max: z.number().int().positive(),
    })
    .describe('Assumed team size for this estimate'),

  // Confidence & Assumptions
  confidence: z.number().min(0).max(100).describe('Confidence level of estimate (0-100)'),
  assumptions: z.array(sanitizedString).describe('Key assumptions made for this timeline'),

  // Risk Factors
  risks: z
    .array(
      z.object({
        factor: sanitizedString.describe('Risk factor'),
        impact: z.enum(['low', 'medium', 'high']).describe('Potential impact on timeline'),
        likelihood: z.enum(['low', 'medium', 'high']).describe('Likelihood of occurrence'),
      })
    )
    .optional()
    .describe('Identified timeline risks'),

  // Calculation Basis
  calculationBasis: z
    .object({
      contentVolume: sanitizedString.describe(
        'Content volume factor (e.g., "~100 pages, 10 content types")'
      ),
      complexity: z
        .enum(['low', 'medium', 'high', 'very_high'])
        .describe('Overall complexity assessment'),
      integrations: z.number().int().nonnegative().describe('Number of integrations detected'),
      hasCriticalDeadline: z.boolean().describe('Whether there is a hard deadline from RFP'),
    })
    .describe('Basis for timeline calculation'),

  // Metadata
  generatedAt: z.string().datetime().describe('Generation timestamp'),
  phase: z
    .literal('quick_scan')
    .describe('Timeline phase (always "quick_scan" for early estimates)'),
});

export type ProjectTimeline = z.infer<typeof projectTimelineSchema>;

/**
 * Standard Phases Template
 * Used by Timeline Agent as baseline for estimation
 */
export const STANDARD_PHASES = [
  'Setup & Discovery',
  'Design & Prototyping',
  'Frontend Development',
  'Backend & CMS Integration',
  'QA & Testing',
  'Go-Live & Deployment',
] as const;

/**
 * Phase Distribution Percentages (typical)
 * Based on adesso's project history
 */
export const PHASE_DISTRIBUTION = {
  'Setup & Discovery': 0.1, // 10%
  'Design & Prototyping': 0.15, // 15%
  'Frontend Development': 0.25, // 25%
  'Backend & CMS Integration': 0.25, // 25%
  'QA & Testing': 0.15, // 15%
  'Go-Live & Deployment': 0.1, // 10%
} as const;

/**
 * Complexity Multipliers
 * Applied to base timeline based on detected complexity
 */
export const COMPLEXITY_MULTIPLIERS = {
  low: 0.8,
  medium: 1.0,
  high: 1.3,
  very_high: 1.6,
} as const;

/**
 * Team Size Impact
 * Adjustment factor based on team size
 */
export const TEAM_SIZE_FACTORS = {
  small: { size: 2, factor: 1.3 }, // 2 people - slower but possible
  standard: { size: 4, factor: 1.0 }, // 3-4 people - optimal
  large: { size: 6, factor: 0.85 }, // 5-6 people - faster but coordination overhead
  very_large: { size: 10, factor: 0.75 }, // 10+ people - fastest but high overhead
} as const;

/**
 * Risk Analysis Schema
 *
 * Compares RFP deadline with AI-generated timeline estimate
 * to identify unrealistic timelines and provide risk warnings.
 */
export const riskAnalysisSchema = z.object({
  risk: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Risk level based on timeline delta'),
  deltaDays: z.number().describe('Difference in working days (RFP - AI estimate)'),
  warning: sanitizedString.describe('Human-readable warning message'),
  rfpDeadline: z
    .string()
    .nullable()
    .describe('RFP deadline in ISO format, or null if not specified'),
  aiEstimatedCompletion: z
    .string()
    .nullable()
    .describe('AI estimated completion date in ISO format'),
  isRealistic: z.boolean().describe('Whether the RFP deadline is realistic'),
});

export type RiskAnalysis = z.infer<typeof riskAnalysisSchema>;

/**
 * Routing Decision Schema
 *
 * Captures the BD Manager's manual BL selection decision
 * including reasoning and whether they overrode the AI recommendation.
 */
export const routingDecisionSchema = z.object({
  selectedBusinessLineId: sanitizedString.describe('ID of the selected business line'),
  selectedBusinessLineName: sanitizedString
    .optional()
    .describe('Name of the selected business line'),
  reason: sanitizedString.optional().describe('Optional reasoning for BL selection'),
  overrideRecommendation: z.boolean().describe('Whether BD Manager overrode AI recommendation'),
  decidedAt: z.string().datetime().describe('When the decision was made'),
  decidedByUserId: sanitizedString.describe('User ID of the BD Manager who decided'),
  decidedByUserName: sanitizedString.optional().describe('Name of the BD Manager'),
});

export type RoutingDecision = z.infer<typeof routingDecisionSchema>;
