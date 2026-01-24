import { eq, and, sql } from 'drizzle-orm';

import { CATEGORY_CONFIG, type AuditCategory } from './types';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

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
  // Query all audit agent outputs
  const chunks = await db
    .select({
      agentName: dealEmbeddings.agentName,
      chunkType: dealEmbeddings.chunkType,
      content: dealEmbeddings.content,
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
    // Parse agent name to category
    const category = extractCategory(chunk.agentName);
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

    // Add item if it's a section output
    if (chunk.chunkType.includes('section') || chunk.chunkType.includes('output')) {
      const slug = chunk.chunkType.replace(/_/g, '-');

      // Avoid duplicates
      if (!section.items.find(item => item.slug === slug)) {
        section.items.push({
          slug,
          title: formatTitle(chunk.chunkType),
        });
      }
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
function formatTitle(chunkType: string): string {
  return chunkType
    .replace(/audit_/g, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
