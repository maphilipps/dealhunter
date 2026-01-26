import { z } from 'zod';

export interface ExpertAgentInput {
  preQualificationId: string;
  leadId?: string;
}

export interface ExpertAgentOutput<T> {
  success: boolean;
  data: T | null;
  confidence: number;
  error?: string;
  analyzedAt: string;
}

export const BaseAgentResultSchema = z.object({
  confidence: z.number().min(0).max(100),
  sources: z
    .array(
      z.object({
        chunkIndex: z.number(),
        relevance: z.number(),
        excerpt: z.string().max(200),
      })
    )
    .optional(),
});

export type BaseAgentResult = z.infer<typeof BaseAgentResultSchema>;
