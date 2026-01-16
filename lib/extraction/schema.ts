import { z } from 'zod';

/**
 * Schema for AI-extracted requirements from bid documents
 * Used by the extraction agent to structure data from PDFs/emails/text
 */
export const extractedRequirementsSchema = z.object({
  // Customer Information
  customerName: z.string().describe('Name of the customer company or organization'),
  industry: z.string().optional().describe('Industry sector of the customer'),
  websiteUrl: z.string().optional().describe('Customer website URL for quick scan'),

  // Project Details
  projectDescription: z.string().describe('Detailed description of the project requirements'),
  projectName: z.string().optional().describe('Name or title of the project if mentioned'),

  // Technical Requirements
  technologies: z.array(z.string()).describe('List of technologies, frameworks, or platforms mentioned'),
  scope: z.string().optional().describe('Project scope (e.g., development, migration, consulting)'),

  // Business Requirements
  budgetRange: z.string().optional().describe('Budget range or estimated cost if mentioned'),
  timeline: z.string().optional().describe('Project timeline or deadline if mentioned'),
  teamSize: z.number().optional().describe('Required team size if mentioned'),

  // Additional Context
  keyRequirements: z.array(z.string()).describe('List of key functional or non-functional requirements'),
  constraints: z.array(z.string()).optional().describe('Any constraints or limitations mentioned'),

  // Metadata
  confidenceScore: z.number().min(0).max(1).describe('AI confidence in the extraction (0-1)'),
  extractedAt: z.string().describe('ISO timestamp of extraction'),
});

export type ExtractedRequirements = z.infer<typeof extractedRequirementsSchema>;

/**
 * Schema for the extraction result including activity log
 */
export const extractionResultSchema = z.object({
  requirements: extractedRequirementsSchema,
  activityLog: z.array(z.object({
    timestamp: z.string(),
    action: z.string(),
    details: z.string().optional(),
  })),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
