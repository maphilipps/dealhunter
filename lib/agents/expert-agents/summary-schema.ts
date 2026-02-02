import { z } from 'zod';

export const ManagementSummarySchema = z.object({
  // One-liner
  headline: z.string().max(200),

  // Executive summary (2-3 sentences)
  executiveSummary: z.string().max(2000),

  // Key facts
  keyFacts: z.object({
    customer: z.string(),
    industry: z.string().optional(),
    projectType: z.string(),
    estimatedValue: z.string().optional(),
    submissionDeadline: z.string().optional(),
    daysRemaining: z.number().optional(),
  }),

  // Top 3-5 deliverables
  topDeliverables: z
    .array(
      z.object({
        name: z.string(),
        mandatory: z.boolean(),
      })
    )
    .max(5),

  // Timeline highlights
  timelineHighlights: z
    .array(
      z.object({
        milestone: z.string(),
        date: z.string(),
      })
    )
    .max(5),

  // Quick assessment
  assessment: z.object({
    fitScore: z.coerce.number().min(1).max(10), // How well does this fit adesso?
    complexityScore: z.coerce.number().min(1).max(10),
    urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']),
    recommendation: z.enum(['pursue', 'consider', 'decline']),
    reasoning: z.string(),
  }),

  // Key risks (max 3)
  topRisks: z.array(z.string()).max(3),

  // Key opportunities (max 3)
  topOpportunities: z.array(z.string()).max(3),

  confidence: z.coerce.number().min(0).max(100),
});

export type ManagementSummary = z.infer<typeof ManagementSummarySchema>;
