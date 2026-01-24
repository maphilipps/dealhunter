import { z } from 'zod';

export const MilestoneSchema = z.object({
  name: z.string(),
  date: z.string().optional(),
  dateType: z.enum(['exact', 'estimated', 'relative']).default('estimated'),
  description: z.string().optional(),
  mandatory: z.boolean().default(true),
  confidence: z.number().min(0).max(100).default(50),
});

export const TimingAnalysisSchema = z.object({
  submissionDeadline: z
    .object({
      date: z.string(),
      time: z.string().optional(),
      timezone: z.string().optional(),
      confidence: z.number().default(50),
      rawText: z.string().default(''),
    })
    .optional(),

  projectStart: z.string().optional(),
  projectEnd: z.string().optional(),
  projectDurationMonths: z.number().optional(),

  milestones: z.array(MilestoneSchema).default([]),

  clarificationDeadline: z.string().optional(),
  qaSessionDates: z.array(z.string()).optional(),

  awardDate: z.string().optional(),
  contractSigningDate: z.string().optional(),

  urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  daysUntilSubmission: z.number().optional(),

  confidence: z.number().min(0).max(100).default(50),
});

export type TimingAnalysis = z.infer<typeof TimingAnalysisSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
