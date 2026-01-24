import { generateStructuredOutput } from '@/lib/ai/config';
import { z } from 'zod';
import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Helper: AI sometimes returns objects like { enabled: true } instead of plain boolean
const robustBoolean = z.preprocess(val => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'object' && val !== null) {
    // Handle objects like { enabled: true, languages: ['de'] }
    const obj = val as Record<string, unknown>;
    if ('enabled' in obj) return Boolean(obj.enabled);
    if ('active' in obj) return Boolean(obj.active);
    return true; // Object exists = truthy intent
  }
  return Boolean(val);
}, z.boolean().default(false));

// Schema for CMS architecture recommendation (technology-agnostic, with defaults)
const ArchitectureSchema = z.object({
  contentModel: z
    .object({
      contentTypes: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().default(''),
            fields: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.string().default('text'),
                  required: z.boolean().default(false),
                  cardinality: z.enum(['single', 'multiple', 'unlimited']).default('single'),
                })
              )
              .default([]),
            estimatedCount: z.number().optional(),
          })
        )
        .default([]),
      components: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().default(''),
            category: z
              .enum([
                'hero',
                'content',
                'media',
                'cta',
                'listing',
                'form',
                'layout',
                'navigation',
                'other',
              ])
              .default('other'),
            reusable: z.boolean().default(true),
            frequency: z
              .enum(['every_page', 'most_pages', 'some_pages', 'rare'])
              .default('some_pages'),
          })
        )
        .default([]),
      taxonomies: z
        .array(
          z.object({
            name: z.string(),
            purpose: z.string().default(''),
            hierarchical: z.boolean().default(false),
            estimatedTerms: z.number().default(0),
          })
        )
        .default([]),
    })
    .default({ contentTypes: [], components: [], taxonomies: [] }),
  requirements: z
    .object({
      multilingual: robustBoolean,
      multisite: robustBoolean,
      headless: robustBoolean,
      editorialWorkflow: robustBoolean,
      personalization: robustBoolean,
      ecommerce: robustBoolean,
      memberArea: robustBoolean,
    })
    .default({
      multilingual: false,
      multisite: false,
      headless: false,
      editorialWorkflow: false,
      personalization: false,
      ecommerce: false,
      memberArea: false,
    }),
  listings: z
    .array(
      z.object({
        name: z.string(),
        purpose: z.string().default(''),
        contentType: z.string().default(''),
        filters: z.array(z.string()).default([]),
        pagination: z.boolean().default(true),
      })
    )
    .default([]),
  complexity: z
    .object({
      contentTypes: z.number().default(0),
      components: z.number().default(0),
      totalFields: z.number().default(0),
      customDevelopment: z.enum(['none', 'minimal', 'moderate', 'extensive']).default('minimal'),
      score: z.enum(['simple', 'moderate', 'complex', 'enterprise']).default('moderate'),
    })
    .default({
      contentTypes: 0,
      components: 0,
      totalFields: 0,
      customDevelopment: 'minimal',
      score: 'moderate',
    }),
  confidence: z.number().min(0).max(100).default(50),
});

/**
 * Architecture Expert Agent
 *
 * Analyzes website structure and recommends CMS architecture (technology-agnostic).
 */
export async function runArchitectureExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Architecture Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Architecture Expert', message: msg },
    });
  };

  log('Starte Architektur-Analyse...');

  try {
    // Query RAG for structure data
    const pageData = await queryLeadRag(
      input.leadId,
      'page types content structure',
      'scraper',
      20
    );
    const componentData = await queryLeadRag(
      input.leadId,
      'components sections navigation forms',
      'scraper',
      20
    );

    if (pageData.length === 0) {
      return {
        success: false,
        category: 'architektur',
        sections: [],
        navigation: { title: 'CMS-Architektur', items: [] },
        confidence: 0,
        error: 'Keine Strukturdaten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${pageData.length + componentData.length} Struktur-Einträge gefunden`);

    const combinedContext = formatAuditContext([...pageData, ...componentData]);
    const sections: AuditSection[] = [];

    log('Generiere CMS-Architektur-Empfehlung...');

    const architecture = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: ArchitectureSchema,
      system: `Du bist ein CMS-Architekt. Analysiere die Website-Struktur und erstelle eine technologie-agnostische CMS-Architektur-Empfehlung.

CONTENT MODEL:
- Leite aus Seitentypen ab welche Content Types benötigt werden
- Standard: Page, Article, Landing Page
- Spezifisch: Product, Event, Team Member, Reference, FAQ

KOMPONENTEN (wiederverwendbar):
- Identifiziere wiederverwendbare UI-Komponenten
- Kategorien: hero, content, media, cta, listing, form, layout, navigation
- Bewerte Wiederverwendbarkeit und Häufigkeit

TAXONOMIEN:
- Kategorisierung für Content Types
- Tags, Kategorien, Typen
- Hierarchisch vs. flach

ANFORDERUNGEN:
- Mehrsprachigkeit, Multi-Site, Headless API
- Editorial Workflow, Personalisierung
- E-Commerce, Member Area

LISTINGS:
- Übersichtsseiten mit Filterung
- Suchergebnisse, Archive

Komplexität bewerten basierend auf Anzahl Content Types, Komponenten, Custom Development.`,
      prompt: `Erstelle eine CMS-Architektur für diese Website:\n\n${combinedContext}`,
      temperature: 0.3,
    });

    sections.push({
      slug: 'content-types',
      title: `Content Types (${architecture.contentModel.contentTypes.length})`,
      content: architecture.contentModel.contentTypes,
    });

    sections.push({
      slug: 'components',
      title: `Komponenten (${architecture.contentModel.components.length})`,
      content: architecture.contentModel.components,
    });

    sections.push({
      slug: 'taxonomies',
      title: `Taxonomien (${architecture.contentModel.taxonomies.length})`,
      content: architecture.contentModel.taxonomies,
    });

    sections.push({
      slug: 'requirements',
      title: 'Anforderungen',
      content: architecture.requirements,
    });

    sections.push({
      slug: 'listings',
      title: `Listings (${architecture.listings.length})`,
      content: architecture.listings,
    });

    log(
      `Architektur: ${architecture.complexity.score} (${architecture.complexity.contentTypes} CTs, ${architecture.complexity.components} Komponenten)`
    );

    const navigation = {
      title: 'CMS-Architektur',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    const output: AuditAgentOutput = {
      success: true,
      category: 'architektur',
      sections,
      navigation,
      confidence: architecture.confidence,
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_architecture_expert', output);

    log('Architektur-Analyse abgeschlossen');

    emit?.({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Architecture Expert',
        result: {
          contentTypes: architecture.contentModel.contentTypes.length,
          components: architecture.contentModel.components.length,
          complexity: architecture.complexity.score,
        },
      },
    });

    return output;
  } catch (error) {
    console.error('[Architecture Expert] Error:', error);
    return {
      success: false,
      category: 'architektur',
      sections: [],
      navigation: { title: 'CMS-Architektur', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
