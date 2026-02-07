/**
 * Deliverables Expert Agent Schema
 *
 * Defines the structure for Qualification deliverables/submission requirements analysis.
 */

import { z } from 'zod';

export const DeliverableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    'proposal_document', // Executive Summary, Technical Proposal
    'commercial', // Pricing, Cost Breakdown
    'legal', // Contracts, NDAs, Certificates
    'technical', // Architecture Docs, Diagrams
    'reference', // Case Studies, References
    'administrative', // Company Profile, Team CVs
    'presentation', // Demo, Pitch Deck
  ]),
  format: z.string().nullable(), // PDF, Word, etc.
  pageLimit: z.number().nullable(),
  mandatory: z.boolean(),
  deadline: z.string().nullable(), // If different from main deadline
  submissionMethod: z.enum(['email', 'portal', 'physical', 'unknown']),
  copies: z.number().nullable(),
  confidence: z.number().min(0).max(100),
  rawText: z.string(),
});

export const DeliverablesAnalysisSchema = z.object({
  deliverables: z.array(DeliverableSchema),

  // Summary stats
  totalCount: z.number(),
  mandatoryCount: z.number(),
  optionalCount: z.number(),

  // Submission info
  primarySubmissionMethod: z.enum(['email', 'portal', 'physical', 'unknown']),
  submissionEmail: z.string().nullable(),
  portalUrl: z.string().nullable(),

  // Effort estimation
  estimatedEffortHours: z.number().nullable(),

  confidence: z.number().min(0).max(100),
});

export type Deliverable = z.infer<typeof DeliverableSchema>;
export type DeliverablesAnalysis = z.infer<typeof DeliverablesAnalysisSchema>;
