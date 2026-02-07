import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { createBatchRagWriteTool } from '@/lib/agent-tools';
import { webSearchTool, fetchUrlTool } from '@/lib/agent-tools/tools/web-search';
import { generateStructuredOutput, modelNames } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { getPreQualSectionQueryTemplate } from '@/lib/qualifications/section-queries';
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
    description: `Finalize the section generation. Call this AFTER storeVisualization (required) and storeDashboardHighlights (optional).
This is the LAST tool you should call — it signals that your work is done.`,
    inputSchema: z.object({ success: z.boolean() }),
    execute: async ({ success }: { success: boolean }) => {
      if (!hasStoredVisualization) {
        return {
          success: false,
          error: 'You must call storeVisualization before calling complete.',
        };
      }
      return { success };
    },
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
        pitchId: null,
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
        pitchId: null,
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
    model: (await getProviderForSlot('default'))(modelNames.default),
    instructions: [
      SECTION_UI_SYSTEM_PROMPT,
      '',
      'ERWEITERTER WORKFLOW (folge dieser Reihenfolge):',
      '1. BRIEFING LESEN: Lies das Section-Briefing und formuliere 2-4 eigene Suchfragen',
      '2. ERSTE SUCHE: queryDocuments mit breiter Abfrage zum Kernthema der Section (REQUIRED)',
      '3. ANALYSE: Was hast du gefunden? Was fehlt noch?',
      '4. FOLGE-SUCHEN: 1-3 gezielte queryDocuments-Aufrufe basierend auf Lücken',
      '5. SYNTHESE: storeVisualization — erstelle die Visualisierung aus ALLEN gefundenen Informationen (REQUIRED)',
      '6. storeDashboardHighlights — 1-3 Key-Facts für das Dashboard (empfohlen, optional)',
      '7. complete — signalisiere, dass du fertig bist (REQUIRED, muss dein LETZTER Tool-Call sein)',
      '',
      'WICHTIG ZU queryDocuments:',
      '- Rufe queryDocuments MEHRFACH auf (2-4 Mal empfohlen)',
      '- Nutze KONKRETE Begriffe aus Ausschreibungen, NICHT die Briefing-Überschriften als Suchbegriff',
      '- Beispiele guter Queries: "Budget Kostenrahmen Auftragswert EUR", "Abgabefrist Einreichung Teilnahmeantrag", "EVB-IT Vertrag Gewährleistung Haftung"',
      '- Beispiele SCHLECHTER Queries: "Was ist das Budget?", "Wann ist die Deadline?", "Welcher Vertragstyp?"',
      '',
      allowWebEnrichment
        ? 'Web-Anreicherung ist erlaubt. Wenn du webSearch/fetchUrl nutzt, halte es in einer separaten Section mit Quell-URLs.'
        : 'Nutze NICHT webSearch oder fetchUrl. Verwende NUR Dokument-Kontext.',
      'Du kannst storeFindingsBatch verwenden, um Erkenntnisse mit chunkType passend zur sectionId zu speichern.',
    ].join('\n'),
    tools: {
      queryDocuments: tool({
        description: `Suche in den Ausschreibungsdokumenten. Du SOLLST dieses Tool MEHRFACH aufrufen mit unterschiedlichen Suchbegriffen.
Formuliere deine Queries dynamisch — breite Suche zuerst, dann gezielte Nachfragen basierend auf Lücken.
Nutze konkrete Begriffe die in Ausschreibungsdokumenten vorkommen, NICHT abstrakte Überschriften.`,
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'Konkrete Suchbegriffe (z.B. "Budget Kostenrahmen Auftragswert EUR" statt "Was ist das Budget?")'
            ),
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
    stopWhen: [stepCountIs(30), hasToolCall('complete')],
  });

  const prompt = `Section: ${sectionId}

BRIEFING FÜR DIESE SECTION:
${sectionQuery}

DEINE AUFGABE: Formuliere basierend auf diesem Briefing EIGENE Suchbegriffe.
Nutze NICHT die Überschriften als Suchbegriff, sondern konkrete Begriffe die in Ausschreibungsdokumenten vorkommen.

BEISPIELE für gute Queries:
- "Budget Kostenrahmen Auftragswert EUR" (statt "Was ist das Budget?")
- "Abgabefrist Einreichung Teilnahmeantrag Frist" (statt "Wann ist die Deadline?")
- "EVB-IT Vertrag Gewährleistung Haftung" (statt "Welcher Vertragstyp?")
- "Referenzen Nachweise Eignung vergleichbar" (statt "Welche Referenzen?")
- "Zuschlagskriterien Gewichtung Bewertung Punkte" (statt "Wie wird bewertet?")

WORKFLOW:
1. Formuliere 2-4 Suchfragen basierend auf dem Briefing
2. ERSTE SUCHE: Breite Abfrage zum Kernthema mit queryDocuments
3. ANALYSE: Prüfe was du gefunden hast — was fehlt noch?
4. FOLGE-SUCHEN: 1-3 gezielte Nachfragen mit queryDocuments basierend auf Lücken
5. SYNTHESE: Erstelle die Visualisierung aus ALLEN gefundenen Informationen:
   - Zusammenfassung: Was sind die Kernpunkte für ein Angebotsteam?
   - Details: Strukturierte Fakten mit KeyValueTable und BulletList
   - Einschätzung: Was bedeutet das? Was fehlt? Worauf achten?
6. Erstelle 1-3 Key-Facts für das Dashboard via storeDashboardHighlights
7. Rufe complete auf

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

      // Fallback: Generate a minimal visualization in a single structured call.
      // This prevents the whole qualification run from failing a section because the
      // ToolLoopAgent hit the step limit before calling storeVisualization.
      try {
        const chunks = await queryRawChunks({
          preQualificationId,
          question: sectionQuery,
          maxResults: 10,
        });

        const fallback = await generateStructuredOutput({
          model: 'default',
          schema: z.object({
            root: z.string(),
            elements: z.record(z.string(), jsonRenderElementSchema),
            confidence: z.number().min(0).max(100),
          }),
          system: SECTION_UI_SYSTEM_PROMPT,
          prompt: [
            `SectionId: ${sectionId}`,
            '',
            'BRIEFING:',
            sectionQuery,
            '',
            'DOKUMENT-KONTEXT (RAG):',
            chunks.length ? formatRAGContext(chunks) : 'Keine relevanten Informationen gefunden.',
            '',
            'AUFGABE:',
            'Erstelle eine JsonRenderTree Visualisierung (Section -> Paragraph Summary -> 1-2 SubSections).',
            'Wenn Infos fehlen: explizit benennen, was fehlt, statt zu raten.',
          ].join('\n'),
          temperature: 0.2,
          maxTokens: 1200,
          timeout: 30_000,
        });

        if (!fallback.elements[fallback.root]) {
          throw new Error('Fallback visualization invalid: root element missing');
        }

        await db.insert(dealEmbeddings).values({
          pitchId: null,
          preQualificationId,
          agentName: 'prequal_section_agent_fallback',
          chunkType: 'visualization',
          chunkIndex: 0,
          chunkCategory: 'elaboration',
          content: JSON.stringify({ root: fallback.root, elements: fallback.elements }),
          confidence: fallback.confidence,
          embedding: null,
          metadata: JSON.stringify({
            sectionId,
            isVisualization: true,
            elementCount: Object.keys(fallback.elements).length,
            fallback: true,
          }),
        });

        console.warn(
          `[Section:${sectionId}] Fallback visualization stored (${Object.keys(fallback.elements).length} elements)`
        );
        return { success: true };
      } catch (fallbackError) {
        return {
          success: false,
          error:
            fallbackError instanceof Error
              ? `Agent did not create a visualization (fallback failed): ${fallbackError.message}`
              : 'Agent did not create a visualization (fallback failed)',
        };
      }
    }

    if (!hasStoredDashboardHighlights) {
      console.warn(
        `[Section:${sectionId}] Agent completed without dashboard highlights — skipping (non-critical)`
      );
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
