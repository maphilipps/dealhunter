export const PITCH_SCAN_SECTIONS = {
  DISCOVERY: 'ps-discovery',
  CONTENT_ARCHITECTURE: 'ps-content-architecture',
  FEATURES: 'ps-features',
  PERFORMANCE: 'ps-performance',
  ACCESSIBILITY: 'ps-accessibility',
  LEGAL: 'ps-legal',
  INTEGRATIONS: 'ps-integrations',
  MIGRATION: 'ps-migration',
  CMS_COMPARISON: 'ps-cms-comparison',
  CMS_RECOMMENDATION: 'ps-cms-recommendation',
  DRUPAL_ARCHITECTURE: 'ps-drupal-architecture',
  ESTIMATION: 'ps-estimation',
  DOCUMENTATION: 'ps-documentation',
} as const;

// ─── Section ID Types ──────────────────────────────────────────────────────────

/** Built-in section IDs (for type safety in core phases) */
export type BuiltInSectionId = (typeof PITCH_SCAN_SECTIONS)[keyof typeof PITCH_SCAN_SECTIONS];

/** Dynamic section IDs can be any string (for custom/generated phases) */
export type DynamicSectionId = string & { readonly __brand?: 'dynamic' };

/**
 * Union type for backward compatibility.
 * Accepts both built-in and dynamic section IDs.
 * Note: This is effectively string, but the union is kept for documentation purposes.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type PitchScanSectionId = BuiltInSectionId | DynamicSectionId;

/**
 * Type guard to check if a section ID is a built-in section.
 */
export function isBuiltInSection(id: string): id is BuiltInSectionId {
  return Object.values(PITCH_SCAN_SECTIONS).includes(id as BuiltInSectionId);
}

// ─── Section Labels ────────────────────────────────────────────────────────────

export const PITCH_SCAN_SECTION_LABELS: Record<BuiltInSectionId, string> = {
  'ps-discovery': 'Discovery & Tech-Stack',
  'ps-content-architecture': 'Content-Architektur',
  'ps-features': 'Features & Funktionalität',
  'ps-performance': 'Performance',
  'ps-accessibility': 'Barrierefreiheit',
  'ps-legal': 'Legal & Compliance',
  'ps-integrations': 'Integrationen',
  'ps-migration': 'Migration',
  'ps-cms-comparison': 'CMS-Vergleich',
  'ps-cms-recommendation': 'CMS-Empfehlung',
  'ps-drupal-architecture': 'Architektur',
  'ps-estimation': 'Aufwandsschätzung',
  'ps-documentation': 'Dokumentation',
};

/**
 * Get the label for a section ID, with fallback for dynamic sections.
 */
export function getSectionLabel(id: string): string {
  if (isBuiltInSection(id)) {
    return PITCH_SCAN_SECTION_LABELS[id];
  }
  // For dynamic sections, format the ID as a readable label
  return id
    .replace(/^ps-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
