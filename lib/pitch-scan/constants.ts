import {
  PITCH_SCAN_SECTIONS,
  type BuiltInSectionId,
  PITCH_SCAN_SECTION_LABELS,
} from './section-ids';

export interface PhaseDefinition {
  id: BuiltInSectionId;
  label: string;
  order: number;
  dependencies: BuiltInSectionId[];
  model: 'fast' | 'quality';
}

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    id: PITCH_SCAN_SECTIONS.DISCOVERY,
    label: PITCH_SCAN_SECTION_LABELS['ps-discovery'],
    order: 1,
    dependencies: [],
    model: 'fast',
  },
  {
    id: PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
    label: PITCH_SCAN_SECTION_LABELS['ps-content-architecture'],
    order: 2,
    dependencies: ['ps-discovery'],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.FEATURES,
    label: PITCH_SCAN_SECTION_LABELS['ps-features'],
    order: 3,
    dependencies: ['ps-discovery', 'ps-content-architecture'],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.PERFORMANCE,
    label: PITCH_SCAN_SECTION_LABELS['ps-performance'],
    order: 4,
    dependencies: ['ps-discovery'],
    model: 'fast',
  },
  {
    id: PITCH_SCAN_SECTIONS.ACCESSIBILITY,
    label: PITCH_SCAN_SECTION_LABELS['ps-accessibility'],
    order: 5,
    dependencies: ['ps-discovery'],
    model: 'fast',
  },
  {
    id: PITCH_SCAN_SECTIONS.LEGAL,
    label: PITCH_SCAN_SECTION_LABELS['ps-legal'],
    order: 6,
    dependencies: ['ps-discovery', 'ps-features'],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.INTEGRATIONS,
    label: PITCH_SCAN_SECTION_LABELS['ps-integrations'],
    order: 7,
    dependencies: ['ps-discovery', 'ps-features'],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.MIGRATION,
    label: PITCH_SCAN_SECTION_LABELS['ps-migration'],
    order: 8,
    dependencies: [
      'ps-discovery',
      'ps-content-architecture',
      'ps-features',
      'ps-performance',
      'ps-accessibility',
      'ps-legal',
      'ps-integrations',
    ],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.CMS_COMPARISON,
    label: PITCH_SCAN_SECTION_LABELS['ps-cms-comparison'],
    order: 9,
    dependencies: [
      'ps-discovery',
      'ps-content-architecture',
      'ps-features',
      'ps-performance',
      'ps-accessibility',
      'ps-legal',
      'ps-integrations',
      'ps-migration',
    ],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.CMS_RECOMMENDATION,
    label: PITCH_SCAN_SECTION_LABELS['ps-cms-recommendation'],
    order: 10,
    dependencies: ['ps-cms-comparison'],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.DRUPAL_ARCHITECTURE,
    label: PITCH_SCAN_SECTION_LABELS['ps-drupal-architecture'],
    order: 11,
    dependencies: ['ps-content-architecture', 'ps-features', 'ps-cms-recommendation'],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.ESTIMATION,
    label: PITCH_SCAN_SECTION_LABELS['ps-estimation'],
    order: 12,
    dependencies: [
      'ps-discovery',
      'ps-content-architecture',
      'ps-features',
      'ps-performance',
      'ps-accessibility',
      'ps-legal',
      'ps-integrations',
      'ps-migration',
      'ps-cms-comparison',
      'ps-cms-recommendation',
      'ps-drupal-architecture',
    ],
    model: 'quality',
  },
  {
    id: PITCH_SCAN_SECTIONS.DOCUMENTATION,
    label: PITCH_SCAN_SECTION_LABELS['ps-documentation'],
    order: 13,
    dependencies: [
      'ps-discovery',
      'ps-content-architecture',
      'ps-features',
      'ps-performance',
      'ps-accessibility',
      'ps-legal',
      'ps-integrations',
      'ps-migration',
      'ps-cms-comparison',
      'ps-cms-recommendation',
      'ps-drupal-architecture',
      'ps-estimation',
    ],
    model: 'quality',
  },
];

export const TOTAL_PHASE_COUNT = PHASE_DEFINITIONS.length;

// ─── Phase Agent Configuration ────────────────────────────────────────────────

export interface PhaseAgentConfig {
  modelSlot: 'fast' | 'quality';
  timeoutMs: number;
  maxRetries: number;
}

const FAST_CONFIG: PhaseAgentConfig = {
  modelSlot: 'fast',
  timeoutMs: 60_000,
  maxRetries: 2,
};

const QUALITY_CONFIG: PhaseAgentConfig = {
  modelSlot: 'quality',
  timeoutMs: 120_000,
  maxRetries: 2,
};

export const PHASE_AGENT_CONFIG: Record<BuiltInSectionId, PhaseAgentConfig> = {
  'ps-discovery': FAST_CONFIG,
  'ps-content-architecture': QUALITY_CONFIG,
  'ps-features': QUALITY_CONFIG,
  'ps-performance': FAST_CONFIG,
  'ps-accessibility': FAST_CONFIG,
  'ps-legal': QUALITY_CONFIG,
  'ps-integrations': QUALITY_CONFIG,
  'ps-migration': QUALITY_CONFIG,
  'ps-cms-comparison': QUALITY_CONFIG,
  'ps-cms-recommendation': QUALITY_CONFIG,
  'ps-drupal-architecture': QUALITY_CONFIG,
  'ps-estimation': QUALITY_CONFIG,
  'ps-documentation': QUALITY_CONFIG,
};
