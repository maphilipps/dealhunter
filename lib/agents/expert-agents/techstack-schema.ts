import { z } from 'zod';

export const TechnologyRequirementSchema = z.object({
  name: z.string(),
  category: z.enum([
    'cms',
    'framework',
    'language',
    'database',
    'cloud',
    'integration',
    'security',
    'analytics',
    'other',
  ]),
  requirementType: z.enum(['required', 'preferred', 'excluded', 'mentioned']),
  context: z.string(),
  confidence: z.coerce.number().min(0).max(100),
});

export const TechStackAnalysisSchema = z.object({
  requirements: z.array(TechnologyRequirementSchema),

  cmsRequirements: z.object({
    explicit: z.array(z.string()),
    preferred: z.array(z.string()),
    excluded: z.array(z.string()),
    flexibility: z.enum(['rigid', 'preferred', 'flexible', 'open']),
    headlessRequired: z.boolean().nullable(),
    multilingualRequired: z.boolean().nullable(),
  }),

  integrations: z.object({
    sso: z.array(z.string()),
    erp: z.array(z.string()),
    crm: z.array(z.string()),
    payment: z.array(z.string()),
    other: z.array(z.string()),
  }),

  infrastructure: z.object({
    cloudProviders: z.array(z.string()),
    hostingRequirements: z.string().nullable(),
    securityCertifications: z.array(z.string()),
    complianceRequirements: z.array(z.string()),
  }),

  complexityScore: z.coerce.number().min(1).max(10),
  complexityFactors: z.array(z.string()),

  confidence: z.coerce.number().min(0).max(100),
});

export type TechStackAnalysis = z.infer<typeof TechStackAnalysisSchema>;
export type TechnologyRequirement = z.infer<typeof TechnologyRequirementSchema>;
