import type { ModelSlot } from '@/lib/ai/model-config';

import type { PhaseCategory } from './types';
import { PITCH_SCAN_SECTIONS, PITCH_SCAN_SECTION_LABELS } from './section-ids';

// ─── Website Type ──────────────────────────────────────────────────────────────

export type WebsiteType =
  | 'e-commerce'
  | 'portal'
  | 'corporate'
  | 'informational'
  | 'blog'
  | 'multi-site';

// ─── Capability Interface ──────────────────────────────────────────────────────

/**
 * A capability is an optional analysis phase that CAN be executed.
 * The planner decides which capabilities to activate based on context.
 */
export interface Capability {
  /** Unique identifier (e.g., 'ps-discovery') */
  id: string;
  /** English label for logs/debug */
  label: string;
  /** German label for UI display */
  labelDe: string;
  /** Category for UI grouping */
  category: PhaseCategory;
  /** Description for planner context */
  description: string;

  // ─── Execution Config ─────────────────────────────────────────────────────────

  /** Model slot to use for this phase */
  modelSlot: ModelSlot;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;

  // ─── DAG Dependencies ─────────────────────────────────────────────────────────

  /** Other capability IDs that must complete before this one */
  dependencies: string[];

  // ─── Relevance Conditions ─────────────────────────────────────────────────────

  /** Conditions for when this capability is relevant */
  relevance: {
    /** Only relevant for these website types */
    websiteTypes?: WebsiteType[];
    /** Requires a crawlable website URL */
    requiresWebsite?: boolean;
    /** Only relevant for these procurement types */
    procurementTypes?: ('public' | 'private' | 'semi-public')[];
    /** Minimum discovery confidence required to run */
    minConfidence?: number;
  };
}

// ─── Capability Pool ───────────────────────────────────────────────────────────

/**
 * The complete pool of available analysis capabilities.
 * The planner selects from this pool based on context.
 */
export const CAPABILITY_POOL: Capability[] = [
  // ─── Discovery Phase (always first) ───────────────────────────────────────────
  {
    id: PITCH_SCAN_SECTIONS.DISCOVERY,
    label: 'Discovery & Tech Stack',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-discovery'],
    category: 'discovery',
    description:
      'Detects technologies, frameworks, CMS, hosting, and basic site structure. Foundation for all other phases.',
    modelSlot: 'fast',
    timeoutMs: 60_000,
    maxRetries: 2,
    dependencies: [],
    relevance: {
      requiresWebsite: true,
    },
  },

  // ─── Technical Analysis Phases ────────────────────────────────────────────────
  {
    id: PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
    label: 'Content Architecture',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-content-architecture'],
    category: 'technical',
    description: 'Analyzes page types, content models, taxonomies, and information architecture.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.DISCOVERY],
    relevance: {
      requiresWebsite: true,
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.FEATURES,
    label: 'Features & Functionality',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-features'],
    category: 'technical',
    description:
      'Identifies website features, interactive elements, forms, search, and custom functionality.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.DISCOVERY, PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE],
    relevance: {
      requiresWebsite: true,
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.PERFORMANCE,
    label: 'Performance Analysis',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-performance'],
    category: 'technical',
    description:
      'Analyzes Core Web Vitals, loading performance, caching, and optimization opportunities.',
    modelSlot: 'fast',
    timeoutMs: 60_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.DISCOVERY],
    relevance: {
      requiresWebsite: true,
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.ACCESSIBILITY,
    label: 'Accessibility Audit',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-accessibility'],
    category: 'technical',
    description: 'WCAG compliance, ARIA usage, keyboard navigation, screen reader compatibility.',
    modelSlot: 'fast',
    timeoutMs: 60_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.DISCOVERY],
    relevance: {
      requiresWebsite: true,
      // Most relevant for public sector
      procurementTypes: ['public', 'semi-public'],
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.INTEGRATIONS,
    label: 'Integrations Analysis',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-integrations'],
    category: 'technical',
    description: 'Detects third-party integrations, APIs, external services, and data flows.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.DISCOVERY, PITCH_SCAN_SECTIONS.FEATURES],
    relevance: {
      requiresWebsite: true,
    },
  },

  // ─── Legal Phase ──────────────────────────────────────────────────────────────
  {
    id: PITCH_SCAN_SECTIONS.LEGAL,
    label: 'Legal & Compliance',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-legal'],
    category: 'legal',
    description: 'GDPR compliance, cookie consent, imprint, privacy policy, legal requirements.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.DISCOVERY, PITCH_SCAN_SECTIONS.FEATURES],
    relevance: {
      requiresWebsite: true,
      procurementTypes: ['public', 'semi-public'],
    },
  },

  // ─── Migration & CMS Phases ───────────────────────────────────────────────────
  {
    id: PITCH_SCAN_SECTIONS.MIGRATION,
    label: 'Migration Assessment',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-migration'],
    category: 'cms',
    description:
      'Evaluates migration complexity, content volume, technical debt, and migration risks.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [
      PITCH_SCAN_SECTIONS.DISCOVERY,
      PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
      PITCH_SCAN_SECTIONS.FEATURES,
      PITCH_SCAN_SECTIONS.PERFORMANCE,
      PITCH_SCAN_SECTIONS.ACCESSIBILITY,
      PITCH_SCAN_SECTIONS.LEGAL,
      PITCH_SCAN_SECTIONS.INTEGRATIONS,
    ],
    relevance: {
      requiresWebsite: true,
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.CMS_COMPARISON,
    label: 'CMS Comparison',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-cms-comparison'],
    category: 'cms',
    description:
      'Compares target CMS options based on requirements, features, and project constraints.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [
      PITCH_SCAN_SECTIONS.DISCOVERY,
      PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
      PITCH_SCAN_SECTIONS.FEATURES,
      PITCH_SCAN_SECTIONS.PERFORMANCE,
      PITCH_SCAN_SECTIONS.ACCESSIBILITY,
      PITCH_SCAN_SECTIONS.LEGAL,
      PITCH_SCAN_SECTIONS.INTEGRATIONS,
      PITCH_SCAN_SECTIONS.MIGRATION,
    ],
    relevance: {
      requiresWebsite: true,
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.CMS_RECOMMENDATION,
    label: 'CMS Recommendation',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-cms-recommendation'],
    category: 'cms',
    description:
      'Provides final CMS recommendation with detailed rationale and implementation notes.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [PITCH_SCAN_SECTIONS.CMS_COMPARISON],
    relevance: {
      requiresWebsite: true,
    },
  },

  // ─── Architecture Phase ───────────────────────────────────────────────────────
  {
    id: PITCH_SCAN_SECTIONS.DRUPAL_ARCHITECTURE,
    label: 'Drupal Architecture',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-drupal-architecture'],
    category: 'architecture',
    description:
      'Designs Drupal content types, paragraphs, taxonomies, and module recommendations.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [
      PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
      PITCH_SCAN_SECTIONS.FEATURES,
      PITCH_SCAN_SECTIONS.CMS_RECOMMENDATION,
    ],
    relevance: {
      requiresWebsite: true,
    },
  },

  // ─── Synthesis Phases (always last) ───────────────────────────────────────────
  {
    id: PITCH_SCAN_SECTIONS.ESTIMATION,
    label: 'Effort Estimation',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-estimation'],
    category: 'synthesis',
    description:
      'Calculates effort estimates in person-days for implementation, based on all analysis results.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [
      PITCH_SCAN_SECTIONS.DISCOVERY,
      PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
      PITCH_SCAN_SECTIONS.FEATURES,
      PITCH_SCAN_SECTIONS.PERFORMANCE,
      PITCH_SCAN_SECTIONS.ACCESSIBILITY,
      PITCH_SCAN_SECTIONS.LEGAL,
      PITCH_SCAN_SECTIONS.INTEGRATIONS,
      PITCH_SCAN_SECTIONS.MIGRATION,
      PITCH_SCAN_SECTIONS.CMS_COMPARISON,
      PITCH_SCAN_SECTIONS.CMS_RECOMMENDATION,
      PITCH_SCAN_SECTIONS.DRUPAL_ARCHITECTURE,
    ],
    relevance: {
      // Always relevant as final synthesis
    },
  },
  {
    id: PITCH_SCAN_SECTIONS.DOCUMENTATION,
    label: 'Documentation',
    labelDe: PITCH_SCAN_SECTION_LABELS['ps-documentation'],
    category: 'synthesis',
    description: 'Generates final documentation, executive summary, and pitch materials.',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: [
      PITCH_SCAN_SECTIONS.DISCOVERY,
      PITCH_SCAN_SECTIONS.CONTENT_ARCHITECTURE,
      PITCH_SCAN_SECTIONS.FEATURES,
      PITCH_SCAN_SECTIONS.PERFORMANCE,
      PITCH_SCAN_SECTIONS.ACCESSIBILITY,
      PITCH_SCAN_SECTIONS.LEGAL,
      PITCH_SCAN_SECTIONS.INTEGRATIONS,
      PITCH_SCAN_SECTIONS.MIGRATION,
      PITCH_SCAN_SECTIONS.CMS_COMPARISON,
      PITCH_SCAN_SECTIONS.CMS_RECOMMENDATION,
      PITCH_SCAN_SECTIONS.DRUPAL_ARCHITECTURE,
      PITCH_SCAN_SECTIONS.ESTIMATION,
    ],
    relevance: {
      // Always relevant as final synthesis
    },
  },
];

// ─── Quick Lookup Maps ─────────────────────────────────────────────────────────

/** O(1) lookup of capability by ID */
export const CAPABILITY_MAP = new Map(CAPABILITY_POOL.map(cap => [cap.id, cap]));

/** Get capability by ID, throws if not found */
export function getCapability(id: string): Capability {
  const cap = CAPABILITY_MAP.get(id);
  if (!cap) {
    throw new Error(`Unknown capability: ${id}`);
  }
  return cap;
}

/** Check if a capability ID exists in the pool */
export function hasCapability(id: string): boolean {
  return CAPABILITY_MAP.has(id);
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Filter capabilities by relevance conditions.
 */
export function filterRelevantCapabilities(context: {
  websiteUrl?: string;
  websiteType?: WebsiteType;
  procurementType?: 'public' | 'private' | 'semi-public';
}): Capability[] {
  return CAPABILITY_POOL.filter(cap => {
    const { relevance } = cap;

    // Check website requirement
    if (relevance.requiresWebsite && !context.websiteUrl) {
      return false;
    }

    // Check website type
    if (relevance.websiteTypes && context.websiteType) {
      if (!relevance.websiteTypes.includes(context.websiteType)) {
        return false;
      }
    }

    // Check procurement type
    if (relevance.procurementTypes && context.procurementType) {
      if (!relevance.procurementTypes.includes(context.procurementType)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get capabilities grouped by category.
 */
export function getCapabilitiesByCategory(): Record<PhaseCategory, Capability[]> {
  const result: Record<PhaseCategory, Capability[]> = {
    discovery: [],
    technical: [],
    legal: [],
    cms: [],
    architecture: [],
    synthesis: [],
  };

  for (const cap of CAPABILITY_POOL) {
    result[cap.category].push(cap);
  }

  return result;
}
