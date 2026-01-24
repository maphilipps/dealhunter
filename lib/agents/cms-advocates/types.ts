/**
 * CMS Advocate Types
 *
 * Type definitions for the CMS Advocate system.
 * Each CMS gets a specialized advocate agent that "pitches" its platform.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProjectRequirement {
  requirement: string;
  category:
    | 'functional'
    | 'technical'
    | 'integration'
    | 'compliance'
    | 'performance'
    | 'scalability'
    | 'security'
    | 'ux'
    | 'maintenance'
    | 'other';
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  source: 'extracted' | 'detected' | 'inferred' | 'researched';
}

export interface CustomerProfile {
  industry: string;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  techMaturity: 'low' | 'medium' | 'high';
  budget: 'low' | 'medium' | 'high';
  country?: string; // DE, CH, AT for legal requirements
}

export interface CMSAdvocateInput {
  leadId: string;
  requirements: ProjectRequirement[];
  customerProfile: CustomerProfile;
  competingCMS: string[]; // Names of other CMS in the comparison
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT SCHEMAS (Zod for structured AI output)
// ═══════════════════════════════════════════════════════════════════════════════

export const CMSArgumentSchema = z.object({
  category: z.enum(['feature', 'cost', 'expertise', 'community', 'scalability', 'security', 'ux']),
  argument: z.string().describe('Das Argument warum dieses CMS gut ist'),
  strength: z.enum(['strong', 'medium', 'weak']),
  evidence: z.string().describe('Verweis auf technologies Daten oder bekannte Fakten'),
});

export const CounterArgumentSchema = z.object({
  againstCMS: z.string().describe('Name des CMS gegen das argumentiert wird'),
  argument: z.string().describe('Das Counter-Argument'),
  category: z.string().describe('Kategorie des Arguments'),
});

export const FeatureMappingSchema = z.object({
  requirement: z.string(),
  cmsFeature: z.string().describe('Wie das CMS diese Anforderung erfüllt'),
  supported: z.boolean(),
  score: z.number().min(0).max(100),
  notes: z.string().optional(),
  moduleName: z.string().optional().describe('Name des Moduls/Plugins falls nötig'),
});

export const EstimationSchema = z.object({
  baselineHours: z.number().describe('Basis-Stunden aus der Baseline'),
  adjustmentFactor: z.number().min(0.5).max(2.0).describe('Anpassungsfaktor 0.5-2.0'),
  totalHours: z.number().describe('Geschätzte Gesamtstunden'),
  reasoning: z.string().describe('Begründung für die Anpassung'),
});

export const RiskSchema = z.object({
  risk: z.string().describe('Beschreibung des Risikos'),
  likelihood: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  mitigation: z.string().describe('Wie das Risiko gemindert werden kann'),
});

export const CMSAdvocateOutputSchema = z.object({
  cmsName: z.string(),
  fitScore: z.number().min(0).max(100).describe('Wie gut passt das CMS 0-100'),

  // Verkaufsargumente
  arguments: z.array(CMSArgumentSchema).min(3).max(8),

  // Gegen andere CMS
  counterArguments: z.array(CounterArgumentSchema).max(6),

  // Feature-Mapping
  featureMapping: z.array(FeatureMappingSchema),

  // Aufwand
  estimation: EstimationSchema,

  // Risiken
  risks: z.array(RiskSchema).max(5),

  // adesso-Vorteil
  adessoAdvantages: z.array(z.string()).min(1).max(4),

  // Pitch Summary
  pitchSummary: z
    .string()
    .describe('2-3 Sätze warum dieses CMS die beste Wahl ist - der Elevator Pitch'),
});

export type CMSArgument = z.infer<typeof CMSArgumentSchema>;
export type CounterArgument = z.infer<typeof CounterArgumentSchema>;
export type FeatureMapping = z.infer<typeof FeatureMappingSchema>;
export type Estimation = z.infer<typeof EstimationSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type CMSAdvocateOutput = z.infer<typeof CMSAdvocateOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

export const CMSComparisonCriterionSchema = z.object({
  criterion: z.string(),
  weight: z.number().min(0).max(1).describe('Gewichtung 0-1'),
  scores: z.record(z.string(), z.number().min(0).max(100)),
  winner: z.string(),
  notes: z.string().optional(),
});

export const CMSProsConsSchema = z.object({
  cmsName: z.string(),
  pros: z.array(z.string()).min(2).max(5),
  cons: z.array(z.string()).min(1).max(4),
  bestFor: z.string().describe('Für welche Projekte ist dieses CMS ideal'),
  notFor: z.string().describe('Für welche Projekte ist es nicht geeignet'),
});

export const CMSScenarioSchema = z.object({
  scenario: z.string().describe('Beschreibung des Szenarios'),
  recommendedCMS: z.string(),
  reasoning: z.string(),
});

export const CMSComparisonOutputSchema = z.object({
  // Übersicht
  summary: z.object({
    recommendedCMS: z.string(),
    recommendationStrength: z.enum(['strong', 'moderate', 'weak']),
    alternativeCMS: z.string().optional(),
    reasoning: z.string(),
  }),

  // Vergleichsmatrix
  comparisonMatrix: z.array(CMSComparisonCriterionSchema),

  // Pro/Contra per CMS
  prosConsPerCMS: z.array(CMSProsConsSchema),

  // Szenarien
  scenarios: z.array(CMSScenarioSchema).max(3),

  // Finale Empfehlung
  finalRecommendation: z.object({
    primaryChoice: z.string(),
    fallbackChoice: z.string().optional(),
    decisionFactors: z.array(z.string()).min(2).max(5),
    nextSteps: z.array(z.string()).min(1).max(3),
  }),
});

export type CMSComparisonCriterion = z.infer<typeof CMSComparisonCriterionSchema>;
export type CMSProsCons = z.infer<typeof CMSProsConsSchema>;
export type CMSScenario = z.infer<typeof CMSScenarioSchema>;
export type CMSComparisonOutput = z.infer<typeof CMSComparisonOutputSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// CMS KNOWLEDGE (from technologies table)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CMSKnowledge {
  id: string;
  name: string;
  description?: string;
  category?: string;
  license?: string;

  // Community & Support
  latestVersion?: string;
  githubStars?: number;
  communitySize?: 'small' | 'medium' | 'large';

  // Verkaufsargumente
  pros?: string[];
  cons?: string[];
  usps?: string[];
  targetAudiences?: string[];
  useCases?: string[];

  // Features
  features?: Record<
    string,
    {
      supported: boolean;
      score: number;
      notes?: string;
    }
  >;

  // adesso-spezifisch
  adessoExpertise?: string;
  adessoReferenceCount?: number;
  baselineHours?: number;
  baselineEntityCounts?: Record<string, number>;
}
