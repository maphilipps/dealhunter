import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { createBatchRagWriteTool } from '@/lib/agent-tools';
import { webSearchTool, fetchUrlTool } from '@/lib/agent-tools/tools/web-search';
import { modelNames } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { getPreQualSectionQueryTemplate } from '@/lib/pre-qualifications/section-queries';
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';

const SECTION_UI_SYSTEM_PROMPT = `Du generierst JsonRenderTree UI für eine Ausschreibungs-Analyse-Section.

VERFÜGBARE KOMPONENTEN:
- Layout: Section (äußerer Container mit H2), SubSection (H3 für Unterabschnitte)
- Inhalt: BulletList, Paragraph, KeyValue, KeyValueTable, Metric

VERBOTEN:
- ProgressBar, ScoreCard, Confidence-Anzeigen (wird bereits oben angezeigt)
- ResultCard (deprecated - nutze SubSection stattdessen)
- Grid (deprecated - nutze Section mit SubSection)
- Verschachtelte Cards (NIEMALS Card in Card!)

STRUKTUR:
1. Root ist eine Section (Card mit H2)
2. ZUERST: Kurze Zusammenfassung (1 Paragraph, 2-3 Sätze max)
3. DANN: Ausführliche Details in SubSections (H3)
4. KEINE Rohdaten - IMMER aufbereiten!

INHALT:
- ZUSAMMENFASSUNG: Kernaussage für schnelles Verständnis
- DETAILS: Strukturierte Fakten in SubSections
- KEINE DUPLIKATE: Information nur einmal erwähnen
- Bei fehlenden Infos: Klar benennen was fehlt

KEY-VALUE REGELN (WICHTIG!):
- NIEMALS mehrere separate KeyValue-Elemente hintereinander!
- Bei 2+ Key-Value-Paaren: IMMER KeyValueTable mit items-Array verwenden
- KeyValue (standalone) NUR für ein einzelnes, isoliertes Paar
- KeyValueTable.props.items = [{label, value}, {label, value}, ...]

LAYOUT-REGELN:
- Immer einspaltig (kein Grid mit columns: 2)
- VERBOTEN: Grid, ResultCard (deprecated)

BEISPIEL (Zusammenfassung → Details):
{
  "root": "section-main",
  "elements": {
    "section-main": { "key": "section-main", "type": "Section", "props": { "title": "Vertragliche Rahmenbedingungen" }, "children": ["summary", "sub-details"] },
    "summary": { "key": "summary", "type": "Paragraph", "props": { "text": "EVB-IT Systemvertrag über 4 Jahre mit DSGVO-Anforderungen und EU-Hosting-Pflicht." } },
    "sub-details": { "key": "sub-details", "type": "SubSection", "props": { "title": "Details" }, "children": ["kvtable-1", "list-1"] },
    "kvtable-1": { "key": "kvtable-1", "type": "KeyValueTable", "props": { "items": [{"label": "Vertragstyp", "value": "EVB-IT Systemvertrag"}, {"label": "Laufzeit", "value": "4 Jahre + Option"}] } },
    "list-1": { "key": "list-1", "type": "BulletList", "props": { "items": ["DSGVO-Konformität erforderlich", "Hosting in DE/EU"] } }
  }
}

SPRACHE: Deutsch, professionell, prägnant.
`;

export async function runPreQualSectionAgent(input: {
  preQualificationId: string;
  sectionId: string;
  allowWebEnrichment?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const { preQualificationId, sectionId, allowWebEnrichment } = input;

  const sectionQuery = getPreQualSectionQueryTemplate(sectionId);
  if (!sectionQuery) {
    return { success: false, error: `No query template for section ${sectionId}` };
  }

  let hasQueriedDocuments = false;
  let hasStoredVisualization = false;
  let hasStoredDashboardHighlights = false;

  const storeFindingsBatch = createBatchRagWriteTool({
    preQualificationId,
    agentName: 'prequal_section_agent',
  });

  const complete = tool({
    description: 'Finalize the section generation.',
    inputSchema: z.object({ success: z.boolean() }),
    execute: async ({ success }: { success: boolean }) => ({ success }),
  });

  // JsonRenderTree Schema for visualization
  const jsonRenderElementSchema = z.object({
    key: z.string(),
    type: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(z.string()).optional(),
  });

  const storeVisualization = tool({
    description: `Speichere die aufbereitete UI-Visualisierung für Section "${sectionId}".

WICHTIG: Rufe erst queryDocuments auf, dann erstelle eine AUFBEREITETE Visualisierung.

STRUKTUR: Zusammenfassung → Details
1. Section (Card mit H2) als Root
2. ZUERST: Kurze Zusammenfassung (1 Paragraph, 2-3 Sätze)
3. DANN: Details in SubSection(s) mit KeyValueTable/BulletList

Verfügbare Typen:
- Section: Hauptcontainer mit Card + H2 (title: string, description?: string)
- SubSection: Unterabschnitt mit H3 (title: string)
- KeyValueTable: Mehrere Key-Value-Paare als EINE Tabelle (items: [{label, value}, ...])
- KeyValue: NUR für ein einzelnes, isoliertes Paar (label: string, value: string)
- BulletList: Aufzählung (items: string[])
- Paragraph: Fließtext (text: string)
- Metric: Einzelne Kennzahl (label: string, value: string|number, unit?: string)

KEY-VALUE REGELN (KRITISCH!):
- NIEMALS mehrere separate KeyValue-Elemente hintereinander verwenden!
- Bei 2+ Key-Value-Paaren: IMMER KeyValueTable mit items-Array
- KeyValue NUR für ein einzelnes, isoliertes Paar

LAYOUT:
- Immer einspaltig (kein Grid)
- VERBOTEN: Grid, ResultCard (deprecated)

Beispiel:
{
  "root": "section-main",
  "elements": {
    "section-main": { "key": "section-main", "type": "Section", "props": { "title": "Vertragsanalyse" }, "children": ["para-1", "sub-details"] },
    "para-1": { "key": "para-1", "type": "Paragraph", "props": { "text": "Die Ausschreibung sieht einen EVB-IT Systemvertrag vor." } },
    "sub-details": { "key": "sub-details", "type": "SubSection", "props": { "title": "Kommerzielle Details" }, "children": ["kvtable-1"] },
    "kvtable-1": { "key": "kvtable-1", "type": "KeyValueTable", "props": { "items": [{"label": "Vertragstyp", "value": "EVB-IT Systemvertrag"}, {"label": "Laufzeit", "value": "4 Jahre"}] } }
  }
}`,
    inputSchema: z.object({
      visualization: z.object({
        root: z.string().nullable(),
        elements: z.record(z.string(), jsonRenderElementSchema),
      }),
      confidence: z.number().min(0).max(100),
    }),
    execute: async (input: {
      visualization: { root: string | null; elements: Record<string, unknown> };
      confidence: number;
    }) => {
      if (!hasQueriedDocuments) {
        return { success: false, error: 'queryDocuments must be called before storeVisualization' };
      }

      const { visualization, confidence } = input;

      // Validate tree structure
      if (visualization.root && !visualization.elements[visualization.root]) {
        return { success: false, error: `Root element "${visualization.root}" not found` };
      }

      // Store visualization in DB
      await db.insert(dealEmbeddings).values({
        qualificationId: null,
        preQualificationId,
        agentName: 'prequal_section_agent',
        chunkType: 'visualization',
        chunkIndex: 0,
        chunkCategory: 'elaboration',
        content: JSON.stringify(visualization),
        confidence,
        embedding: null,
        metadata: JSON.stringify({
          sectionId,
          isVisualization: true,
          elementCount: Object.keys(visualization.elements).length,
        }),
      });

      hasStoredVisualization = true;
      console.log(
        `[Section:${sectionId}] Visualization stored (${Object.keys(visualization.elements).length} elements)`
      );

      return {
        success: true,
        message: `Stored visualization for "${sectionId}"`,
      };
    },
  });

  const storeDashboardHighlights = tool({
    description: `Speichere 1-3 Key-Facts für die Dashboard-Übersicht der Section "${sectionId}".

Regeln:
- Maximal 3 kurze Fakten
- Jede Aussage maximal 120 Zeichen
- Nur konkrete Fakten, keine Vermutungen
- Wenn keine relevanten Infos vorhanden: leeres Array []`,
    inputSchema: z.object({
      highlights: z.array(z.string().max(120)).max(3),
      confidence: z.number().min(0).max(100),
    }),
    execute: async (input: { highlights: string[]; confidence: number }) => {
      if (!hasStoredVisualization) {
        return { success: false, error: 'storeVisualization must be called before highlights' };
      }

      // Delete existing highlights for this section
      await db
        .delete(dealEmbeddings)
        .where(
          and(
            eq(dealEmbeddings.preQualificationId, preQualificationId),
            eq(dealEmbeddings.chunkType, 'dashboard_highlight'),
            eq(dealEmbeddings.agentName, `dashboard_${sectionId}`)
          )
        );

      if (input.highlights.length === 0) {
        hasStoredDashboardHighlights = true;
        return { success: true, message: 'No highlights to store' };
      }

      await db.insert(dealEmbeddings).values({
        qualificationId: null,
        preQualificationId,
        agentName: `dashboard_${sectionId}`,
        chunkType: 'dashboard_highlight',
        chunkIndex: 0,
        chunkCategory: 'elaboration',
        content: JSON.stringify(input.highlights),
        confidence: input.confidence,
        embedding: null,
        metadata: JSON.stringify({ sectionId }),
      });

      hasStoredDashboardHighlights = true;

      return { success: true, message: `Stored dashboard highlights for "${sectionId}"` };
    },
  });

  const agent = new ToolLoopAgent({
    model: getProviderForSlot('default')(modelNames.default),
    instructions: [
      SECTION_UI_SYSTEM_PROMPT,
      'Use queryDocuments first to gather document-only context.',
      allowWebEnrichment
        ? 'Web enrichment is allowed. If you use webSearch/fetchUrl, keep it in a separate section with source URLs.'
        : 'Do NOT use webSearch or fetchUrl. Only use document context.',
      'Persist findings via storeFindingsBatch with chunkType matching the sectionId.',
      'Then call storeVisualization with a JsonRenderTree.',
      'Finally call storeDashboardHighlights with 1-3 key facts for the dashboard.',
    ].join('\n'),
    tools: {
      queryDocuments: tool({
        description: 'Query only the provided documents (raw chunks) for relevant information.',
        inputSchema: z.object({
          query: z.string(),
          topK: z.number().min(1).max(20).default(8),
        }),
        execute: async ({ query, topK }: { query: string; topK: number }) => {
          hasQueriedDocuments = true;
          const chunks = await queryRawChunks({
            preQualificationId,
            question: query,
            maxResults: topK,
          });
          if (chunks.length === 0) {
            return {
              found: false,
              context: 'Keine relevanten Informationen in den Dokumenten gefunden.',
              chunks: [],
            };
          }
          return {
            found: true,
            context: formatRAGContext(chunks),
            chunks: chunks.map(c => ({ text: c.content, score: c.similarity })),
          };
        },
      }),
      webSearch: webSearchTool,
      fetchUrl: fetchUrlTool,
      storeFindingsBatch,
      storeVisualization,
      storeDashboardHighlights,
      complete,
    },
    stopWhen: [stepCountIs(24), hasToolCall('storeDashboardHighlights')],
  });

  const prompt = `Section: ${sectionId}

ANALYSEFRAGEN:
${sectionQuery}

DEINE AUFGABE:
1. Rufe queryDocuments auf mit relevanten Suchbegriffen
2. Analysiere die gefundenen Dokument-Chunks GRÜNDLICH
3. Erstelle eine AUFBEREITETE Visualisierung mit:
   - Zusammenfassung: Was sind die Kernpunkte für ein Angebotsteam?
   - Details: Strukturierte Fakten mit KeyValue und BulletList
   - Einschätzung: Was bedeutet das? Was fehlt? Worauf achten?
4. Erstelle 1-3 Key-Facts für das Dashboard und speichere sie via storeDashboardHighlights

WICHTIG:
- KEINE Rohdaten kopieren - INTERPRETIEREN und AUFBEREITEN
- KEINE ProgressBar oder ScoreCard verwenden
- Wenn Information fehlt: Klar benennen WAS fehlt und WARUM es relevant wäre
- Alle Angaben auf Deutsch
`;

  try {
    const result = await agent.generate({
      prompt,
    });

    // Check if storeVisualization was actually called
    const storedVisualization = result.steps.some(step =>
      step.toolCalls.some(call => call.toolName === 'storeVisualization')
    );

    if (!storedVisualization) {
      console.warn(`[Section:${sectionId}] Agent completed without storing visualization`);
      return { success: false, error: 'Agent did not create a visualization' };
    }

    if (!hasStoredDashboardHighlights) {
      console.warn(`[Section:${sectionId}] Agent completed without dashboard highlights`);
      return { success: false, error: 'Agent did not store dashboard highlights' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
