/**
 * Agent-native CMS requirements extraction.
 *
 * Instead of hardcoded if/else mapping, an AI agent:
 *   1. Reads extracted document requirements
 *   2. Searches the feature library for matching features
 *   3. Decides which requirements are CMS-relevant (with category + priority)
 *   4. Creates new features in the library when it encounters novel requirements
 *
 * Tools:
 *   - feature.search  — search the feature library by keyword
 *   - feature.create  — add a new feature to the library
 *   - requirement.add — accumulate a CMS requirement for the matrix
 */

import { generateText, stepCountIs, tool } from 'ai';
import { eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import { modelNames } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { features } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

import type { RequirementMatch } from './schema';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CMSRequirement {
  name: string;
  category: RequirementMatch['category'];
  priority: RequirementMatch['priority'];
  source: RequirementMatch['source'];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Uses an AI agent to extract CMS-relevant requirements from document data.
 *
 * The agent has tools to search the feature library, create new features,
 * and add requirements. It decides what's relevant — we don't hardcode logic.
 */
export async function runCMSRequirementsAgent(
  extractedRequirements: ExtractedRequirements
): Promise<CMSRequirement[]> {
  const accumulated: CMSRequirement[] = [];

  // Pre-load feature library so the agent has context
  let featureRows: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    priority: number;
  }> = [];

  try {
    featureRows = await db
      .select({
        id: features.id,
        name: features.name,
        slug: features.slug,
        category: features.category,
        description: features.description,
        priority: features.priority,
      })
      .from(features)
      .where(eq(features.isActive, true));
  } catch {
    // features table may not exist (migration not applied) — graceful degradation
    console.warn(
      '[CMS Requirements Agent] Feature-Tabelle nicht verfügbar, fahre ohne Bibliothek fort.'
    );
  }

  const featureSummary =
    featureRows.length > 0
      ? featureRows.map(f => `- ${f.name} [${f.category}] (Priorität: ${f.priority})`).join('\n')
      : 'Keine Features in der Bibliothek vorhanden.';

  // Prepare a compact view of extracted requirements for the prompt
  const reqSummary: Record<string, unknown> = {};
  if (extractedRequirements.customerName) reqSummary.kunde = extractedRequirements.customerName;
  if (extractedRequirements.industry) reqSummary.branche = extractedRequirements.industry;
  if (extractedRequirements.projectDescription)
    reqSummary.projektbeschreibung = extractedRequirements.projectDescription;
  if (extractedRequirements.scope) reqSummary.scope = extractedRequirements.scope;
  if (extractedRequirements.technologies?.length)
    reqSummary.technologien = extractedRequirements.technologies;
  if (extractedRequirements.keyRequirements?.length)
    reqSummary.anforderungen = extractedRequirements.keyRequirements;
  if (extractedRequirements.requiredServices?.length)
    reqSummary.leistungen = extractedRequirements.requiredServices;
  if (extractedRequirements.constraints?.length)
    reqSummary.einschraenkungen = extractedRequirements.constraints;
  if (extractedRequirements.cmsConstraints)
    reqSummary.cms_vorgaben = extractedRequirements.cmsConstraints;
  if (extractedRequirements.projectGoal) reqSummary.projektziel = extractedRequirements.projectGoal;
  if (extractedRequirements.requiredDeliverables?.length)
    reqSummary.liefergegenstände = extractedRequirements.requiredDeliverables.map(d => d.name);
  if (extractedRequirements.awardCriteria?.criteria?.length)
    reqSummary.zuschlagskriterien = extractedRequirements.awardCriteria.criteria;

  try {
    await generateText({
      model: (await getProviderForSlot('fast'))(modelNames.fast),
      temperature: 0,
      stopWhen: stepCountIs(25),
      system: `Du bist ein CMS-Anforderungsanalyst bei einer Digitalagentur.

Deine Aufgabe: Analysiere die extrahierten Projektanforderungen und identifiziere ALLE CMS-relevanten Funktionen und Anforderungen für eine CMS-Evaluierungsmatrix.

## Verfügbare Feature-Bibliothek

${featureSummary}

## Arbeitsweise

1. Nutze "feature.search" um zu prüfen, ob ein Feature bereits in unserer Bibliothek existiert.
2. Verwende den exakten Feature-Namen aus der Bibliothek, wenn ein Match existiert — das nutzt unseren Evaluierungs-Cache.
3. Wenn ein CMS-relevantes Feature NICHT in der Bibliothek existiert, erstelle es mit "feature.create".
4. Für jede relevante Anforderung rufe "requirement.add" auf.

## Kategorien
- functional: Funktionale Anforderungen (E-Commerce, Mehrsprachigkeit, Suche, Blog, Formulare, DAM, Workflow)
- technical: Technische Anforderungen (API, Headless, SSR, Hosting, Frameworks)
- integration: Integrationsanforderungen (CRM, ERP, Payment, Analytics, Marketing Automation)
- compliance: Compliance/Legal (DSGVO, WCAG, Barrierefreiheit, Datenschutz)
- performance: Performance (Page Speed, Caching, CDN)
- scalability: Skalierbarkeit (Enterprise, Multi-Site, High Availability)
- security: Sicherheit (SSO, 2FA, Rollen/Rechte)
- ux: User Experience (Editor UX, Preview, Drag&Drop)
- maintenance: Wartbarkeit (Update-Prozesse, Monitoring)

## Prioritäten
- must-have: Explizit gefordert oder für den Projekttyp zwingend notwendig
- should-have: Erwähnt oder für den Kontext wichtig
- nice-to-have: Abgeleitet oder optional

## Quellen
- detected: Direkt im Dokument erwähnt
- inferred: Aus dem Projektkontext abgeleitet (z.B. "Relaunch" → Content-Migration)

## Wichtig
- DSGVO-Konformität und Barrierefreiheit (WCAG) sind IMMER must-have.
- Extrahiere ALLE CMS-relevanten Anforderungen — lieber zu viele als zu wenige.
- Wenn eine Technologie (z.B. "Drupal", "React") genannt wird, ist das eine technische Anforderung.
- Bei "Relaunch" oder "Migration" ist Content-Migration immer must-have.
- Leite auch implizite Anforderungen ab (z.B. öffentliche Verwaltung → Barrierefreiheit BITV 2.0).
- Nutze die exakten Feature-Namen aus der Bibliothek für besseres Caching.`,

      prompt: `Analysiere diese Projektanforderungen und extrahiere alle CMS-relevanten Requirements:

${JSON.stringify(reqSummary, null, 2)}`,

      tools: {
        'feature.search': tool({
          description:
            'Suche nach Features in der Feature-Bibliothek. Gibt passende Features mit Name, Kategorie und Priorität zurück.',
          inputSchema: z.object({
            query: z
              .string()
              .describe('Suchbegriff (z.B. "E-Commerce", "Mehrsprachigkeit", "API")'),
          }),
          execute: async ({ query }) => {
            const q = query.toLowerCase();
            const matches = featureRows.filter(
              f =>
                f.name.toLowerCase().includes(q) ||
                f.slug.includes(q) ||
                f.description?.toLowerCase().includes(q) ||
                f.category.toLowerCase().includes(q)
            );
            if (matches.length === 0) {
              return { found: false, message: `Kein Feature für "${query}" gefunden.` };
            }
            return {
              found: true,
              features: matches.map(f => ({
                name: f.name,
                category: f.category,
                priority: f.priority,
                description: f.description,
              })),
            };
          },
        }),

        'feature.create': tool({
          description:
            'Erstelle ein neues Feature in der Bibliothek. Nur verwenden, wenn feature.search kein passendes Feature gefunden hat und das Feature auch für zukünftige Projekte relevant wäre.',
          inputSchema: z.object({
            name: z.string().describe('Feature-Name (z.B. "Digital Asset Management")'),
            category: z.enum([
              'functional',
              'technical',
              'integration',
              'compliance',
              'performance',
              'scalability',
              'security',
              'ux',
              'maintenance',
            ]),
            description: z.string().describe('Kurzbeschreibung des Features'),
            priority: z
              .number()
              .min(0)
              .max(100)
              .describe(
                'Standard-Priorität (0-100). 75+ = must-have, 55+ = should-have, <55 = nice-to-have'
              ),
          }),
          execute: async ({ name, category, description, priority }) => {
            try {
              const slug = slugify(name) || 'feature';

              // Check for existing slug
              const existing = await db
                .select({ slug: features.slug })
                .from(features)
                .where(ilike(features.slug, `${slug}%`));

              const existingSlugs = new Set(existing.map(e => e.slug));
              let finalSlug = slug;
              let counter = 2;
              while (existingSlugs.has(finalSlug)) {
                finalSlug = `${slug}-${counter}`;
                counter++;
              }

              await db.insert(features).values({
                name,
                slug: finalSlug,
                category,
                description,
                priority,
                isActive: true,
              });

              // Add to local cache so subsequent searches find it
              featureRows.push({
                id: finalSlug,
                name,
                slug: finalSlug,
                category,
                description,
                priority,
              });

              return { created: true, name, slug: finalSlug };
            } catch (error) {
              // features table may not exist
              return { created: false, error: 'Feature-Tabelle nicht verfügbar' };
            }
          },
        }),

        'requirement.add': tool({
          description:
            'Füge eine CMS-Anforderung zur Evaluierungsmatrix hinzu. Verwende den exakten Feature-Namen aus der Bibliothek, wenn vorhanden.',
          inputSchema: z.object({
            name: z
              .string()
              .describe('Anforderungsname (z.B. "Mehrsprachigkeit", "DSGVO-Konformität")'),
            category: z.enum([
              'functional',
              'technical',
              'integration',
              'compliance',
              'performance',
              'scalability',
              'security',
              'ux',
              'maintenance',
              'other',
            ]),
            priority: z.enum(['must-have', 'should-have', 'nice-to-have']),
            source: z.enum(['detected', 'inferred']),
          }),
          execute: async ({ name, category, priority, source }) => {
            accumulated.push({ name, category, priority, source });
            return { added: true, total: accumulated.length };
          },
        }),
      },
    });
  } catch (error) {
    console.error('[CMS Requirements Agent] Fehler:', error);
    // Graceful degradation: return at least compliance basics
    if (accumulated.length === 0) {
      accumulated.push(
        {
          name: 'DSGVO-Konformität',
          category: 'compliance',
          priority: 'must-have',
          source: 'inferred',
        },
        {
          name: 'Barrierefreiheit (WCAG)',
          category: 'compliance',
          priority: 'must-have',
          source: 'inferred',
        }
      );
    }
  }

  // Always ensure compliance basics are present
  const names = new Set(accumulated.map(r => r.name.toLowerCase()));
  if (!names.has('dsgvo-konformität')) {
    accumulated.push({
      name: 'DSGVO-Konformität',
      category: 'compliance',
      priority: 'must-have',
      source: 'inferred',
    });
  }
  if (!names.has('barrierefreiheit (wcag)')) {
    accumulated.push({
      name: 'Barrierefreiheit (WCAG)',
      category: 'compliance',
      priority: 'must-have',
      source: 'inferred',
    });
  }

  // Deduplicate
  const seen = new Set<string>();
  return accumulated.filter(req => {
    const key = req.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
