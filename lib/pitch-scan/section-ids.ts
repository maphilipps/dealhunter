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

export type PitchScanSectionId = (typeof PITCH_SCAN_SECTIONS)[keyof typeof PITCH_SCAN_SECTIONS];

export const PITCH_SCAN_SECTION_LABELS: Record<PitchScanSectionId, string> = {
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
  'ps-drupal-architecture': 'Drupal-Architektur',
  'ps-estimation': 'Aufwandsschätzung',
  'ps-documentation': 'Dokumentation',
};
