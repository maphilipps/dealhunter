/**
 * PT Estimation Calculator
 *
 * Calculates Person-Tage (PT) estimates based on baseline projects with delta analysis.
 *
 * Methodology:
 * 1. Match Lead to Baseline CMS (via technologies table)
 * 2. Calculate Delta (customer entities - baseline entities)
 * 3. Calculate Additional PT (delta × multipliers)
 * 4. Total PT = Baseline PT + Additional PT + Risk Buffer
 * 5. Generate Phase Breakdown (Foundation, Custom Dev, Integrations, Migration, Testing)
 * 6. Generate Discipline Matrix (roles × hours)
 */

import { eq } from 'drizzle-orm';

import type { ContentArchitectureResult } from '../agents/content-architecture-agent';
import type { MigrationComplexityResult } from '../agents/migration-complexity-agent';
import { db } from '../db';
import { technologies, type Technology } from '../db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EntityCounts {
  contentTypes?: number;
  paragraphs?: number;
  taxonomies?: number;
  views?: number;
  blocks?: number;
  templates?: number;
  apps?: number;
  modules?: number;
  snippets?: number;
}

export interface Phase {
  name: string;
  hours: number;
  percentage: number;
  description: string;
}

export interface DisciplineAllocation {
  role: string;
  hours: number;
  percentage: number;
}

export interface PTEstimationResult {
  success: boolean;

  // Baseline Info
  baselineName: string;
  baselineHours: number;
  baselineEntityCounts: EntityCounts;

  // Delta Analysis
  customerEntityCounts: EntityCounts;
  delta: {
    contentTypes: number;
    paragraphs: number;
    taxonomies: number;
    views: number;
    blocks: number;
    other: number;
  };

  // PT Calculation
  additionalPT: number; // hours from delta
  riskBuffer: number; // % buffer
  confidenceLevel: 'low' | 'medium' | 'high';
  totalPT: number; // baseline + additional + buffer

  // Breakdowns
  phases: Phase[];
  disciplines: DisciplineAllocation[];

  // Assumptions
  assumptions: string[];

  // Metadata
  calculatedAt: string;
  error?: string;
}

export interface CalculatePTEstimationInput {
  leadId: string;
  technologyId: string; // CMS to estimate for (from CMS Match winner)
  contentArchitecture: ContentArchitectureResult;
  migrationComplexity: MigrationComplexityResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PT Multipliers per entity type (hours per additional entity)
 */
const PT_MULTIPLIERS = {
  contentTypes: 15, // 15 hours per additional content type
  paragraphs: 6, // 6 hours per additional paragraph/component
  taxonomies: 4, // 4 hours per additional taxonomy
  views: 8, // 8 hours per additional view
  blocks: 5, // 5 hours per additional block
  templates: 10, // 10 hours per additional template
  apps: 20, // 20 hours per additional app
  modules: 12, // 12 hours per additional module
  snippets: 5, // 5 hours per additional snippet
};

/**
 * Phase Distribution (% of total PT)
 */
const PHASE_DISTRIBUTION = {
  foundation: {
    percentage: 30,
    name: 'Foundation Setup',
    description: 'Base installation, theme, baseline entities',
  },
  customDev: {
    percentage: 35,
    name: 'Custom Development',
    description: 'Additional content types, components, features',
  },
  integrations: {
    percentage: 10,
    name: 'Integrations',
    description: 'Third-party integrations, APIs',
  },
  migration: {
    percentage: 15,
    name: 'Content Migration',
    description: 'Data migration, content transfer',
  },
  testing: {
    percentage: 10,
    name: 'Testing & QA',
    description: 'Testing, bug fixes, performance optimization',
  },
};

/**
 * Discipline Distribution (% of total PT)
 */
const DISCIPLINE_DISTRIBUTION = {
  architect: { percentage: 10, role: 'Solution Architect' },
  backend: { percentage: 40, role: 'Backend Developer' },
  frontend: { percentage: 25, role: 'Frontend Developer' },
  qa: { percentage: 10, role: 'QA Engineer' },
  pm: { percentage: 10, role: 'Project Manager' },
  devops: { percentage: 5, role: 'DevOps Engineer' },
};

/**
 * Risk Buffer Calculation (based on complexity score)
 */
const RISK_BUFFER_RANGES = [
  { maxComplexity: 25, buffer: 10, confidence: 'high' as const }, // Low complexity → 10% buffer
  { maxComplexity: 50, buffer: 20, confidence: 'medium' as const }, // Medium complexity → 20% buffer
  { maxComplexity: 75, buffer: 30, confidence: 'medium' as const }, // High complexity → 30% buffer
  { maxComplexity: 100, buffer: 40, confidence: 'low' as const }, // Very high complexity → 40% buffer
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate PT Estimation
 *
 * @param input - Lead, technology, content architecture, and migration complexity
 * @returns PT estimation with phases and disciplines
 */
export async function calculatePTEstimation(
  input: CalculatePTEstimationInput
): Promise<PTEstimationResult> {
  console.error(`[PT Calculator] Starting calculation for lead ${input.leadId}`);

  try {
    const { technologyId, contentArchitecture, migrationComplexity } = input;

    // 1. Fetch Baseline Technology
    const technology = await db.query.technologies.findFirst({
      where: eq(technologies.id, technologyId),
    });

    if (!technology) {
      throw new Error(`Technology ${technologyId} not found`);
    }

    if (!technology.baselineHours || !technology.baselineEntityCounts) {
      throw new Error(`Technology ${technology.name} has no baseline data`);
    }

    const baselineEntityCounts = JSON.parse(technology.baselineEntityCounts) as EntityCounts;

    console.error('[PT Calculator] Baseline loaded', {
      name: technology.baselineName,
      hours: technology.baselineHours,
      entities: baselineEntityCounts,
    });

    // 2. Extract Customer Entity Counts from Content Architecture
    const customerEntityCounts = extractCustomerEntityCounts(contentArchitecture);

    console.error('[PT Calculator] Customer entities extracted', customerEntityCounts);

    // 3. Calculate Delta
    const delta = calculateDelta(customerEntityCounts, baselineEntityCounts);

    console.error('[PT Calculator] Delta calculated', delta);

    // 4. Calculate Additional PT
    const additionalPT = calculateAdditionalPT(delta);

    console.error('[PT Calculator] Additional PT calculated', { additionalPT });

    // 5. Calculate Risk Buffer & Confidence
    const { riskBuffer, confidenceLevel } = calculateRiskBuffer(
      migrationComplexity.complexityScore
    );

    console.error('[PT Calculator] Risk buffer calculated', { riskBuffer, confidenceLevel });

    // 6. Calculate Total PT
    const basePT = technology.baselineHours + additionalPT;
    const bufferHours = Math.round(basePT * (riskBuffer / 100));
    const totalPT = basePT + bufferHours;

    console.error('[PT Calculator] Total PT calculated', { basePT, bufferHours, totalPT });

    // 7. Generate Phase Breakdown
    const phases = generatePhaseBreakdown(totalPT);

    // 8. Generate Discipline Matrix
    const disciplines = generateDisciplineMatrix(totalPT);

    // 9. Generate Assumptions
    const assumptions = generateAssumptions(
      technology,
      contentArchitecture,
      migrationComplexity,
      delta
    );

    return {
      success: true,
      baselineName: technology.baselineName || technology.name,
      baselineHours: technology.baselineHours,
      baselineEntityCounts,
      customerEntityCounts,
      delta,
      additionalPT,
      riskBuffer,
      confidenceLevel,
      totalPT,
      phases,
      disciplines,
      assumptions,
      calculatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[PT Calculator] Error:', error);

    return {
      success: false,
      baselineName: '',
      baselineHours: 0,
      baselineEntityCounts: {},
      customerEntityCounts: {},
      delta: {
        contentTypes: 0,
        paragraphs: 0,
        taxonomies: 0,
        views: 0,
        blocks: 0,
        other: 0,
      },
      additionalPT: 0,
      riskBuffer: 0,
      confidenceLevel: 'low',
      totalPT: 0,
      phases: [],
      disciplines: [],
      assumptions: [],
      calculatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract customer entity counts from content architecture
 */
function extractCustomerEntityCounts(contentArchitecture: ContentArchitectureResult): EntityCounts {
  // Map content types to entity counts
  const contentTypes = contentArchitecture.contentTypes.length;

  // Estimate paragraphs/components based on content types
  // Heuristic: ~3 components per content type on average
  const paragraphs = contentTypes * 3;

  // Estimate taxonomies based on navigation structure
  // Heuristic: ~1 taxonomy per 2 content types
  const taxonomies = Math.ceil(contentTypes / 2);

  // Estimate views based on content volume
  // Heuristic: ~1 view per 3 content types
  const views = Math.ceil(contentTypes / 3);

  // Estimate blocks based on navigation breadth
  const blocks = contentArchitecture.navigationStructure.breadth;

  return {
    contentTypes,
    paragraphs,
    taxonomies,
    views,
    blocks,
  };
}

/**
 * Calculate delta between customer and baseline entities
 */
function calculateDelta(
  customer: EntityCounts,
  baseline: EntityCounts
): {
  contentTypes: number;
  paragraphs: number;
  taxonomies: number;
  views: number;
  blocks: number;
  other: number;
} {
  return {
    contentTypes: Math.max(0, (customer.contentTypes || 0) - (baseline.contentTypes || 0)),
    paragraphs: Math.max(0, (customer.paragraphs || 0) - (baseline.paragraphs || 0)),
    taxonomies: Math.max(0, (customer.taxonomies || 0) - (baseline.taxonomies || 0)),
    views: Math.max(0, (customer.views || 0) - (baseline.views || 0)),
    blocks: Math.max(0, (customer.blocks || 0) - (baseline.blocks || 0)),
    other: 0, // Reserved for future use (templates, apps, modules, snippets)
  };
}

/**
 * Calculate additional PT from delta
 */
function calculateAdditionalPT(delta: {
  contentTypes: number;
  paragraphs: number;
  taxonomies: number;
  views: number;
  blocks: number;
  other: number;
}): number {
  const additionalPT =
    delta.contentTypes * PT_MULTIPLIERS.contentTypes +
    delta.paragraphs * PT_MULTIPLIERS.paragraphs +
    delta.taxonomies * PT_MULTIPLIERS.taxonomies +
    delta.views * PT_MULTIPLIERS.views +
    delta.blocks * PT_MULTIPLIERS.blocks;

  return Math.round(additionalPT);
}

/**
 * Calculate risk buffer percentage based on complexity score
 */
function calculateRiskBuffer(complexityScore: number): {
  riskBuffer: number;
  confidenceLevel: 'low' | 'medium' | 'high';
} {
  const range = RISK_BUFFER_RANGES.find(r => complexityScore <= r.maxComplexity);

  if (!range) {
    // Fallback (should never happen)
    return { riskBuffer: 40, confidenceLevel: 'low' };
  }

  return {
    riskBuffer: range.buffer,
    confidenceLevel: range.confidence,
  };
}

/**
 * Generate phase breakdown
 */
function generatePhaseBreakdown(totalPT: number): Phase[] {
  return Object.entries(PHASE_DISTRIBUTION).map(([_key, phase]) => ({
    name: phase.name,
    hours: Math.round(totalPT * (phase.percentage / 100)),
    percentage: phase.percentage,
    description: phase.description,
  }));
}

/**
 * Generate discipline matrix
 */
function generateDisciplineMatrix(totalPT: number): DisciplineAllocation[] {
  return Object.entries(DISCIPLINE_DISTRIBUTION).map(([_key, discipline]) => ({
    role: discipline.role,
    hours: Math.round(totalPT * (discipline.percentage / 100)),
    percentage: discipline.percentage,
  }));
}

/**
 * Generate assumptions
 */
function generateAssumptions(
  technology: Technology,
  contentArchitecture: ContentArchitectureResult,
  migrationComplexity: MigrationComplexityResult,
  delta: {
    contentTypes: number;
    paragraphs: number;
    taxonomies: number;
    views: number;
    blocks: number;
    other: number;
  }
): string[] {
  const assumptions: string[] = [
    `Baseline: ${technology.baselineName} (${technology.baselineHours}h)`,
    `Additional content types: ${delta.contentTypes} × ${PT_MULTIPLIERS.contentTypes}h = ${delta.contentTypes * PT_MULTIPLIERS.contentTypes}h`,
    `Additional components: ${delta.paragraphs} × ${PT_MULTIPLIERS.paragraphs}h = ${delta.paragraphs * PT_MULTIPLIERS.paragraphs}h`,
    `Migration complexity: ${migrationComplexity.complexityCategory.toUpperCase()} (score: ${migrationComplexity.complexityScore})`,
    `Page count: ~${contentArchitecture.pageCount} pages (${contentArchitecture.pageCountConfidence} confidence)`,
  ];

  // Add complexity-specific assumptions
  if (migrationComplexity.complexityScore > 50) {
    assumptions.push('High complexity requires additional architecture workshops');
  }

  if (contentArchitecture.pageCount > 1000) {
    assumptions.push('Large content volume requires dedicated migration tooling');
  }

  if (delta.contentTypes > 10) {
    assumptions.push('Many custom content types require extensive content modeling');
  }

  return assumptions;
}
