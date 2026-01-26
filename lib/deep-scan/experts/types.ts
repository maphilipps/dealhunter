import { z } from 'zod';

import type {
  createRagWriteTool,
  createBatchRagWriteTool,
  createVisualizationWriteTool,
} from '@/lib/agent-tools';

/**
 * Finding input for RAG storage
 */
export interface FindingInput {
  category: 'fact' | 'elaboration' | 'recommendation' | 'risk' | 'estimate';
  chunkType: string;
  content: string;
  confidence: number;
  requiresValidation?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Visualization input for RAG storage (JsonRenderTree)
 */
export interface VisualizationInput {
  sectionId: string;
  visualization: {
    root: string | null;
    elements: Record<
      string,
      {
        key: string;
        type: string;
        props: Record<string, unknown>;
        children?: string[];
      }
    >;
  };
  confidence: number;
}

/**
 * RAG Write Tools for agent-native output
 * Allows experts to store findings and visualizations directly in the knowledge base
 * Uses callable functions for direct invocation from experts
 */
export interface AuditRagWriteTools {
  /** Store a single finding in the knowledge base */
  storeFinding: (input: FindingInput) => Promise<{ success: boolean; message: string }>;
  /** Store a visualization (JsonRenderTree) for UI display */
  storeVisualization: (
    input: VisualizationInput
  ) => Promise<{ success: boolean; message: string; sectionId?: string }>;
  /** Batch store multiple findings at once */
  storeFindingsBatch: (
    findings: FindingInput[]
  ) => Promise<{ success: boolean; message: string; storedCount: number }>;
  /** The AI SDK tools for LLM use (optional) */
  aiTools?: {
    storeFinding: ReturnType<typeof createRagWriteTool>;
    storeVisualization: ReturnType<typeof createVisualizationWriteTool>;
    storeFindingsBatch: ReturnType<typeof createBatchRagWriteTool>;
  };
}

export interface AuditAgentInput {
  leadId: string;
  websiteUrl: string;
  /** Optional RAG Write Tools for agent-native output */
  ragTools?: AuditRagWriteTools;
}

export interface AuditSection {
  slug: string;
  title: string;
  content: unknown;
  visualization?: unknown; // json-render tree
}

export interface AuditAgentOutput {
  success: boolean;
  category: string; // 'website-analyse', 'technologie', etc.
  sections: AuditSection[];
  navigation: {
    title: string;
    items: { slug: string; title: string }[];
  };
  confidence: number;
  error?: string;
  analyzedAt: string;
}

export const AuditSectionSchema = z.object({
  slug: z.string(),
  title: z.string(),
  content: z.unknown(),
  visualization: z.unknown().optional(),
});

export const AuditNavigationItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
});

export type AuditCategory =
  | 'uebersicht'
  | 'technologie'
  | 'website-analyse'
  | 'architektur'
  | 'cms-vergleich'
  | 'hosting'
  | 'integrationen'
  | 'migration'
  | 'projekt'
  | 'kosten'
  | 'empfehlung';

export const CATEGORY_CONFIG: Record<AuditCategory, { label: string; order: number }> = {
  uebersicht: { label: 'Übersicht', order: 1 },
  technologie: { label: 'Aktuelle Technologie', order: 2 },
  'website-analyse': { label: 'Website-Analyse', order: 3 },
  architektur: { label: 'Drupal-Architektur', order: 4 },
  'cms-vergleich': { label: 'CMS-Vergleich', order: 5 },
  hosting: { label: 'Hosting & Infrastruktur', order: 6 },
  integrationen: { label: 'Integrationen', order: 7 },
  migration: { label: 'Migration & Projekt', order: 8 },
  projekt: { label: 'Projekt-Organisation', order: 9 },
  kosten: { label: 'Kosten & Budget', order: 10 },
  empfehlung: { label: 'Empfehlung', order: 11 },
};
