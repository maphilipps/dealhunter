import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
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
1. Root ist eine Section (wird als Card mit H2 gerendert)
2. Unterabschnitte mit SubSection (H3)
3. Mehrere KeyValue-Paare in KeyValueTable gruppieren
4. KEINE Rohdaten ausgeben - IMMER aufbereiten und interpretieren!

INHALTLICHE QUALITÄT:
- Fasse Kernpunkte zusammen, nicht einfach kopieren
- Interpretiere die Bedeutung für ein Angebotsteam
- KeyValueTable NUR bei 2+ KeyValue-Paaren (einzelnes KeyValue direkt ohne Table)
- Nutze BulletList für aufbereitete Listen mit Kontext
- Nutze Paragraph für Zusammenfassungen und Einschätzungen
- Bei fehlenden Infos: Klar benennen was fehlt und warum es relevant wäre

WICHTIG:
- Immer einspaltig (kein Grid mit columns: 2)
- KeyValueTable hat items-Prop (KEINE children!) - nur bei 2+ Paaren
- Einzelnes KeyValue direkt verwenden (nicht in KeyValueTable)
- VERBOTEN: Grid, ResultCard (deprecated)

BEISPIEL:
{
  "root": "section-main",
  "elements": {
    "section-main": { "key": "section-main", "type": "Section", "props": { "title": "Vertragliche Rahmenbedingungen" }, "children": ["para-summary", "sub-commercial", "sub-legal"] },
    "para-summary": { "key": "para-summary", "type": "Paragraph", "props": { "text": "Die Ausschreibung sieht einen EVB-IT Systemvertrag vor..." } },
    "sub-commercial": { "key": "sub-commercial", "type": "SubSection", "props": { "title": "Kommerzielles Modell" }, "children": ["kvtable-1"] },
    "kvtable-1": { "key": "kvtable-1", "type": "KeyValueTable", "props": { "items": [{"label": "Vertragstyp", "value": "EVB-IT Systemvertrag"}, {"label": "Laufzeit", "value": "4 Jahre + Option"}] } },
    "sub-legal": { "key": "sub-legal", "type": "SubSection", "props": { "title": "Rechtliche Anforderungen" }, "children": ["list-1"] },
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
KEINE Rohdaten, KEINE Confidence-Anzeigen, KEINE ProgressBars, KEINE verschachtelten Cards.

Verfügbare Typen:
- Section: Hauptcontainer mit Card + H2 (title: string, description?: string)
- SubSection: Unterabschnitt mit H3 (title: string)
- KeyValueTable: Mehrere Key-Value-Paare (items: [{label, value}, ...]) - NUR bei 2+ Paaren!
- KeyValue: Einzelnes Key-Value-Paar (label: string, value: string) - für standalone
- BulletList: Aufzählung (items: string[])
- Paragraph: Fließtext (text: string)
- Metric: Einzelne Kennzahl (label: string, value: string|number, unit?: string)

WICHTIG:
- Immer einspaltig (kein Grid mit columns: 2)
- KeyValueTable hat items-Prop (KEINE children!) - nur bei 2+ Paaren
- Einzelnes KeyValue direkt verwenden (nicht in KeyValueTable)
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

      console.log(
        `[Section:${sectionId}] Visualization stored (${Object.keys(visualization.elements).length} elements)`
      );

      return {
        success: true,
        message: `Stored visualization for "${sectionId}"`,
      };
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
      'Finally call storeVisualization with a JsonRenderTree.',
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
      complete,
    },
    stopWhen: [stepCountIs(20), hasToolCall('storeVisualization')],
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

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
