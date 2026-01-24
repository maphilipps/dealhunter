import { z } from 'zod';

export const ManagementSummarySchema = z.object({
  // One-liner
  headline: z.string().max(200).default('RFP Analysis'),

  // Executive summary (2-3 sentences)
  executiveSummary: z.string().max(2000).default(''),

  // Key facts
  keyFacts: z
    .object({
      customer: z.string().default('Unknown'),
      industry: z.string().nullish(),
      projectType: z.string().default('Unknown'),
      estimatedValue: z.string().nullish(),
      submissionDeadline: z.string().nullish(),
      daysRemaining: z.coerce.number().nullish(),
    })
    .default({ customer: 'Unknown', projectType: 'Unknown' }),

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
      urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
      recommendation: z.enum(['pursue', 'consider', 'decline']).catch('consider'),
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
