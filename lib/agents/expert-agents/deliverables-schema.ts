/**
 * Deliverables Expert Agent Schema
 *
 * Defines the structure for Pre-Qualification deliverables/submission requirements analysis.
 */

import { z } from 'zod';

export const DeliverableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  category: z
    .enum([
      'proposal_document', // Executive Summary, Technical Proposal
      'commercial', // Pricing, Cost Breakdown
      'legal', // Contracts, NDAs, Certificates
      'technical', // Architecture Docs, Diagrams
      'reference', // Case Studies, References
      'administrative', // Company Profile, Team CVs
      'presentation', // Demo, Pitch Deck
    ])
    .default('proposal_document'),
  format: z.string().optional(), // PDF, Word, etc.
  pageLimit: z.number().optional(),
  mandatory: z.boolean().default(true),
  deadline: z.string().optional(), // If different from main deadline
  submissionMethod: z.enum(['email', 'portal', 'physical', 'unknown']).optional(),
  copies: z.number().optional(),
  confidence: z.number().min(0).max(100).default(50),
  rawText: z.string().default(''),
});

export const DeliverablesAnalysisSchema = z.object({
  deliverables: z.array(DeliverableSchema),

  // Summary stats
  totalCount: z.number().default(0),
  mandatoryCount: z.number().default(0),
  optionalCount: z.number().default(0),

  // Submission info
  primarySubmissionMethod: z.enum(['email', 'portal', 'physical', 'unknown']).default('unknown'),
  submissionEmail: z.string().optional(),
  portalUrl: z.string().optional(),

  // Effort estimation
  estimatedEffortHours: z.number().optional(),

  confidence: z.number().min(0).max(100).default(50),
});

export type Deliverable = z.infer<typeof DeliverableSchema>;
export type DeliverablesAnalysis = z.infer<typeof DeliverablesAnalysisSchema>;
