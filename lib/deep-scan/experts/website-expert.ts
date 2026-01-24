import { z } from 'zod';

import { queryLeadRag, storeAuditAgentOutput, formatAuditContext } from './base';
import type { AuditAgentInput, AuditAgentOutput, AuditSection } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Schema for page type analysis (with defaults for robustness)
const PageTypeSchema = z.object({
  types: z
    .array(
      z.object({
        name: z.string(),
        count: z.number().default(0),
        examples: z.array(z.string()).max(3).default([]),
        description: z.string().default(''),
      })
    )
    .default([]),
  totalPages: z.number().default(0),
  confidence: z.number().min(0).max(100).default(50),
});

// Schema for component analysis (with defaults for robustness)
const ComponentSchema = z.object({
  components: z
    .array(
      z.object({
        name: z.string(),
        category: z
          .enum(['layout', 'navigation', 'content', 'media', 'form', 'interactive', 'other'])
          .default('other'),
        frequency: z.enum(['every_page', 'most_pages', 'some_pages', 'rare']).default('some_pages'),
        description: z.string().default(''),
      })
    )
    .default([]),
  confidence: z.number().min(0).max(100).default(50),
});

export async function runWebsiteExpert(
  input: AuditAgentInput,
  emit?: EventEmitter
): Promise<AuditAgentOutput> {
  const log = (msg: string) => {
    console.error(`[Website Expert] ${msg}`);
    emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: { agent: 'Website Expert', message: msg },
    });
  };

  log('Starte Website-Analyse...');

  try {
    // Query RAG for scraped page data
    const pageData = await queryLeadRag(input.leadId, 'page content structure', 'scraper', 20);
    const structureData = await queryLeadRag(
      input.leadId,
      'page structure headings navigation',
      'scraper',
      20
    );

    if (pageData.length === 0) {
      return {
        success: false,
        category: 'website-analyse',
        sections: [],
        navigation: { title: 'Website-Analyse', items: [] },
        confidence: 0,
        error: 'Keine gescrapten Daten gefunden',
        analyzedAt: new Date().toISOString(),
      };
    }

    log(`${pageData.length} Seiten im RAG gefunden`);

    const sections: AuditSection[] = [];

    // ═══════════════════════════════════════════════════════════════
    // ANALYZE PAGE TYPES
    // ═══════════════════════════════════════════════════════════════
    log('Analysiere Seitentypen...');

    const pageTypeAnalysis = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: PageTypeSchema,
      system: `Du bist ein Website-Analyse-Experte. Analysiere die gescrapten Seiten und kategorisiere sie nach Seitentypen.
      
Typische Seitentypen:
- Homepage: Startseite mit Hero, Teaser, Navigation
- Produkt/Service: Detailseiten für Angebote
- Kategorie/Listing: Übersichtsseiten mit mehreren Items
- Blog/News: Artikel, Neuigkeiten
- Kontakt: Kontaktformular, Adressen
- Über uns/Team: Unternehmensinfo
- FAQ: Häufige Fragen
- Legal: Impressum, Datenschutz

Gruppiere ähnliche Seiten und zähle sie.`,
      prompt: `Analysiere diese ${pageData.length} gescrapten Seiten und identifiziere die Seitentypen:\n\n${formatAuditContext(pageData)}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'seitentypen',
      title: `Seitentypen (${pageTypeAnalysis.types.length})`,
      content: pageTypeAnalysis,
    });

    log(`${pageTypeAnalysis.types.length} Seitentypen identifiziert`);

    // ═══════════════════════════════════════════════════════════════
    // ANALYZE COMPONENTS
    // ═══════════════════════════════════════════════════════════════
    log('Analysiere Komponenten...');

    const componentAnalysis = await generateStructuredOutput({
      model: 'sonnet-4-5',
      schema: ComponentSchema,
      system: `Du bist ein UI/UX-Experte. Analysiere die Seitenstruktur und identifiziere wiederkehrende Komponenten.

Typische Komponenten:
- Layout: Header, Footer, Sidebar, Grid
- Navigation: Hauptmenü, Breadcrumb, Pagination
- Content: Hero, Teaser, Card, Accordion, Tabs
- Media: Bild-Galerie, Video-Player, Slider/Carousel
- Form: Kontaktformular, Newsletter, Suche
- Interactive: Modal, Dropdown, Tooltip

Bewerte wie häufig jede Komponente vorkommt.`,
      prompt: `Analysiere die Seitenstruktur und identifiziere Komponenten:\n\n${formatAuditContext(structureData)}`,
      temperature: 0.2,
    });

    sections.push({
      slug: 'components',
      title: `Components (${componentAnalysis.components.length})`,
      content: componentAnalysis,
    });

    log(`${componentAnalysis.components.length} Komponenten identifiziert`);

    // ═══════════════════════════════════════════════════════════════
    // BUILD NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    const navigation = {
      title: 'Website-Analyse',
      items: sections.map(s => ({ slug: s.slug, title: s.title })),
    };

    // ═══════════════════════════════════════════════════════════════
    // STORE IN RAG
    // ═══════════════════════════════════════════════════════════════
    const output: AuditAgentOutput = {
      success: true,
      category: 'website-analyse',
      sections,
      navigation,
      confidence: Math.round((pageTypeAnalysis.confidence + componentAnalysis.confidence) / 2),
      analyzedAt: new Date().toISOString(),
    };

    await storeAuditAgentOutput(input.leadId, 'audit_website_expert', output);

    log('Website-Analyse abgeschlossen');

    return output;
  } catch (error) {
    console.error('[Website Expert] Error:', error);
    return {
      success: false,
      category: 'website-analyse',
      sections: [],
      navigation: { title: 'Website-Analyse', items: [] },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date().toISOString(),
    };
  }
}
