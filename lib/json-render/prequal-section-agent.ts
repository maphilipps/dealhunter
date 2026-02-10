import { ToolLoopAgent, hasToolCall, stepCountIs, tool } from 'ai';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { createBatchRagWriteTool } from '@/lib/agent-tools';
import { webSearchTool, fetchUrlTool } from '@/lib/agent-tools/tools/web-search';
import { generateStructuredOutput, modelNames } from '@/lib/ai/config';
import { getProviderForSlot } from '@/lib/ai/providers';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { excerptText } from '@/lib/qualifications/sources';
import { getPreQualSectionQueryTemplate } from '@/lib/qualifications/section-queries';
import { runDeliveryScopeSection } from '@/lib/qualifications/sections/delivery-scope-section';
import { runSubmissionSection } from '@/lib/qualifications/sections/submission-section';
import { runReferencesSection } from '@/lib/qualifications/sections/references-section';
import { formatSourceCitation } from '@/lib/rag/citations';
import { queryRawChunks, formatRAGContext } from '@/lib/rag/raw-retrieval-service';
import {
  buildSourcesFromRawChunks,
  injectSourcesPanel,
  looksLikeMarkdownTable,
  parseMarkdownTable,
  type SourcePanelItem,
  validatePropsForElementType,
} from '@/lib/json-render/prequal-visualization-utils';

const SECTION_UI_SYSTEM_PROMPT = `Du generierst JsonRenderTree UI für eine Ausschreibungs-Analyse-Section.

VERFÜGBARE KOMPONENTEN:
- Layout: Section (äußerer Container mit H2), SubSection (H3 für Unterabschnitte)
- Inhalt: Paragraph, BulletList, KeyValue, KeyValueTable, DataTable
- Exzerpte: CitedExcerpts (Auszug + optional Quelle)
- Visuals (optional, nur wenn passend): BarChart (Vergleich/Anteile), AreaChart (Verlauf über Zeit)
- Quellen: SourcesPanel wird automatisch ergänzt (du musst keine Quellenliste bauen)

VERBOTEN:
- ProgressBar, ScoreCard, Confidence-Anzeigen (wird bereits oben angezeigt)
- ResultCard (deprecated - nutze SubSection stattdessen)
- Grid (deprecated - nutze Section mit SubSection)
- Verschachtelte Cards (NIEMALS Card in Card!)

KEIN MARKDOWN:
- Keine "###" Überschriften, keine "---" Trenner, keine Markdown-Tabellen (z.B. "| :--- |").
- Wenn Daten tabellarisch wirken: nutze DataTable (columns/rows) statt Markdown.

STRUKTUR:
1. Root ist eine Section (Card mit H2)
2. ZUERST: Zusammenfassung (1 Paragraph, 4-8 Sätze, klar + entscheidungsrelevant)
3. DANN: Ausführliche Details in 3-6 SubSections (H3)
4. KEINE Rohdaten - IMMER aufbereiten!

INHALT:
- ZUSAMMENFASSUNG: Kernaussage für schnelles Verständnis
- DETAILS: Strukturierte Fakten in SubSections, jeweils mit "Was steht drin?" + "Was bedeutet das fürs Angebotsteam?"
- KEINE DUPLIKATE: Information nur einmal erwähnen
- Bei fehlenden Infos: Klar benennen was fehlt

SONDERFÄLLE (KRITISCH):
- Wenn du Regeln/Mechaniken findest, die leicht missverstanden werden (z.B. Anrechnung, Rabatte, Bonus/Malus, Indexierung,
  Erlösmodelle wie "Anzeigenakquise wird auf Jahreskosten angerechnet"), DANN MUSST du das in einer eigenen SubSection erklären.
- Erkläre es so, dass es ohne Kontext verstanden wird:
  1) Kurz paraphrasieren (1-2 Sätze)
  2) Konkretes Rechenbeispiel mit Zahlen (als "Beispiel", wenn Zahlen nicht gegeben sind)
  3) Konsequenz für Angebot/Preisgestaltung (1-3 Bullet Points)
  4) Offene Fragen / Klärungsbedarf, falls Text unklar ist

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

const ALLOWED_PREQUAL_ELEMENT_TYPES = new Set([
  // Layout
  'Section',
  'SubSection',
  // Content
  'BulletList',
  'Paragraph',
  'CitedExcerpts',
  // Tables/Metrics
  'KeyValue',
  'KeyValueTable',
  'Metric',
  'DataTable',
  // Visuals
  'BarChart',
  'AreaChart',
  // Sources
  'SourcesPanel',
]);

function validatePreQualVisualizationTree(visualization: {
  root: string | null;
  elements: Record<string, unknown>;
}): string | null {
  if (!visualization || typeof visualization !== 'object') return 'Visualization is not an object';
  const root = visualization.root;
  if (typeof root !== 'string' || root.trim().length === 0) return 'Missing or empty root';
  const elements = visualization.elements;
  if (!elements || typeof elements !== 'object') return 'Missing elements map';
  if (!elements[root]) return `Root element "${root}" not found`;

  for (const [k, v] of Object.entries(elements)) {
    if (!v || typeof v !== 'object') return `Element "${k}" is not an object`;
    const el = v as Record<string, unknown>;
    if (el.key !== k)
      return `Element key mismatch: map key "${k}" != element.key "${String(el.key)}"`;
    const type = el.type;
    if (typeof type !== 'string' || type.trim().length === 0) return `Element "${k}" missing type`;
    if (!ALLOWED_PREQUAL_ELEMENT_TYPES.has(type)) {
      return `Unsupported element type "${type}" for "${k}"`;
    }
    const props = el.props;
    if (!props || typeof props !== 'object') return `Element "${k}" missing props`;
    const propsError = validatePropsForElementType(type, props);
    if (propsError) return `Invalid props for "${k}" (${type}): ${propsError}`;
    const children = el.children;
    if (children !== undefined) {
      if (!Array.isArray(children)) return `Element "${k}".children is not an array`;
      for (const childKey of children) {
        if (typeof childKey !== 'string' || childKey.trim().length === 0) {
          return `Invalid child key in "${k}".children`;
        }
        if (!elements[childKey]) return `Missing child element "${childKey}" referenced by "${k}"`;
      }
    }
  }

  return null;
}

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

  // Specialized, decision-grade sections with per-claim sources (and deterministic estimators where applicable).
  // These sections bypass the generic ToolLoopAgent to avoid "too general" outputs.
  if (sectionId === 'deliverables') {
    return runDeliveryScopeSection({ preQualificationId, allowWebEnrichment });
  }
  if (sectionId === 'submission') {
    return runSubmissionSection({ preQualificationId, allowWebEnrichment });
  }
  if (sectionId === 'references') {
    return runReferencesSection({ preQualificationId, allowWebEnrichment });
  }

  let hasQueriedDocuments = false;
  let hasStoredVisualization = false;
  let hasStoredDashboardHighlights = false;
  let capturedSources: SourcePanelItem[] = [];

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
	2. ZUERST: Zusammenfassung (1 Paragraph, 4-8 Sätze) inkl. Interpretation fürs Angebotsteam
	3. DANN: Details in 3-6 SubSection(s) mit KeyValueTable/BulletList
	4. Wenn Sonderfälle/Mechaniken vorkommen: eigene SubSection "Sonderfälle & Beispiele" (mit Rechenbeispiel!)

	Verfügbare Typen:
	- Section: Hauptcontainer mit Card + H2 (title: string, description?: string)
	- SubSection: Unterabschnitt mit H3 (title: string)
	- KeyValueTable: Mehrere Key-Value-Paare als EINE Tabelle (items: [{label, value}, ...])
	- KeyValue: NUR für ein einzelnes, isoliertes Paar (label: string, value: string)
	- BulletList: Aufzählung (items: string[])
	- Paragraph: Fließtext (text: string)
	- Metric: Einzelne Kennzahl (label: string, value: string|number, unit?: string)
	- DataTable: Tabelle (columns: [{key,label}], rows: Record<string,string>[], compact?: boolean)
	- CitedExcerpts: Exzerpt-Liste (items: [{excerpt, citation?, score?}])
	- BarChart: Balkendiagramm (data: [{label, value}], format?: 'number'|'percent'|'currency')
	- AreaChart: Flächen-Diagramm (data: [{label, value}], format?: 'number'|'percent'|'currency')
	- SourcesPanel: Quellenliste (wird automatisch ergänzt; du musst sie nicht selbst bauen)

KEY-VALUE REGELN (KRITISCH!):
- NIEMALS mehrere separate KeyValue-Elemente hintereinander verwenden!
- Bei 2+ Key-Value-Paaren: IMMER KeyValueTable mit items-Array
- KeyValue NUR für ein einzelnes, isoliertes Paar

	LAYOUT:
	- Immer einspaltig (kein Grid)
	- VERBOTEN: Grid, ResultCard (deprecated)
	- KEIN MARKDOWN: Keine "###", keine "---", keine Markdown-Tabellen ("| :--- |") in Texten.

	Beispiel:
	{
	  "root": "section-main",
	  "elements": {
	    "section-main": { "key": "section-main", "type": "Section", "props": { "title": "Vertragsanalyse" }, "children": ["para-1", "sub-details"] },
	    "para-1": { "key": "para-1", "type": "Paragraph", "props": { "text": "Die Ausschreibung sieht einen EVB-IT Systemvertrag vor. Fuer das Angebotsteam ist wichtig: ... (4-8 Saetze)" } },
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

      const treeError = validatePreQualVisualizationTree(visualization);
      if (treeError) return { success: false, error: treeError };

      // Deterministically append a sources block (deduped + limited) so the UI is always auditable.
      const visualizationWithSources = injectSourcesPanel(
        visualization as any,
        capturedSources
      ) as unknown as typeof visualization;

      const injectedError = validatePreQualVisualizationTree(visualizationWithSources);
      if (injectedError) return { success: false, error: injectedError };

      // Delete any existing visualization for this section first (avoid stale findFirst).
      await db
        .delete(dealEmbeddings)
        .where(
          and(
            eq(dealEmbeddings.preQualificationId, preQualificationId),
            eq(dealEmbeddings.chunkType, 'visualization'),
            sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
          )
        );

      // Store visualization in DB
      await db.insert(dealEmbeddings).values({
        pitchId: null,
        preQualificationId,
        agentName: 'prequal_section_agent',
        chunkType: 'visualization',
        chunkIndex: 0,
        chunkCategory: 'elaboration',
        content: JSON.stringify(visualizationWithSources),
        confidence,
        embedding: null,
        metadata: JSON.stringify({
          sectionId,
          isVisualization: true,
          elementCount: Object.keys(visualizationWithSources.elements).length,
        }),
      });

      hasStoredVisualization = true;
      console.log(
        `[Section:${sectionId}] Visualization stored (${Object.keys(visualizationWithSources.elements).length} elements)`
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
      '6. storeFindingsBatch — speichere 8-15 Findings (chunkType = sectionId) mit Klartext + Implikation fürs Angebotsteam (REQUIRED)',
      '7. storeDashboardHighlights — 1-3 Key-Facts für das Dashboard (REQUIRED, [] nur wenn wirklich nichts belastbar ist)',
      '8. complete — signalisiere, dass du fertig bist (REQUIRED, muss dein LETZTER Tool-Call sein)',
      '',
      'WICHTIG ZU queryDocuments:',
      '- Rufe queryDocuments MEHRFACH auf (2-4 Mal empfohlen)',
      '- Nutze KONKRETE Begriffe aus Ausschreibungen, NICHT die Briefing-Überschriften als Suchbegriff',
      '- Beispiele guter Queries: "Budget Kostenrahmen Auftragswert EUR", "Abgabefrist Einreichung Teilnahmeantrag", "EVB-IT Vertrag Gewährleistung Haftung"',
      '- Beispiele SCHLECHTER Queries: "Was ist das Budget?", "Wann ist die Deadline?", "Welcher Vertragstyp?"',
      '',
      'WICHTIG ZU storeFindingsBatch:',
      '- findings[].chunkType MUSS exakt der sectionId entsprechen (z.B. "budget")',
      '- findings[].category: "fact" oder "recommendation" (keine Phrasen wie "vermutlich")',
      '- Sonderfälle/Mechaniken als eigenes Finding mit Mini-Beispielrechnung dokumentieren',
      '',
      allowWebEnrichment
        ? 'Web-Anreicherung ist erlaubt. Wenn du webSearch/fetchUrl nutzt, halte es in einer separaten Section mit Quell-URLs.'
        : 'Nutze NICHT webSearch oder fetchUrl. Verwende NUR Dokument-Kontext.',
      'Du MUSST storeFindingsBatch verwenden, um Erkenntnisse mit chunkType passend zur sectionId zu speichern.',
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
          capturedSources.push(
            ...chunks
              .map(c => {
                const citation = c.source
                  ? formatSourceCitation(c.source)
                  : c.webSource?.url || (c.metadata as any)?.webSource?.url || '';
                const normalized = String(citation || '')
                  .replace(/\s+/g, ' ')
                  .trim();
                if (!normalized) return null;
                const item: SourcePanelItem = {
                  citation: normalized,
                  excerpt: excerptText(c.content, 350),
                  score: c.similarity,
                };
                return item;
              })
              .filter((s): s is SourcePanelItem => s !== null)
          );
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
            chunks: chunks.map(c => ({
              chunkId: c.chunkId,
              score: c.similarity,
              contentExcerpt: c.content.length > 900 ? `${c.content.slice(0, 899)}…` : c.content,
              sourceCitation: c.source ? formatSourceCitation(c.source) : null,
            })),
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
    // More room for multi-step RAG + detailed synthesis without timing out early.
    stopWhen: [stepCountIs(40), hasToolCall('complete')],
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
	   - Details: Strukturierte Fakten mit KeyValueTable/BulletList/DataTable (keine Markdown-Tabellen)
	   - Visuals (nur wenn passend): BarChart für Vergleiche/Anteile, AreaChart für Verläufe über Zeit
	   - Einschätzung: Was bedeutet das? Was fehlt? Worauf achten?
	   - Sonderfälle: Wenn Mechaniken/Anrechnungen/Erlösmodelle vorkommen, erkläre sie mit Beispielrechnung
6. Speichere 8-15 Findings via storeFindingsBatch (chunkType = sectionId)
7. Erstelle 1-3 Key-Facts für das Dashboard via storeDashboardHighlights
8. Rufe complete auf

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

    if (!hasStoredVisualization) {
      const attemptedStore = result.steps.some(step =>
        step.toolCalls.some(call => call.toolName === 'storeVisualization')
      );
      console.warn(
        `[Section:${sectionId}] Visualization missing after agent run (${attemptedStore ? 'storeVisualization attempted' : 'storeVisualization not called'}) — generating fallback`
      );

      // Fallback: Generate a minimal visualization in a single structured call.
      // This prevents the whole qualification run from failing a section because the
      // ToolLoopAgent hit the step limit before calling storeVisualization.
      try {
        const chunks = await queryRawChunks({
          preQualificationId,
          question: sectionQuery,
          maxResults: 10,
        });

        let root = 'section-main';
        let elements: Record<string, any> = {};
        let confidence = 35;

        try {
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
              'Erstelle eine JsonRenderTree Visualisierung (Section -> Paragraph Summary -> 3-6 SubSections).',
              'Wenn Infos fehlen: explizit benennen, was fehlt, statt zu raten.',
              'Wenn Sonderfall/Mechanik vorkommt: eigene SubSection "Sonderfälle & Beispiele" (mit Rechenbeispiel).',
            ].join('\n'),
            temperature: 0.2,
            maxTokens: 2000,
            timeout: 30_000,
          });

          confidence = fallback.confidence;
          root = fallback.root;
          elements = { ...fallback.elements };
        } catch (llmError) {
          console.warn(
            `[Section:${sectionId}] Fallback LLM visualization failed — using deterministic fallback:`,
            llmError
          );
        }

        const sources = buildSourcesFromRawChunks(chunks, {
          maxSources: 10,
          maxExcerptChars: 350,
        });

        // Deterministic fallback (also acts as a "self-heal" when the model output is invalid).
        const candidateError = validatePreQualVisualizationTree({ root, elements });
        if (
          !elements ||
          Object.keys(elements).length === 0 ||
          !root ||
          !elements[root] ||
          candidateError
        ) {
          const FALLBACK_TITLES: Record<string, string> = {
            budget: 'Budget & Laufzeit',
            timing: 'Zeitplan & Fristen',
            contracts: 'Vertragstyp & Risiken',
            deliverables: 'Lieferumfang',
            submission: 'Abgabe',
            references: 'Referenzen & Eignung',
            'award-criteria': 'Zuschlagskriterien',
            'offer-structure': 'Angebotsstruktur',
            risks: 'Risiken',
          };
          const title =
            FALLBACK_TITLES[sectionId] || sectionQuery.split('\n')[0]?.slice(0, 80) || sectionId;

          const citedItems: Array<{ excerpt: string; citation?: string; score?: number }> = [];
          const extraElements: Record<string, any> = {};
          const tableChildKeys: string[] = [];

          let tableIdx = 0;
          for (const c of chunks.slice(0, 5)) {
            const raw = String(c.content || '');
            const citation = c.source
              ? formatSourceCitation(c.source)
              : c.webSource?.url || (c.metadata as any)?.webSource?.url || undefined;

            const parsed =
              looksLikeMarkdownTable(raw) && raw.length <= 40_000 ? parseMarkdownTable(raw) : null;

            if (parsed) {
              const srcKey = `table-src-${tableIdx}`;
              const tableKey = `table-${tableIdx}`;
              extraElements[srcKey] = {
                key: srcKey,
                type: 'Paragraph',
                props: {
                  text: citation ? `Quelle: ${citation}` : 'Tabelle aus den Dokumenten',
                },
              };
              extraElements[tableKey] = {
                key: tableKey,
                type: 'DataTable',
                props: { columns: parsed.columns, rows: parsed.rows, compact: true },
              };
              tableChildKeys.push(srcKey, tableKey);
              tableIdx += 1;
              continue;
            }

            citedItems.push({
              excerpt: excerptText(raw, 350),
              ...(citation ? { citation } : {}),
              score: c.similarity,
            });
          }

          const extractsChildren: string[] = [];
          if (citedItems.length > 0) {
            extraElements['extracts-excerpts'] = {
              key: 'extracts-excerpts',
              type: 'CitedExcerpts',
              props: { items: citedItems },
            };
            extractsChildren.push('extracts-excerpts');
          }

          extractsChildren.push(...tableChildKeys);

          if (extractsChildren.length === 0) {
            extraElements['extracts-empty'] = {
              key: 'extracts-empty',
              type: 'Paragraph',
              props: { text: 'Keine relevanten Informationen in den Dokumenten gefunden.' },
            };
            extractsChildren.push('extracts-empty');
          }

          root = 'section-main';
          elements = {
            'section-main': {
              key: 'section-main',
              type: 'Section',
              props: { title },
              children: ['summary', 'sub-extracts', 'sub-implications'],
            },
            summary: {
              key: 'summary',
              type: 'Paragraph',
              props: {
                text: [
                  'Hier sind belastbare Auszüge aus den Dokumenten und eine erste strukturierte Einordnung für das Angebotsteam.',
                  'Bitte prüfe insbesondere Sonderregelungen (Anrechnungen, Bonus/Malus, Erlösmodelle) direkt im PDF anhand der Quellenangaben.',
                  'Wenn Angaben fehlen oder widersprüchlich sind: als Bieterfrage klären, bevor Preis/Leistung finalisiert wird.',
                  'Diese Darstellung ist ein Fallback und ersetzt keine finale Angebotsprüfung.',
                ].join(' '),
              },
            },
            'sub-extracts': {
              key: 'sub-extracts',
              type: 'SubSection',
              props: { title: 'Relevante Auszüge' },
              children: extractsChildren,
            },
            'sub-implications': {
              key: 'sub-implications',
              type: 'SubSection',
              props: { title: 'Was bedeutet das für das Angebotsteam?' },
              children: ['implications-list'],
            },
            'implications-list': {
              key: 'implications-list',
              type: 'BulletList',
              props: {
                items: [
                  'Kernaussagen aus den Auszügen validieren (Quelle/Seite im PDF nachschlagen).',
                  'Sonderfälle als klare Angebotsannahmen formulieren (z.B. Anrechnung/Bonus/Malus).',
                  'Offene Punkte als Bieterfragen/Rückfragen klären, bevor Preis/Leistung finalisiert wird.',
                ],
              },
            },
            ...extraElements,
          };

          confidence = 25;
        }

        // Always append an auditable sources block for fallback visualizations.
        const injected = injectSourcesPanel({ root, elements } as any, sources, {
          subSectionTitle: 'Quellen',
          panelTitle: 'Quellen',
          maxSources: 10,
        });
        root = injected.root ?? root;
        elements = injected.elements;

        // Delete any existing visualization for this section first (avoid stale findFirst).
        await db
          .delete(dealEmbeddings)
          .where(
            and(
              eq(dealEmbeddings.preQualificationId, preQualificationId),
              eq(dealEmbeddings.chunkType, 'visualization'),
              sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
            )
          );

        await db.insert(dealEmbeddings).values({
          pitchId: null,
          preQualificationId,
          agentName: 'prequal_section_agent_fallback',
          chunkType: 'visualization',
          chunkIndex: 0,
          chunkCategory: 'elaboration',
          content: JSON.stringify({ root, elements }),
          confidence,
          embedding: null,
          metadata: JSON.stringify({
            sectionId,
            isVisualization: true,
            elementCount: Object.keys(elements).length,
            fallback: true,
          }),
        });

        console.warn(
          `[Section:${sectionId}] Fallback visualization stored (${Object.keys(elements).length} elements)`
        );
        return { success: true };
      } catch (fallbackError) {
        // Never fail a section solely because the visualization couldn't be generated.
        // Persist a minimal deterministic tree so UI and downstream exports still work.
        console.warn(
          `[Section:${sectionId}] Visualization fallback failed completely — storing minimal tree:`,
          fallbackError
        );

        let root = 'section-main';
        let elements: Record<string, any> = {
          'section-main': {
            key: 'section-main',
            type: 'Section',
            props: { title: sectionId },
            children: ['summary'],
          },
          summary: {
            key: 'summary',
            type: 'Paragraph',
            props: { text: 'Diese Sektion konnte nicht automatisch visualisiert werden.' },
          },
        };

        // Best-effort: still attach sources from earlier document queries, if available.
        const injected = injectSourcesPanel({ root, elements } as any, capturedSources, {
          subSectionTitle: 'Quellen',
          panelTitle: 'Quellen',
          maxSources: 10,
        });
        root = injected.root ?? root;
        elements = injected.elements;

        // Delete any existing visualization for this section first (avoid stale findFirst).
        await db
          .delete(dealEmbeddings)
          .where(
            and(
              eq(dealEmbeddings.preQualificationId, preQualificationId),
              eq(dealEmbeddings.chunkType, 'visualization'),
              sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
            )
          );

        await db.insert(dealEmbeddings).values({
          pitchId: null,
          preQualificationId,
          agentName: 'prequal_section_agent_fallback',
          chunkType: 'visualization',
          chunkIndex: 0,
          chunkCategory: 'elaboration',
          content: JSON.stringify({ root, elements }),
          confidence: 10,
          embedding: null,
          metadata: JSON.stringify({
            sectionId,
            isVisualization: true,
            elementCount: Object.keys(elements).length,
            fallback: true,
            hardFallback: true,
          }),
        });

        return { success: true };
      }
    }

    if (!hasStoredDashboardHighlights) {
      try {
        const visualizationRow = await db.query.dealEmbeddings.findFirst({
          where: and(
            eq(dealEmbeddings.preQualificationId, preQualificationId),
            eq(dealEmbeddings.chunkType, 'visualization'),
            sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
          ),
        });

        const visualizationText = visualizationRow?.content ?? '';

        let highlights: string[] = [];
        let confidence = 55;

        try {
          const parsed = visualizationText ? JSON.parse(visualizationText) : null;
          highlights = extractHighlightsFromVisualization(parsed).slice(0, 3);
        } catch {
          highlights = [];
        }

        // If deterministic extraction yields nothing, try a small structured call.
        if (highlights.length === 0) {
          try {
            const highlightResult = await generateStructuredOutput({
              model: 'default',
              schema: z.object({
                highlights: z.array(z.string().max(120)).max(3),
                confidence: z.number().min(0).max(100),
              }),
              system:
                'Du extrahierst kurze Key-Facts (Dashboard Highlights) aus einer vorhandenen Visualisierung. Keine Vermutungen.',
              prompt: [
                `SectionId: ${sectionId}`,
                '',
                'VISUALISIERUNG (JSON):',
                visualizationText || 'Keine Visualisierung gefunden.',
                '',
                'AUFGABE:',
                'Gib 1-3 konkrete Fakten (max 120 Zeichen je Fact). Wenn nichts belastbar ist: []',
              ].join('\n'),
              temperature: 0.2,
              maxTokens: 400,
              timeout: 20_000,
            });
            highlights = highlightResult.highlights;
            confidence = highlightResult.confidence;
          } catch (llmError) {
            console.warn(
              `[Section:${sectionId}] Auto-highlights LLM failed — using deterministic fallback:`,
              llmError
            );
          }
        }

        if (highlights.length === 0) {
          highlights = defaultHighlightsForSection(sectionId);
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

        if (highlights.length > 0) {
          await db.insert(dealEmbeddings).values({
            pitchId: null,
            preQualificationId,
            agentName: `dashboard_${sectionId}`,
            chunkType: 'dashboard_highlight',
            chunkIndex: 0,
            chunkCategory: 'elaboration',
            content: JSON.stringify(highlights),
            confidence,
            embedding: null,
            metadata: JSON.stringify({ sectionId, autoGenerated: true }),
          });
        }

        hasStoredDashboardHighlights = true;
      } catch (error) {
        console.warn(
          `[Section:${sectionId}] Auto-highlights failed — continuing (non-critical):`,
          error
        );
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function extractHighlightsFromVisualization(tree: any): string[] {
  if (!tree || typeof tree !== 'object') return [];
  const elementsUnknown = (tree as { elements?: unknown }).elements;
  if (!elementsUnknown || typeof elementsUnknown !== 'object') return [];
  const elements = elementsUnknown as Record<string, unknown>;

  const out: string[] = [];
  const push = (s: string) => {
    const text = s.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const clipped = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    if (!out.includes(clipped)) out.push(clipped);
  };

  for (const elUnknown of Object.values(elements)) {
    if (!elUnknown || typeof elUnknown !== 'object') continue;
    const el = elUnknown as { type?: unknown; props?: unknown };
    const type = typeof el.type === 'string' ? el.type : undefined;
    const props =
      el.props && typeof el.props === 'object' ? (el.props as Record<string, unknown>) : undefined;
    if (!type || !props) continue;

    if (type === 'KeyValueTable') {
      const items = props.items;
      if (Array.isArray(items)) {
        for (const itemUnknown of items) {
          if (!itemUnknown || typeof itemUnknown !== 'object') continue;
          const item = itemUnknown as Record<string, unknown>;
          const label = item.label;
          const value = item.value;
          if (typeof label === 'string' && typeof value === 'string') {
            push(`${label}: ${value}`);
          }
          if (out.length >= 3) return out;
        }
      }
    }

    if (type === 'Metric') {
      const label = props.label;
      const value = props.value;
      const unit = props.unit;
      if (typeof label === 'string' && (typeof value === 'string' || typeof value === 'number')) {
        push(`${label}: ${value}${typeof unit === 'string' ? ` ${unit}` : ''}`);
        if (out.length >= 3) return out;
      }
    }

    if (type === 'BulletList') {
      const items = props.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (typeof item === 'string') push(item);
          if (out.length >= 3) return out;
        }
      }
    }
  }

  // Fallback: first paragraph
  for (const elUnknown of Object.values(elements)) {
    if (!elUnknown || typeof elUnknown !== 'object') continue;
    const el = elUnknown as { type?: unknown; props?: unknown };
    if (el.type !== 'Paragraph' || !el.props || typeof el.props !== 'object') continue;
    const props = el.props as Record<string, unknown>;
    const text = props.text;
    if (typeof text === 'string') {
      push(text);
      break;
    }
  }

  return out;
}

function defaultHighlightsForSection(sectionId: string): string[] {
  switch (sectionId) {
    case 'budget':
      return ['Budgetangaben pruefen (Textauszug + Bezugsrahmen).', 'Laufzeit/Optionen klären.'];
    case 'timing':
      return [
        'Fristen/Termine aus Dokumenten validieren.',
        'Bieterfragen/Shortlisting-Termine pruefen.',
      ];
    case 'contracts':
      return [
        'Vertragstyp und Haftungs-/Rechte-Regelungen identifizieren.',
        'Risiken als Angebotsannahmen formulieren.',
      ];
    case 'deliverables':
      return [
        'Pflichtleistungen und Deliverables extrahieren.',
        'Abnahme-/Dokumentationspflichten pruefen.',
      ];
    case 'references':
      return ['Anzahl/Art der Referenzen pruefen.', 'Nachweise/Formblaetter identifizieren.'];
    case 'award-criteria':
      return [
        'Zuschlagskriterien + Gewichtungen extrahieren.',
        'Bewertungsmethodik und Pflichtkonzepte pruefen.',
      ];
    case 'offer-structure':
      return [
        'Pflichtunterlagen/Konzepte zusammenstellen.',
        'Teilnahme- vs Angebotsphase unterscheiden.',
      ];
    case 'risks':
      return [
        'Projektrisiken identifizieren und bewerten.',
        'Mitigationsmassnahmen fuer das Angebotsteam ableiten.',
      ];
    default:
      return [
        'Wesentliche Fakten aus Dokumenten extrahieren.',
        'Offene Punkte als Rueckfragen markieren.',
      ];
  }
}
