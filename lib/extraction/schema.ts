import { z } from 'zod';

/**
 * Schema for AI-extracted requirements from bid documents
 * Used by the extraction agent to structure data from PDFs/emails/text
 */
export const extractedRequirementsSchema = z.object({
  // Customer Information
  customerName: z.string().describe('Name of the customer company or organization'),
  industry: z.string().optional().describe('Industry sector of the customer'),

  // Company Details (for Quick Scan and Company Intelligence)
  companySize: z
    .enum(['startup', 'small', 'medium', 'large', 'enterprise'])
    .optional()
    .describe('Company size classification'),
  employeeCountRange: z.string().optional().describe('Number of employees range (e.g., "100-500")'),
  revenueRange: z.string().optional().describe('Revenue range (e.g., "10-50 Mio EUR")'),
  procurementType: z
    .enum(['public', 'private', 'semi-public'])
    .optional()
    .describe('Type of procurement/bidding process'),
  industryVertical: z.string().optional().describe('Specific industry vertical or sub-sector'),
  companyLocation: z.string().optional().describe('Company headquarters or main location'),

  // Website URLs for Quick Scan (multiple possible)
  websiteUrls: z
    .array(
      z.object({
        url: z.string().describe('Website URL'),
        type: z.enum(['primary', 'product', 'regional', 'related']).describe('Type of website'),
        description: z.string().optional().describe('Brief description of this website'),
        extractedFromDocument: z.boolean().describe('Whether this URL was found in the document'),
      })
    )
    .optional()
    .describe('Customer website URLs for quick scan analysis'),

  // Keep single websiteUrl for backwards compatibility (deprecated)
  websiteUrl: z.string().optional().describe('Customer website URL (deprecated, use websiteUrls)'),

  // Project Details
  projectDescription: z.string().describe('Detailed description of the project requirements'),
  projectName: z.string().optional().describe('Name or title of the project if mentioned'),

  // Technical Requirements
  technologies: z
    .array(z.string())
    .describe('List of technologies, frameworks, or platforms mentioned'),
  scope: z.string().optional().describe('Project scope (e.g., development, migration, consulting)'),

  // CMS Constraints
  cmsConstraints: z
    .object({
      required: z.array(z.string()).optional().describe('Required CMS systems (e.g., ["Drupal"])'),
      preferred: z
        .array(z.string())
        .optional()
        .describe('Preferred CMS systems (e.g., ["WordPress"])'),
      excluded: z.array(z.string()).optional().describe('Excluded CMS systems (e.g., ["Joomla"])'),
      flexibility: z
        .enum(['rigid', 'preferred', 'flexible', 'unknown'])
        .describe('How flexible the CMS requirement is'),
      confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
      rawText: z.string().describe('Original text mentioning CMS constraints'),
    })
    .optional()
    .describe('CMS system constraints and preferences'),

  // Business Requirements
  budgetRange: z
    .object({
      min: z.number().optional().describe('Minimum budget in base currency units'),
      max: z.number().optional().describe('Maximum budget in base currency units'),
      currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']).default('EUR').describe('Currency code'),
      confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
      rawText: z.string().describe('Original text from document'),
    })
    .optional()
    .describe('Structured budget range with currency and confidence'),
  timeline: z.string().optional().describe('Project timeline or deadline if mentioned'),
  teamSize: z.number().optional().describe('Required team size if mentioned'),

  // Submission Details
  submissionDeadline: z
    .string()
    .optional()
    .describe('Deadline for bid submission (ISO date format YYYY-MM-DD)'),
  submissionTime: z.string().optional().describe('Exact time for submission if specified (HH:MM)'),
  projectStartDate: z
    .string()
    .optional()
    .describe('Expected project start date (ISO date format YYYY-MM-DD)'),
  projectEndDate: z
    .string()
    .optional()
    .describe('Expected project end date (ISO date format YYYY-MM-DD)'),

  // Required Deliverables
  requiredDeliverables: z
    .array(
      z.object({
        name: z.string().describe('Name of the deliverable'),
        description: z.string().optional().describe('Description of what is required'),
        deadline: z.string().optional().describe('Deadline in ISO format YYYY-MM-DD'),
        deadlineTime: z.string().optional().describe('Exact time for deadline in HH:MM format'),
        format: z.string().optional().describe('Required format (e.g., PDF, Word, hardcopy)'),
        copies: z.number().optional().describe('Number of copies required'),
        mandatory: z.boolean().default(true).describe('Whether this deliverable is mandatory'),
        confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
      })
    )
    .optional()
    .describe('List of documents/deliverables to be submitted'),

  // Contact Information
  contactPerson: z.string().optional().describe('Name of contact person at customer'),
  contactEmail: z.string().optional().describe('Email of contact person'),
  contactPhone: z.string().optional().describe('Phone number of contact person'),

  // Structured Contacts with Categorization
  contacts: z
    .array(
      z.object({
        name: z.string().describe('Contact person name'),
        role: z.string().describe('Job title or role'),
        email: z.string().optional().describe('Email address'),
        phone: z.string().optional().describe('Phone number'),
        category: z
          .enum(['decision_maker', 'influencer', 'coordinator', 'unknown'])
          .describe('Contact category based on decision-making power'),
        confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
      })
    )
    .optional()
    .describe('List of contacts with categorization'),

  // Additional Context
  keyRequirements: z
    .array(z.string())
    .describe('List of key functional or non-functional requirements'),
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
  activityLog: z.array(
    z.object({
      timestamp: z.string(),
      action: z.string(),
      details: z.string().optional(),
    })
  ),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
