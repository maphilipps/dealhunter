import { z } from 'zod';

export interface AuditAgentInput {
  leadId: string;
  websiteUrl: string;
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
