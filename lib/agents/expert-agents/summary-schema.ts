import { z } from 'zod';

export const ManagementSummarySchema = z.object({
  // One-liner
  headline: z.string().max(200).default('Pre-Qualification Analysis'),

  // Executive summary (2-3 sentences)
  executiveSummary: z.string().max(2000).default(''),

  // Key facts (using .any() to avoid response_format validation errors with Zod v4)
  keyFacts: z
    .any()
    .refine(
      (data): data is Record<string, unknown> =>
        typeof data === 'object' &&
        data !== null &&
        (typeof data.customer === 'string' || data.customer === undefined || data.customer === null)
    )
    .transform(data => ({
      customer: typeof data.customer === 'string' ? data.customer : 'Unknown',
      industry: typeof data.industry === 'string' || data.industry === null ? data.industry : null,
      projectType: typeof data.projectType === 'string' ? data.projectType : 'Unknown',
      estimatedValue:
        typeof data.estimatedValue === 'string' || data.estimatedValue === null
          ? data.estimatedValue
          : null,
      submissionDeadline:
        typeof data.submissionDeadline === 'string' || data.submissionDeadline === null
          ? data.submissionDeadline
          : null,
      daysRemaining:
        typeof data.daysRemaining === 'number' || data.daysRemaining === undefined
          ? data.daysRemaining
          : undefined,
    }))
    .default({
      customer: 'Unknown',
      industry: null,
      projectType: 'Unknown',
      estimatedValue: null,
      submissionDeadline: null,
      daysRemaining: undefined,
    }),

  // Top 3-5 deliverables
  topDeliverables: z
    .array(
      z.object({
        name: z.string().default('Unknown Deliverable'),
        mandatory: z.boolean().default(true),
      })
    )
    .max(5)
    .default([]),

  // Timeline highlights
  timelineHighlights: z
    .array(
      z.object({
        milestone: z.string().default('Unknown Milestone'),
        date: z.string().default('TBD'),
      })
    )
    .max(5)
    .default([]),

  // Quick assessment
  assessment: z
    .object({
      fitScore: z.coerce.number().min(1).max(10).default(5), // How well does this fit adesso?
      complexityScore: z.coerce.number().min(1).max(10).default(5),
      urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
      recommendation: z.enum(['pursue', 'consider', 'decline']).default('consider'),
      reasoning: z.string().default(''),
    })
    .default({
      fitScore: 5,
      complexityScore: 5,
      urgencyLevel: 'medium',
      recommendation: 'consider',
      reasoning: '',
    }),

  // Key risks (max 3)
  topRisks: z.array(z.string()).max(3).default([]),

  // Key opportunities (max 3)
  topOpportunities: z.array(z.string()).max(3).default([]),

  confidence: z.coerce.number().min(0).max(100).default(50),
});

export type ManagementSummary = z.infer<typeof ManagementSummarySchema>;
