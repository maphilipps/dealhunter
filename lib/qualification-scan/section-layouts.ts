// ═══════════════════════════════════════════════════════════════════════════════
// SECTION LAYOUTS - Deterministic layout definitions per section
// Replaces AI-generated layouts with fixed, predictable structures
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Responsive column breakpoints for Grid components
 */
export interface ResponsiveColumns {
  mobile: number;
  tablet: number;
  desktop: number;
}

/**
 * Layout element definition for a section
 */
export interface LayoutElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

/**
 * Complete layout definition for a section
 */
export interface SectionLayout {
  root: string;
  elements: Record<string, LayoutElement>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSIVE COLUMN PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const COLUMN_PRESETS = {
  /** Single column on all screens */
  single: { mobile: 1, tablet: 1, desktop: 1 } as ResponsiveColumns,
  /** 1 → 2 columns */
  twoCol: { mobile: 1, tablet: 2, desktop: 2 } as ResponsiveColumns,
  /** 1 → 2 → 3 columns */
  threeCol: { mobile: 1, tablet: 2, desktop: 3 } as ResponsiveColumns,
  /** 2 → 3 → 4 columns (for badges/tags) */
  fourCol: { mobile: 2, tablet: 3, desktop: 4 } as ResponsiveColumns,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION LAYOUT MAP
// Maps sectionId → deterministic layout definition
// ═══════════════════════════════════════════════════════════════════════════════

function createLayoutMap(entries: Array<[string, SectionLayout]>): Map<string, SectionLayout> {
  return new Map(entries);
}

export const SECTION_LAYOUTS: Map<string, SectionLayout> = createLayoutMap([
  [
    'tech-stack',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['tech-section', 'features-section'],
        },
        'tech-section': {
          key: 'tech-section',
          type: 'Section',
          props: { title: 'Technologie-Stack', icon: 'tech' },
          children: ['tech-grid'],
        },
        'tech-grid': {
          key: 'tech-grid',
          type: 'Grid',
          props: { columns: { mobile: 2, tablet: 3, desktop: 4 }, gap: 'sm' },
          children: [],
        },
        'features-section': {
          key: 'features-section',
          type: 'Section',
          props: { title: 'Erkannte Features', icon: 'features' },
          children: ['feature-list'],
        },
        'feature-list': {
          key: 'feature-list',
          type: 'FeatureList',
          props: { features: [] },
        },
      },
    },
  ],
  [
    'content-analysis',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['stats-section', 'content-types-section'],
        },
        'stats-section': {
          key: 'stats-section',
          type: 'Section',
          props: { title: 'Content-Statistiken', icon: 'content' },
          children: ['stats-grid'],
        },
        'stats-grid': {
          key: 'stats-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'sm' },
          children: [],
        },
        'content-types-section': {
          key: 'content-types-section',
          type: 'Section',
          props: { title: 'Content-Typen', icon: 'content' },
          children: [],
        },
      },
    },
  ],
  [
    'company-intelligence',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['company-section', 'news-section', 'contacts-section'],
        },
        'company-section': {
          key: 'company-section',
          type: 'Section',
          props: { title: 'Unternehmensdaten', icon: 'company' },
          children: ['company-card'],
        },
        'company-card': {
          key: 'company-card',
          type: 'CompanyCard',
          props: {},
        },
        'news-section': {
          key: 'news-section',
          type: 'Section',
          props: { title: 'Aktuelle News' },
          children: ['news-list'],
        },
        'news-list': {
          key: 'news-list',
          type: 'NewsList',
          props: { items: [] },
        },
        'contacts-section': {
          key: 'contacts-section',
          type: 'Section',
          props: { title: 'Entscheidungsträger', icon: 'decisionMakers' },
          children: ['decision-makers'],
        },
        'decision-makers': {
          key: 'decision-makers',
          type: 'DecisionMakersList',
          props: { contacts: [] },
        },
      },
    },
  ],
  [
    'audits',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['scores-grid', 'details-section'],
        },
        'scores-grid': {
          key: 'scores-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'sm' },
          children: [],
        },
        'details-section': {
          key: 'details-section',
          type: 'Section',
          props: { title: 'Audit-Details' },
          children: [],
        },
      },
    },
  ],
  [
    'bl-recommendation',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['recommendation-section', 'alternatives-section', 'skills-section'],
        },
        'recommendation-section': {
          key: 'recommendation-section',
          type: 'Section',
          props: { title: 'BL-Empfehlung', icon: 'recommendation' },
          children: ['recommendation'],
        },
        recommendation: {
          key: 'recommendation',
          type: 'Recommendation',
          props: { businessUnit: '', confidence: 0, reasoning: '' },
        },
        'alternatives-section': {
          key: 'alternatives-section',
          type: 'Section',
          props: { title: 'Alternativen' },
          children: ['alternatives-list'],
        },
        'alternatives-list': {
          key: 'alternatives-list',
          type: 'AlternativesList',
          props: { alternatives: [] },
        },
        'skills-section': {
          key: 'skills-section',
          type: 'Section',
          props: { title: 'Benötigte Skills' },
          children: ['skills-list'],
        },
        'skills-list': {
          key: 'skills-list',
          type: 'SkillsList',
          props: { skills: [] },
        },
      },
    },
  ],
  [
    'migration',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['migration-section'],
        },
        'migration-section': {
          key: 'migration-section',
          type: 'Section',
          props: { title: 'Migrations-Analyse', icon: 'migration' },
          children: ['migration-complexity'],
        },
        'migration-complexity': {
          key: 'migration-complexity',
          type: 'MigrationComplexity',
          props: { score: 0 },
        },
      },
    },
  ],
  [
    'executive-summary',
    {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: ['summary-section', 'metrics-grid', 'risks-section'],
        },
        'summary-section': {
          key: 'summary-section',
          type: 'Section',
          props: { title: 'Executive Summary' },
          children: ['executive-summary'],
        },
        'executive-summary': {
          key: 'executive-summary',
          type: 'ExecutiveSummary',
          props: {},
        },
        'metrics-grid': {
          key: 'metrics-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'sm' },
          children: [],
        },
        'risks-section': {
          key: 'risks-section',
          type: 'Section',
          props: { title: 'Top Risiken' },
          children: [],
        },
      },
    },
  ],
]);

/**
 * Get the deterministic layout for a section
 * Falls back to a simple single-column layout if no specific layout is defined
 */
export function getSectionLayout(sectionId: string): SectionLayout {
  return (
    SECTION_LAYOUTS.get(sectionId) ?? {
      root: 'main-grid',
      elements: {
        'main-grid': {
          key: 'main-grid',
          type: 'Grid',
          props: { columns: { mobile: 1, tablet: 1, desktop: 1 }, gap: 'md' },
          children: [],
        },
      },
    }
  );
}
