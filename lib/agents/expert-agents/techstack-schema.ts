import { z } from 'zod';

export const TechnologyRequirementSchema = z.object({
  name: z.string(),
  category: z
    .enum([
      'cms',
      'framework',
      'language',
      'database',
      'cloud',
      'integration',
      'security',
      'analytics',
      'other',
    ])
    .default('other'),
  requirementType: z.enum(['required', 'preferred', 'excluded', 'mentioned']).default('mentioned'),
  context: z.string().default(''),
  confidence: z.coerce.number().min(0).max(100).default(50),
});

export const TechStackAnalysisSchema = z.object({
  requirements: z.array(TechnologyRequirementSchema).default([]),

  cmsRequirements: z
    .object({
      explicit: z.array(z.string()).optional(),
      preferred: z.array(z.string()).optional(),
      excluded: z.array(z.string()).optional(),
      flexibility: z.enum(['rigid', 'preferred', 'flexible', 'open']).default('flexible'),
      headlessRequired: z.boolean().optional(),
      multilingualRequired: z.boolean().optional(),
    })
    .default({ flexibility: 'flexible' }),

  integrations: z
    .object({
      sso: z.array(z.string()).optional(),
      erp: z.array(z.string()).optional(),
      crm: z.array(z.string()).optional(),
      payment: z.array(z.string()).optional(),
      other: z.array(z.string()).optional(),
    })
    .default({}),

  infrastructure: z
    .object({
      cloudProviders: z.array(z.string()).optional(),
      hostingRequirements: z.string().optional(),
      securityCertifications: z.array(z.string()).optional(),
      complianceRequirements: z.array(z.string()).optional(),
    })
    .default({}),

  complexityScore: z.coerce.number().min(1).max(10).default(5),
  complexityFactors: z.array(z.string()).default([]),

  confidence: z.coerce.number().min(0).max(100).default(50),
});

export type TechStackAnalysis = z.infer<typeof TechStackAnalysisSchema>;
export type TechnologyRequirement = z.infer<typeof TechnologyRequirementSchema>;
