// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET INDICATOR STEP - QualificationScan 2.0 Workflow
// Deterministic budget estimation based on content volume and complexity factors
// ═══════════════════════════════════════════════════════════════════════════════

import type { ContentVolume, Features, MigrationComplexity, TechStack } from '../../schema';
import { wrapTool } from '../tool-wrapper';

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface BudgetScenario {
  name: string;
  totalPT: number;
  totalCost: number;
  factor: number;
}

export interface BudgetIndicatorResult {
  scenarios: BudgetScenario[];
  basePT: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DAILY_RATE_EUR = 1200; // EUR per day (8h)

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface BudgetIndicatorInput {
  contentVolume: ContentVolume;
  migrationComplexity: MigrationComplexity | undefined;
  features: Features;
  techStack: TechStack;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function calculateBasePT(pageCount: number): number {
  // Base: ~0.5 PT per page for small sites, degressive for larger sites
  if (pageCount <= 50) return Math.max(10, pageCount * 0.5);
  if (pageCount <= 200) return 25 + (pageCount - 50) * 0.3;
  if (pageCount <= 500) return 70 + (pageCount - 200) * 0.2;
  return 130 + (pageCount - 500) * 0.1;
}

function calculateMultiplier(
  features: Features,
  migrationComplexity: MigrationComplexity | undefined,
  techStack: TechStack
): number {
  let multiplier = 1.0;

  // CMS migration complexity
  if (migrationComplexity) {
    const complexityMap: Record<string, number> = {
      easy: 1.0,
      moderate: 1.2,
      complex: 1.4,
      very_complex: 1.6,
    };
    multiplier *= complexityMap[migrationComplexity.recommendation] ?? 1.2;
  } else if (techStack.cms) {
    // Fallback: known CMS adds migration overhead
    multiplier *= 1.15;
  }

  // Feature-based multipliers
  if (features.ecommerce) multiplier *= 1.4;
  if (features.userAccounts) multiplier *= 1.15;
  if (features.multiLanguage) multiplier *= 1.3;
  if (features.api) multiplier *= 1.2;
  if (features.search) multiplier *= 1.1;

  // Custom features add complexity
  const customCount = features.customFeatures?.length ?? 0;
  if (customCount > 5) multiplier *= 1.2;
  else if (customCount > 0) multiplier *= 1.1;

  return multiplier;
}

export function calculateBudgetIndicator(input: BudgetIndicatorInput): BudgetIndicatorResult {
  const pageCount = input.contentVolume.actualPageCount ?? input.contentVolume.estimatedPageCount;

  const basePT = Math.round(calculateBasePT(pageCount));
  const multiplier = calculateMultiplier(
    input.features,
    input.migrationComplexity,
    input.techStack
  );
  const adjustedPT = Math.round(basePT * multiplier);

  const scenarios: BudgetScenario[] = [
    {
      name: 'Pessimistisch',
      factor: 1.3,
      totalPT: Math.round(adjustedPT * 1.3),
      totalCost: Math.round(adjustedPT * 1.3) * DAILY_RATE_EUR,
    },
    {
      name: 'Neutral',
      factor: 1.0,
      totalPT: adjustedPT,
      totalCost: adjustedPT * DAILY_RATE_EUR,
    },
    {
      name: 'Optimistisch',
      factor: 0.8,
      totalPT: Math.round(adjustedPT * 0.8),
      totalCost: Math.round(adjustedPT * 0.8) * DAILY_RATE_EUR,
    },
    {
      name: 'AI-Powered',
      factor: 0.4,
      totalPT: Math.round(adjustedPT * 0.4),
      totalCost: Math.round(adjustedPT * 0.4) * DAILY_RATE_EUR,
    },
  ];

  return { scenarios, basePT: adjustedPT };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG FORMAT
// ═══════════════════════════════════════════════════════════════════════════════

function formatBudgetForRAG(result: unknown): string {
  const r = result as BudgetIndicatorResult;
  const lines = [`Basis-Aufwand: ${r.basePT} PT`];
  for (const s of r.scenarios) {
    lines.push(
      `${s.name}: ${s.totalPT} PT (${(s.totalCost / 1000).toFixed(0)}k EUR, Faktor ${s.factor}x)`
    );
  }
  return lines.join('. ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET INDICATOR STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const budgetIndicatorStep = wrapTool<BudgetIndicatorInput, BudgetIndicatorResult>(
  {
    name: 'budgetIndicator',
    displayName: 'Budget Indicator',
    phase: 'synthesis',
    dependencies: ['contentVolume', 'migrationComplexity', 'features', 'techStack'],
    optional: true,
    timeout: 15000,
    ragStorage: {
      chunkType: 'budget_indicator',
      category: 'estimate',
      formatContent: formatBudgetForRAG,
      getConfidence: () => 60,
    },
  },
  (input, _ctx) => {
    return calculateBudgetIndicator(input);
  }
);
