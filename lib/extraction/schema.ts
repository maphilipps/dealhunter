import { z } from 'zod';

/**
 * Schema for AI-extracted requirements from bid documents
 * Used by the extraction agent to structure data from PDFs/emails/text
 */
export const extractedRequirementsSchema = z.object({
  // Customer Information
  // CHANGED: Made optional - better empty than "Unbekannt"
  customerName: z.string().optional().describe('Name of the customer company or organization'),
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
        type: z
          .enum(['primary', 'product', 'regional', 'related', 'corporate', 'main', 'other'])
          .describe('Type of website'),
        description: z.string().nullish().describe('Brief description of this website'),
        extractedFromDocument: z.boolean().describe('Whether this URL was found in the document'),
      })
    )
    .optional()
    .describe('Customer website URLs for quick scan analysis'),

  // Keep single websiteUrl for backwards compatibility (deprecated)
  websiteUrl: z.string().optional().describe('Customer website URL (deprecated, use websiteUrls)'),

  // Project Details
  // CHANGED: Made optional - better empty than placeholder text
  projectDescription: z
    .string()
    .optional()
    .describe('Detailed description of the project requirements'),
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
  submissionPortal: z
    .object({
      name: z.string().optional().describe('Name of the procurement or submission portal'),
      url: z.string().optional().describe('Portal URL if mentioned'),
      notes: z.string().optional().describe('Additional portal notes from the document'),
    })
    .optional()
    .describe('Submission portal details if the process is handled via a portal'),
  procedureType: z
    .string()
    .optional()
    .describe('Type of procurement procedure (e.g., open, restricted, negotiated)'),
  shortlistingProcess: z
    .object({
      exists: z.boolean().optional().describe('Whether a shortlisting process is described'),
      participationRequired: z
        .boolean()
        .optional()
        .describe('Whether a participation application is required'),
      steps: z.array(z.string()).optional().describe('Described process steps'),
      shortlistingDate: z
        .string()
        .optional()
        .describe('Shortlisting or presentation date if mentioned'),
      notes: z.string().optional().describe('Additional notes about the procedure'),
    })
    .optional()
    .describe('Shortlisting or multi-stage procedure details'),
  contractType: z
    .string()
    .optional()
    .describe('Contract type or framework (e.g., EVB-IT, framework agreement)'),
  contractModel: z
    .string()
    .optional()
    .describe('Contract model (e.g., Werkvertrag, Dienstvertrag, SLA/Servicevertrag)'),
  contractDuration: z
    .string()
    .optional()
    .describe('Contract or project duration if specified'),

  // Required Deliverables
  requiredDeliverables: z
    .array(
      z.object({
        name: z.string().describe('Name of the deliverable'),
        description: z.string().nullish().describe('Description of what is required'),
        deadline: z.string().nullish().describe('Deadline in ISO format YYYY-MM-DD'),
        deadlineTime: z.string().nullish().describe('Exact time for deadline in HH:MM format'),
        format: z.string().nullish().describe('Required format (e.g., PDF, Word, hardcopy)'),
        copies: z.number().nullish().describe('Number of copies required'),
        mandatory: z.boolean().default(true).describe('Whether this deliverable is mandatory'),
        confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
      })
    )
    .optional()
    .describe('List of documents/deliverables to be submitted'),

  // Offer structure and evaluation
  proposalStructure: z
    .object({
      participationPhase: z
        .array(z.string())
        .optional()
        .describe('Deliverables required for participation/application phase'),
      offerPhase: z
        .array(z.string())
        .optional()
        .describe('Deliverables required for offer/proposal phase'),
    })
    .optional()
    .describe('Structured deliverables by phase if the process is multi-stage'),
  awardCriteria: z
    .object({
      criteria: z.array(z.string()).optional().describe('Award criteria list'),
      weights: z.array(z.string()).optional().describe('Weights or scoring details'),
      requiresConcepts: z
        .boolean()
        .optional()
        .describe('Whether specific concepts are required as part of evaluation'),
      participationCriteria: z
        .array(z.string())
        .optional()
        .describe('Criteria for participation application phase'),
      offerCriteria: z
        .array(z.string())
        .optional()
        .describe('Criteria for offer/proposal phase'),
    })
    .optional()
    .describe('Award and evaluation criteria details'),

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
        email: z.string().nullish().describe('Email address'),
        phone: z.string().nullish().describe('Phone number'),
        category: z
          .enum(['decision_maker', 'influencer', 'coordinator', 'unknown'])
          .describe('Contact category based on decision-making power'),
        confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
      })
    )
    .optional()
    .describe('List of contacts with categorization'),

  // Services and references
  requiredServices: z
    .array(z.string())
    .optional()
    .describe('Required services or scopes explicitly listed'),
  referenceRequirements: z
    .object({
      count: z.number().optional().describe('Number of required references'),
      requiredIndustries: z
        .array(z.string())
        .optional()
        .describe('Mandatory industries for references'),
      requiredTechnologies: z
        .array(z.string())
        .optional()
        .describe('Mandatory technologies for references'),
      description: z.string().optional().describe('Free-text reference requirements'),
    })
    .optional()
    .describe('Reference requirements (count, industry, technology, description)'),

  // Additional Context
  keyRequirements: z
    .array(z.string())
    .default([])
    .describe('List of key functional or non-functional requirements'),
  constraints: z.array(z.string()).optional().describe('Any constraints or limitations mentioned'),

  // Project Goal - Strategic context for all downstream analysis
  projectGoal: z
    .object({
      objective: z
        .string()
        .describe('What does the customer want to achieve? The primary goal of the project.'),
      successCriteria: z
        .array(z.string())
        .optional()
        .describe('How will success be measured? KPIs or acceptance criteria.'),
      businessDrivers: z
        .array(z.string())
        .optional()
        .describe('Why now? What is driving this project? (e.g., legacy replacement, growth, compliance)'),
      strategicContext: z
        .string()
        .optional()
        .describe('Broader strategic context or background'),
      mustNotFail: z
        .array(z.string())
        .optional()
        .describe('Critical constraints - what must NOT happen or fail'),
      confidence: z
        .number()
        .min(0)
        .max(100)
        .describe('Confidence score 0-100 for the extracted goal'),
    })
    .optional()
    .describe('Structured project goal - the "North Star" for all analysis'),

  // Metadata
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe('AI confidence in the extraction (0-1)'),
  extractedAt: z.string().optional().describe('ISO timestamp of extraction (set by system)'),
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
