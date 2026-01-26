import { eq, and, like, sql } from 'drizzle-orm';

import { CATEGORY_CONFIG, type AuditCategory } from './types';

import { db } from '@/lib/db';
import { dealEmbeddings, qualificationSectionData } from '@/lib/db/schema';

interface NavigationItem {
  slug: string;
  title: string;
}

interface NavigationSection {
  category: string;
  title: string;
  items: NavigationItem[];
}

/**
 * Build audit navigation from stored RAG data
 * Queries dealEmbeddings for audit_* agents and builds navigation structure
 */
export async function getAuditNavigation(leadId: string): Promise<NavigationSection[]> {
  const cachedSections = await db
    .select({
      sectionId: qualificationSectionData.sectionId,
      content: qualificationSectionData.content,
    })
    .from(qualificationSectionData)
    .where(
      and(
        eq(qualificationSectionData.qualificationId, leadId),
        like(qualificationSectionData.sectionId, 'audit:%:%')
      )
    );

  if (cachedSections.length > 0) {
    const navigationMap = new Map<string, NavigationSection>();

    for (const row of cachedSections) {
      if (!row.content) continue;

      try {
        const parsed = JSON.parse(row.content) as {
          category?: string;
          slug?: string;
          title?: string;
        };
        if (!parsed.category || !parsed.slug || !parsed.title) {
          continue;
        }

        const category = parsed.category as AuditCategory;
        const config = CATEGORY_CONFIG[category];
        if (!config) continue;

        if (!navigationMap.has(category)) {
          navigationMap.set(category, {
            category,
            title: config.label,
            items: [],
          });
        }

        const section = navigationMap.get(category)!;
        if (!section.items.find(item => item.slug === parsed.slug)) {
          section.items.push({ slug: parsed.slug, title: parsed.title });
        }
      } catch {
        // Ignore parse errors
      }
    }

    return Array.from(navigationMap.values()).sort(
      (a, b) =>
        (CATEGORY_CONFIG[a.category as AuditCategory]?.order || 999) -
        (CATEGORY_CONFIG[b.category as AuditCategory]?.order || 999)
    );
  }

  // Query all audit agent outputs
  const chunks = await db
    .select({
      agentName: dealEmbeddings.agentName,
      chunkType: dealEmbeddings.chunkType,
      metadata: dealEmbeddings.metadata,
    })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.qualificationId, leadId),
        sql`${dealEmbeddings.agentName} LIKE 'audit_%'`
      )
    );

  if (chunks.length === 0) {
    return [];
  }

  // Group by agent and extract navigation
  const navigationMap = new Map<string, NavigationSection>();

  for (const chunk of chunks) {
    if (chunk.chunkType !== 'audit_section_json' || !chunk.metadata) {
      continue;
    }

    const meta = JSON.parse(chunk.metadata) as { category?: string; slug?: string; title?: string };
    if (!meta.category || !meta.slug || !meta.title) {
      continue;
    }

    // Parse agent name to category
    const category = (meta.category as AuditCategory) || extractCategory(chunk.agentName);
    if (!category) continue;

    const config = CATEGORY_CONFIG[category];
    if (!config) continue;

    // Get or create section
    if (!navigationMap.has(category)) {
      navigationMap.set(category, {
        category,
        title: config.label,
        items: [],
      });
    }

    const section = navigationMap.get(category)!;

    // Avoid duplicates
    if (!section.items.find(item => item.slug === meta.slug)) {
      section.items.push({
        slug: meta.slug,
        title: meta.title,
      });
    }
  }

  // Sort by category order
  const sections = Array.from(navigationMap.values()).sort(
    (a, b) =>
      (CATEGORY_CONFIG[a.category as AuditCategory]?.order || 999) -
      (CATEGORY_CONFIG[b.category as AuditCategory]?.order || 999)
  );

  return sections;
}

/**
 * Extract category from agent name
 * audit_website_expert -> website-analyse
 * audit_tech_expert -> technologie
 */
function extractCategory(agentName: string): AuditCategory | null {
  if (agentName === 'audit_summary') return 'uebersicht';
  if (agentName.includes('website')) return 'website-analyse';
  if (agentName.includes('tech')) return 'technologie';
  if (agentName.includes('architecture')) return 'architektur';
  if (agentName.includes('migration')) return 'migration';
  if (agentName.includes('hosting') || agentName.includes('infrastructure')) return 'hosting';
  if (agentName.includes('integration')) return 'integrationen';
  if (agentName.includes('project')) return 'projekt';
  if (agentName.includes('cost')) return 'kosten';
  if (agentName.includes('decision')) return 'empfehlung';
  return null;
}

/**
 * Format chunk type to readable title
 * audit_output_json -> Output JSON
 * audit_section_text -> Section Text
 */
// formatTitle removed; metadata title is authoritative for audit sections.
