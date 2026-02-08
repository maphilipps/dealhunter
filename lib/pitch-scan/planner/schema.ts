import { z } from 'zod';

// ─── Website Type Schema ───────────────────────────────────────────────────────

export const websiteTypeSchema = z.enum([
  'e-commerce',
  'portal',
  'corporate',
  'informational',
  'blog',
  'multi-site',
]);

export type WebsiteType = z.infer<typeof websiteTypeSchema>;

// ─── Phase Category Schema ─────────────────────────────────────────────────────

export const phaseCategorySchema = z.enum([
  'discovery',
  'technical',
  'legal',
  'cms',
  'architecture',
  'synthesis',
]);

export type PhaseCategory = z.infer<typeof phaseCategorySchema>;

// ─── Planning Context Schema ───────────────────────────────────────────────────

/**
 * Input context for the planner LLM.
 * Contains all information needed to create an analysis plan.
 */
export const planningContextSchema = z.object({
  // ─── From Pre-Qualification ─────────────────────────────────────────────────
  customerName: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  procurementType: z.enum(['public', 'private', 'semi-public']).optional(),

  // ─── Website Info ───────────────────────────────────────────────────────────
  websiteUrl: z.string().url().optional(),
  websiteType: websiteTypeSchema.optional(),

  // ─── From Discovery (if already run) ────────────────────────────────────────
  detectedTechnologies: z.array(z.string()).optional(),
  detectedCms: z.string().optional(),

  // ─── Project Requirements ───────────────────────────────────────────────────
  projectGoal: z.string().optional(),
  targetCms: z.array(z.string()).optional(),
  mustHaveFeatures: z.array(z.string()).optional(),

  // ─── Constraints ────────────────────────────────────────────────────────────
  timeConstraint: z.enum(['quick', 'standard', 'thorough']).optional(),
});

export type PlanningContext = z.infer<typeof planningContextSchema>;

// ─── Phase Plan Schema ─────────────────────────────────────────────────────────

/**
 * An enabled phase with priority and rationale.
 */
export const enabledPhaseSchema = z.object({
  id: z.string(),
  priority: z.enum(['required', 'recommended', 'optional']),
  rationale: z.string(),
});

export type EnabledPhase = z.infer<typeof enabledPhaseSchema>;

/**
 * A skipped phase with the reason why.
 */
export const skippedPhaseSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

export type SkippedPhase = z.infer<typeof skippedPhaseSchema>;

/**
 * Execution strategy configuration.
 */
export const executionStrategySchema = z.object({
  parallelism: z.enum(['aggressive', 'balanced', 'sequential']),
  estimatedDurationMinutes: z.number().positive(),
});

export type ExecutionStrategy = z.infer<typeof executionStrategySchema>;

/**
 * A custom phase suggested by the planner.
 */
export const customPhaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  labelDe: z.string(),
  category: phaseCategorySchema,
  description: z.string(),
  dependencies: z.array(z.string()),
  promptTemplate: z.string(),
});

export type CustomPhase = z.infer<typeof customPhaseSchema>;

/**
 * The complete analysis plan created by the planner LLM.
 */
export const phasePlanSchema = z.object({
  /** Detected or specified website type */
  websiteType: websiteTypeSchema,

  /** Phases to execute with priority and rationale */
  enabledPhases: z.array(enabledPhaseSchema),

  /** Phases that were skipped with reasons */
  skippedPhases: z.array(skippedPhaseSchema),

  /** Execution configuration */
  executionStrategy: executionStrategySchema,

  /** Custom phases suggested by the planner */
  customPhases: z.array(customPhaseSchema).optional(),
});

export type PhasePlan = z.infer<typeof phasePlanSchema>;

// ─── Default Plans ─────────────────────────────────────────────────────────────

/**
 * Creates a default plan that includes all phases (legacy behavior).
 */
export function createDefaultPlan(phaseIds: string[]): PhasePlan {
  return {
    websiteType: 'corporate',
    enabledPhases: phaseIds.map(id => ({
      id,
      priority: 'required' as const,
      rationale: 'Default plan - all phases enabled',
    })),
    skippedPhases: [],
    executionStrategy: {
      parallelism: 'balanced',
      estimatedDurationMinutes: 15,
    },
  };
}

/**
 * Creates a quick plan for time-constrained analyses.
 */
export function createQuickPlan(corePhaseIds: string[]): PhasePlan {
  return {
    websiteType: 'corporate',
    enabledPhases: corePhaseIds.map(id => ({
      id,
      priority: 'required' as const,
      rationale: 'Quick analysis - core phases only',
    })),
    skippedPhases: [],
    executionStrategy: {
      parallelism: 'aggressive',
      estimatedDurationMinutes: 5,
    },
  };
}
