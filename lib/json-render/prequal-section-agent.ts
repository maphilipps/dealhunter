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
- Layout: Grid, ResultCard, Section
- Inhalt: BulletList, Paragraph, KeyValue, Metric

VERBOTEN: ProgressBar, ScoreCard, Confidence-Anzeigen (wird bereits oben angezeigt)

WICHTIGE REGELN:
1. Root muss ein Grid sein.
2. Nur Grid, ResultCard, Section können children haben.
3. KEINE Rohdaten ausgeben - IMMER aufbereiten und interpretieren!
4. Schreibe ZUSAMMENFASSENDE, GUT LESBARE Texte für Business-Entscheider.
5. Bei fehlenden Infos: Klar benennen was fehlt und warum es relevant wäre.

INHALTLICHE QUALITÄT:
- Fasse Kernpunkte zusammen, nicht einfach kopieren
- Interpretiere die Bedeutung für ein Angebotsteam
- Nutze KeyValue für strukturierte Fakten (z.B. "Budget: 500.000 EUR")
- Nutze BulletList für aufbereitete Listen mit Kontext
- Nutze Paragraph für Zusammenfassungen und Einschätzungen
- Nutze Metric nur für einzelne wichtige Kennzahlen

BEISPIEL für "deliverables":
SCHLECHT: "Los 1: CMS, Los 2: Design" (zu knapp)
GUT: ResultCard mit Titel "Leistungsumfang" + Paragraph mit Zusammenfassung + BulletList mit Details pro Los

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
KEINE Rohdaten, KEINE Confidence-Anzeigen, KEINE ProgressBars.

Verfügbare Typen:
- Grid: Layout-Container (columns: 1|2)
- ResultCard: Karte mit Titel (title: string)
- Section: Unterbereich mit Titel (title: string)
- BulletList: Aufzählung (items: string[])
- Paragraph: Fließtext (text: string)
- KeyValue: Schlüssel-Wert (label: string, value: string)
- Metric: Einzelne Kennzahl (label: string, value: string|number, unit?: string)

Beispiel für gute Visualisierung:
{
  "root": "grid-1",
  "elements": {
    "grid-1": { "key": "grid-1", "type": "Grid", "props": { "columns": 1 }, "children": ["card-summary", "card-details"] },
    "card-summary": { "key": "card-summary", "type": "ResultCard", "props": { "title": "Zusammenfassung" }, "children": ["para-1"] },
    "para-1": { "key": "para-1", "type": "Paragraph", "props": { "text": "Die Ausschreibung fordert ein CMS mit hohen Barrierefreiheitsanforderungen. Besonders relevant: BITV 2.0 Konformität wird explizit verlangt." } },
    "card-details": { "key": "card-details", "type": "ResultCard", "props": { "title": "Details" }, "children": ["kv-1", "list-1"] },
    "kv-1": { "key": "kv-1", "type": "KeyValue", "props": { "label": "Projektumfang", "value": "Ca. 500 Seiten Content-Migration" } },
    "list-1": { "key": "list-1", "type": "BulletList", "props": { "items": ["Frontend: React-basiert, responsive", "Backend: Headless CMS gefordert", "Schnittstellen: REST API zu SAP"] } }
  }
}`,
    inputSchema: z.object({
      visualization: z.object({
        root: z.string().nullable(),
        elements: z.record(z.string(), jsonRenderElementSchema),
      }),
      confidence: z.number().min(0).max(100),
    }),
    execute: async (input: { visualization: { root: string | null; elements: Record<string, unknown> }; confidence: number }) => {
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

      console.log(`[Section:${sectionId}] Visualization stored (${Object.keys(visualization.elements).length} elements)`);

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
    const storedVisualization = result.steps.some(
      step => step.toolCalls.some(call => call.toolName === 'storeVisualization')
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
