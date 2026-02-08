import type { PhasePlan, PhaseResult, PhaseCategory } from './types';
import { CAPABILITY_MAP } from './capabilities';

// ─── Generated Navigation Types ────────────────────────────────────────────────

export interface GeneratedNavSection {
  /** Unique section ID */
  id: string;
  /** Human-readable label */
  label: string;
  /** Route path segment */
  route: string;
  /** Category for grouping */
  category: string;
  /** Whether the section has content */
  hasContent: boolean;
  /** Confidence score if available */
  confidence?: number;
}

export interface GeneratedNavCategory {
  id: string;
  label: string;
  count: number;
}

export interface GeneratedNavigation {
  sections: GeneratedNavSection[];
  categories: GeneratedNavCategory[];
}

// ─── Category Configuration ────────────────────────────────────────────────────

const CATEGORY_ORDER: PhaseCategory[] = [
  'discovery',
  'technical',
  'legal',
  'cms',
  'architecture',
  'synthesis',
];

const CATEGORY_LABELS: Record<PhaseCategory, string> = {
  discovery: 'Discovery',
  technical: 'Technische Analyse',
  legal: 'Rechtliches',
  cms: 'CMS-Analyse',
  architecture: 'Architektur',
  synthesis: 'Zusammenfassung',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as PhaseCategory] ?? category;
}

// ─── Navigation Generator ──────────────────────────────────────────────────────

/**
 * Generates navigation structure from the analysis plan and results.
 * Only includes phases that were actually executed and have results.
 */
export function generateNavigation(
  plan: PhasePlan,
  results: Record<string, PhaseResult>
): GeneratedNavigation {
  const sections: GeneratedNavSection[] = [];
  const categoryCount = new Map<string, number>();

  // Add overview section first (always present)
  sections.push({
    id: 'ps-overview',
    label: 'Pitch Scan Übersicht',
    route: 'pitch-scan',
    category: 'overview',
    hasContent: true,
  });

  // Add completed phases from the plan
  for (const phase of plan.enabledPhases) {
    const capability = CAPABILITY_MAP.get(phase.id);
    const result = results[phase.id];

    if (capability && result) {
      sections.push({
        id: phase.id,
        label: capability.labelDe,
        route: `pitch-scan/${phase.id}`,
        category: capability.category,
        hasContent: true,
        confidence: result.confidence,
      });

      categoryCount.set(capability.category, (categoryCount.get(capability.category) ?? 0) + 1);
    }
  }

  // Add custom phases if any
  for (const custom of plan.customPhases ?? []) {
    const result = results[custom.id];
    if (result) {
      sections.push({
        id: custom.id,
        label: custom.labelDe,
        route: `pitch-scan/${custom.id}`,
        category: custom.category,
        hasContent: true,
        confidence: result.confidence,
      });

      categoryCount.set(custom.category, (categoryCount.get(custom.category) ?? 0) + 1);
    }
  }

  // Build categories array sorted by predefined order
  const categories = Array.from(categoryCount.entries())
    .map(([id, count]) => ({
      id,
      label: getCategoryLabel(id),
      count,
    }))
    .sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.id as PhaseCategory);
      const bIndex = CATEGORY_ORDER.indexOf(b.id as PhaseCategory);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  return { sections, categories };
}

/**
 * Creates navigation for sections that are still in progress.
 * Shows planned phases with a pending state.
 */
export function generatePendingNavigation(plan: PhasePlan): GeneratedNavigation {
  const sections: GeneratedNavSection[] = [];
  const categoryCount = new Map<string, number>();

  // Add overview section first
  sections.push({
    id: 'ps-overview',
    label: 'Pitch Scan Übersicht',
    route: 'pitch-scan',
    category: 'overview',
    hasContent: true,
  });

  // Add all planned phases (even if not yet complete)
  for (const phase of plan.enabledPhases) {
    const capability = CAPABILITY_MAP.get(phase.id);

    if (capability) {
      sections.push({
        id: phase.id,
        label: capability.labelDe,
        route: `pitch-scan/${phase.id}`,
        category: capability.category,
        hasContent: false, // Not yet complete
      });

      categoryCount.set(capability.category, (categoryCount.get(capability.category) ?? 0) + 1);
    }
  }

  const categories = Array.from(categoryCount.entries())
    .map(([id, count]) => ({
      id,
      label: getCategoryLabel(id),
      count,
    }))
    .sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a.id as PhaseCategory);
      const bIndex = CATEGORY_ORDER.indexOf(b.id as PhaseCategory);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  return { sections, categories };
}

/**
 * Merges dynamic navigation with existing static navigation.
 * Replaces the pitch-scan section with the dynamic version.
 */
export function mergeWithStaticNavigation<T extends { id: string }>(
  staticSections: T[],
  dynamicNavigation: GeneratedNavigation
): (T | { id: string; subsections: GeneratedNavSection[] })[] {
  const result = [...staticSections];

  const pitchScanIndex = result.findIndex(s => s.id === 'pitch-scan');
  if (pitchScanIndex >= 0) {
    // Replace static pitch-scan section with dynamic one
    result[pitchScanIndex] = {
      ...result[pitchScanIndex],
      id: 'pitch-scan',
      subsections: dynamicNavigation.sections,
    };
  }

  return result;
}
