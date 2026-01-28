import { z } from 'zod';

export const LegalRequirementSchema = z.object({
  requirement: z.string(),
  category: z.enum([
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
  ]),
  mandatory: z.boolean(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  implication: z.string(),
  confidence: z.coerce.number().min(0).max(100),
  rawText: z.string(),
});

export const LegalRfpAnalysisSchema = z.object({
  requirements: z.array(LegalRequirementSchema),

  contractDetails: z.object({
    contractType: z.string().nullable(),
    duration: z.string().nullable(),
    terminationNotice: z.string().nullable(),
    liabilityLimit: z.string().nullable(),
    penaltyClauses: z.array(z.string()),
  }),

  requiredCertifications: z.array(z.string()),
  requiredInsurance: z.array(
    z.object({
      type: z.string(),
      minAmount: z.string().nullable(),
    })
  ),

  overallRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  riskFactors: z.array(z.string()),
  dealBreakers: z.array(z.string()),

  recommendations: z.array(z.string()),
  questionsForLegal: z.array(z.string()),

  confidence: z.coerce.number().min(0).max(100),
});

export type LegalRfpAnalysis = z.infer<typeof LegalRfpAnalysisSchema>;
export type LegalRequirement = z.infer<typeof LegalRequirementSchema>;
