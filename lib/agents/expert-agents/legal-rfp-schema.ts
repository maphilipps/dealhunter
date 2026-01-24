import { z } from 'zod';

export const LegalRequirementSchema = z.object({
  requirement: z.string(),
  category: z
    .enum([
      'contract_terms',
      'compliance',
      'insurance',
      'certification',
      'nda_ip',
      'subcontracting',
      'payment_terms',
      'warranty',
      'data_protection',
      'other',
    ])
    .default('other'),
  mandatory: z.boolean().default(false),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  implication: z.string().default(''),
  confidence: z.coerce.number().min(0).max(100).default(50),
  rawText: z.string().default(''),
});

export const LegalRfpAnalysisSchema = z.object({
  requirements: z.array(LegalRequirementSchema).default([]),

  contractDetails: z
    .object({
      contractType: z.string().optional(),
      duration: z.string().optional(),
      terminationNotice: z.string().optional(),
      liabilityLimit: z.string().optional(),
      penaltyClauses: z.array(z.string()).optional(),
    })
    .default({}),

  requiredCertifications: z.array(z.string()).default([]),
  requiredInsurance: z
    .array(
      z.object({
        type: z.string(),
        minAmount: z.string().optional(),
      })
    )
    .default([]),

  overallRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  riskFactors: z.array(z.string()).default([]),
  dealBreakers: z.array(z.string()).default([]),

  recommendations: z.array(z.string()).default([]),
  questionsForLegal: z.array(z.string()).default([]),

  confidence: z.coerce.number().min(0).max(100).default(50),
});

export type LegalRfpAnalysis = z.infer<typeof LegalRfpAnalysisSchema>;
export type LegalRequirement = z.infer<typeof LegalRequirementSchema>;
