import { z } from 'zod';

export const MilestoneSchema = z.object({
  name: z.string(),
  date: z.string().nullable(),
  dateType: z.enum(['exact', 'estimated', 'relative']),
  description: z.string().nullable(),
  mandatory: z.boolean(),
  confidence: z.number().min(0).max(100),
});

export const TimingAnalysisSchema = z.object({
  submissionDeadline: z
    .object({
      date: z.string(),
      time: z.string().nullable(),
      timezone: z.string().nullable(),
      confidence: z.number(),
      rawText: z.string(),
    })
    .nullable(),

  projectStart: z.string().nullable(),
  projectEnd: z.string().nullable(),
  projectDurationMonths: z.number().nullable(),

  milestones: z.array(MilestoneSchema),

  clarificationDeadline: z.string().nullable(),
  qaSessionDates: z.array(z.string()),

  awardDate: z.string().nullable(),
  contractSigningDate: z.string().nullable(),

  urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']),
  daysUntilSubmission: z.number().nullable(),

  confidence: z.number().min(0).max(100),
});

export type TimingAnalysis = z.infer<typeof TimingAnalysisSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
