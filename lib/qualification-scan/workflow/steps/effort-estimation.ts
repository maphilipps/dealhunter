// ═══════════════════════════════════════════════════════════════════════════════
// EFFORT ESTIMATION STEP - QualificationScan 2.0 Workflow
// Deterministic T-Shirt size estimation based on content volume and features
// ═══════════════════════════════════════════════════════════════════════════════

import type { ContentVolume, Features, MigrationComplexity } from '../../schema';
import { wrapTool } from '../tool-wrapper';

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export type TShirtSize = 'S' | 'M' | 'L' | 'XL';

export interface EffortMultiplier {
  name: string;
  factor: number;
}

export interface EffortEstimationResult {
  tShirtSize: TShirtSize;
  baseSize: TShirtSize;
  multipliers: EffortMultiplier[];
  finalSize: TShirtSize;
  reasoning: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

interface EffortEstimationInput {
  contentVolume: ContentVolume;
  features: Features;
  migrationComplexity: MigrationComplexity | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIZE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

const SIZE_ORDER: TShirtSize[] = ['S', 'M', 'L', 'XL'];

function sizeToIndex(size: TShirtSize): number {
  return SIZE_ORDER.indexOf(size);
}

function indexToSize(index: number): TShirtSize {
  return SIZE_ORDER[Math.min(Math.max(0, index), SIZE_ORDER.length - 1)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTIMATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function getBaseSize(pageCount: number): TShirtSize {
  if (pageCount < 50) return 'S';
  if (pageCount < 200) return 'M';
  if (pageCount < 500) return 'L';
  return 'XL';
}

export function calculateEffortEstimation(input: EffortEstimationInput): EffortEstimationResult {
  const pageCount = input.contentVolume.actualPageCount ?? input.contentVolume.estimatedPageCount;

  const baseSize = getBaseSize(pageCount);
  const multipliers: EffortMultiplier[] = [];
  let sizeIndex = sizeToIndex(baseSize);
  const reasons: string[] = [`${pageCount} Seiten => Basis ${baseSize}`];

  // Multi-Language multiplier
  if (input.features.multiLanguage) {
    const langCount = input.contentVolume.languages?.length ?? 2;
    if (langCount > 1) {
      multipliers.push({ name: 'Multi-Language', factor: 1.3 });
      sizeIndex += 1;
      reasons.push(`Mehrsprachigkeit (${langCount} Sprachen)`);
    }
  }

  // Integration count (API + ecommerce + custom features > 5)
  const customCount = input.features.customFeatures?.length ?? 0;
  const integrationScore =
    (input.features.api ? 1 : 0) + (input.features.ecommerce ? 2 : 0) + customCount;
  if (integrationScore > 5) {
    multipliers.push({ name: 'Viele Integrationen', factor: 1.2 });
    sizeIndex += 1;
    reasons.push(`${integrationScore} Integrationen/Features`);
  }

  // Custom features > 10
  if (customCount > 10) {
    multipliers.push({ name: 'Viele Custom-Features', factor: 1.3 });
    sizeIndex += 1;
    reasons.push(`${customCount} Custom-Features`);
  }

  // Migration complexity boost
  if (
    input.migrationComplexity?.recommendation === 'complex' ||
    input.migrationComplexity?.recommendation === 'very_complex'
  ) {
    multipliers.push({ name: 'Hohe Migrationskomplexität', factor: 1.2 });
    sizeIndex += 1;
    reasons.push('Hohe Migrationskomplexität');
  }

  const finalSize = indexToSize(sizeIndex);

  return {
    tShirtSize: finalSize,
    baseSize,
    multipliers,
    finalSize,
    reasoning: reasons.join('. ') + '.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG FORMAT
// ═══════════════════════════════════════════════════════════════════════════════

function formatEffortForRAG(result: unknown): string {
  const r = result as EffortEstimationResult;
  const parts = [`T-Shirt-Size: ${r.finalSize} (Basis: ${r.baseSize})`];
  if (r.multipliers.length > 0) {
    parts.push(`Faktoren: ${r.multipliers.map(m => `${m.name} (${m.factor}x)`).join(', ')}`);
  }
  parts.push(r.reasoning);
  return parts.join('. ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EFFORT ESTIMATION STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const effortEstimationStep = wrapTool<EffortEstimationInput, EffortEstimationResult>(
  {
    name: 'effortEstimation',
    displayName: 'Effort Estimation',
    phase: 'synthesis',
    dependencies: ['contentVolume', 'features', 'migrationComplexity'],
    optional: true,
    timeout: 10000,
    ragStorage: {
      chunkType: 'effort_estimation',
      category: 'estimate',
      formatContent: formatEffortForRAG,
      getConfidence: () => 65,
    },
  },
  (input, _ctx) => {
    return calculateEffortEstimation(input);
  }
);
