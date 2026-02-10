import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { generateStructuredOutput } from '@/lib/ai/config';
import { auth } from '@/lib/auth';
import { SECTION_BY_ID } from '@/lib/dashboard/sections';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import { excerptText } from '@/lib/qualifications/sources';
import { getPreQualSectionQueryTemplate } from '@/lib/qualifications/section-queries';
import { formatSourceCitation } from '@/lib/rag/citations';
import type { RawRAGResult } from '@/lib/rag/raw-retrieval-service';
import { formatRAGContext, queryRawChunks } from '@/lib/rag/raw-retrieval-service';
import {
  buildSourcesFromRawChunks,
  injectSourcesPanel,
  looksLikeMarkdownTable,
  parseMarkdownTable,
  validatePropsForElementType,
} from '@/lib/json-render/prequal-visualization-utils';

interface JsonRenderTree {
  root: string | null;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
}

const AllowedElementTypes = new Set([
  // Layout
  'Section',
  'SubSection',
  // Content
  'Paragraph',
  'BulletList',
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

function getOptionalStringField(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function validateTree(tree: JsonRenderTree): { ok: true } | { ok: false; error: string } {
  if (!tree || typeof tree !== 'object') {
    return { ok: false, error: 'Tree is not an object' };
  }
  if (!tree.root || typeof tree.root !== 'string' || tree.root.trim().length === 0) {
    return { ok: false, error: 'Missing or empty root' };
  }
  if (!tree.elements || typeof tree.elements !== 'object') {
    return { ok: false, error: 'Missing elements map' };
  }
  if (!tree.elements[tree.root]) {
    return { ok: false, error: `Root element "${tree.root}" not found in elements` };
  }

  for (const [k, v] of Object.entries(tree.elements)) {
    if (!v || typeof v !== 'object') return { ok: false, error: `Element "${k}" is not an object` };
    const element = v as Record<string, unknown>;
    const key = element.key;
    const type = element.type;
    const props = element.props;
    const children = element.children;

    if (typeof key !== 'string' || key.trim().length === 0) {
      return { ok: false, error: `Element "${k}" is missing key` };
    }
    if (key !== k) {
      return { ok: false, error: `Element key mismatch: map key "${k}" != element.key "${key}"` };
    }
    if (typeof type !== 'string' || type.trim().length === 0) {
      return { ok: false, error: `Element "${k}" is missing type` };
    }
    if (!AllowedElementTypes.has(type)) {
      return { ok: false, error: `Unsupported element type "${type}" for "${k}"` };
    }
    if (!props || typeof props !== 'object') {
      return { ok: false, error: `Element "${k}" is missing props` };
    }
    const propsError = validatePropsForElementType(type, props);
    if (propsError) {
      return { ok: false, error: `Invalid props for "${k}" (${type}): ${propsError}` };
    }
    if (children !== undefined) {
      if (!Array.isArray(children)) {
        return { ok: false, error: `Element "${k}".children is not an array` };
      }
      for (const childKey of children) {
        if (typeof childKey !== 'string' || childKey.trim().length === 0) {
          return { ok: false, error: `Invalid child key in "${k}".children` };
        }
        if (!tree.elements[childKey]) {
          return { ok: false, error: `Missing child element "${childKey}" referenced by "${k}"` };
        }
      }
    }
  }

  return { ok: true };
}

function buildMinimalTree(params: { title: string; message: string }): JsonRenderTree {
  const root = 'section-main';
  const elements: JsonRenderTree['elements'] = {
    [root]: {
      key: root,
      type: 'Section',
      props: { title: params.title },
      children: ['summary', 'sub-next'],
    },
    summary: {
      key: 'summary',
      type: 'Paragraph',
      props: { text: params.message },
    },
    'sub-next': {
      key: 'sub-next',
      type: 'SubSection',
      props: { title: 'Next Steps' },
      children: ['next-steps'],
    },
    'next-steps': {
      key: 'next-steps',
      type: 'BulletList',
      props: {
        items: [
          'Visualisierung erneut generieren (optional mit Verfeinerung).',
          'Originaldokument(e) auf formale Anforderungen, Deadlines und Sonderregeln prüfen.',
          'Unklare Punkte als Bieterfragen formulieren.',
        ],
      },
    },
  };

  return { root, elements };
}

function buildDeterministicFallbackTree(params: {
  title: string;
  sectionId: string;
  message: string;
  chunks: RawRAGResult[];
}): JsonRenderTree {
  const citedItems: Array<{ excerpt: string; citation?: string; score?: number }> = [];
  const elements: Record<string, any> = {};
  const extractsChildren: string[] = [];

  let tableIdx = 0;
  for (const c of params.chunks.slice(0, 6)) {
    const raw = String(c.content || '');
    const citation = c.source
      ? formatSourceCitation(c.source)
      : c.webSource?.url || c.metadata?.webSource?.url || undefined;

    const parsed =
      looksLikeMarkdownTable(raw) && raw.length <= 40_000 ? parseMarkdownTable(raw) : null;

    if (parsed) {
      const tableKey = `table-${tableIdx++}`;
      elements[tableKey] = {
        key: tableKey,
        type: 'DataTable',
        props: { columns: parsed.columns, rows: parsed.rows, compact: true },
      };
      extractsChildren.push(tableKey);
      continue;
    }

    citedItems.push({
      excerpt: excerptText(raw, 350),
      ...(citation ? { citation } : {}),
      score: c.similarity,
    });
  }

  if (citedItems.length > 0) {
    elements['extracts-excerpts'] = {
      key: 'extracts-excerpts',
      type: 'CitedExcerpts',
      props: { items: citedItems },
    };
    extractsChildren.unshift('extracts-excerpts');
  }

  if (extractsChildren.length === 0) {
    elements['extracts-empty'] = {
      key: 'extracts-empty',
      type: 'Paragraph',
      props: { text: 'Keine relevanten Informationen in den Dokumenten gefunden.' },
    };
    extractsChildren.push('extracts-empty');
  }

  const root = 'section-main';
  return {
    root,
    elements: {
      [root]: {
        key: root,
        type: 'Section',
        props: { title: params.title },
        children: ['summary', 'sub-extracts', 'sub-next'],
      },
      summary: {
        key: 'summary',
        type: 'Paragraph',
        props: { text: params.message },
      },
      'sub-extracts': {
        key: 'sub-extracts',
        type: 'SubSection',
        props: { title: 'Relevante Auszüge' },
        children: extractsChildren,
      },
      'sub-next': {
        key: 'sub-next',
        type: 'SubSection',
        props: { title: 'Next Steps' },
        children: ['next-steps'],
      },
      'next-steps': {
        key: 'next-steps',
        type: 'BulletList',
        props: {
          items: [
            'Originaldokument(e) anhand der Quellenangaben prüfen.',
            'Sonderregelungen (Anrechnungen, Bonus/Malus, Erlösmodelle) als Angebotsannahmen sauber formulieren.',
            'Unklare Punkte als Bieterfragen formulieren, bevor Preis/Leistung finalisiert wird.',
          ],
        },
      },
      ...elements,
    },
  };
}

/**
 * POST /api/qualifications/[id]/sections/[sectionId]/visualize
 *
 * Generates and persists a JsonRenderTree visualization for the given prequal section.
 *
 * Body:
 * - refinementPrompt?: string
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preQualificationId, sectionId } = await context.params;
    const body: unknown = await request.json().catch(() => ({}));
    const refinementPrompt = getOptionalStringField(body, 'refinementPrompt')?.trim() || undefined;

    // Verify ownership
    const preQual = await db.query.preQualifications.findFirst({
      where: and(
        eq(preQualifications.id, preQualificationId),
        eq(preQualifications.userId, session.user.id)
      ),
      columns: { id: true },
    });
    if (!preQual) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const sectionBriefing = getPreQualSectionQueryTemplate(sectionId);
    if (!sectionBriefing) {
      return NextResponse.json(
        { error: `No template found for section ${sectionId}` },
        { status: 404 }
      );
    }

    const sectionConfig = SECTION_BY_ID.get(sectionId);
    const retrievalQuery = sectionConfig?.ragQuery ?? sectionId;
    const title = sectionConfig?.title ?? sectionId;

    const chunks = await queryRawChunks({
      preQualificationId,
      question: retrievalQuery,
      maxResults: 12,
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Keine relevanten Dokument-Chunks gefunden. Bitte später erneut versuchen.' },
        { status: 400 }
      );
    }

    const ragContext = formatRAGContext(chunks);
    const sources = buildSourcesFromRawChunks(chunks, { maxSources: 10, maxExcerptChars: 350 });

    const elementSchema = z.object({
      key: z.string().min(1),
      type: z.string().min(1),
      props: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
    });

    const schema = z.object({
      visualization: z.object({
        root: z.string().min(1),
        elements: z.record(z.string(), elementSchema),
      }),
      confidence: z.number().min(0).max(100),
    });

    const system = `Du generierst eine JsonRenderTree-Visualisierung für eine Ausschreibungsanalyse-Section.

VERFÜGBARE KOMPONENTEN (NUTZE NUR DIESE):
- Section (props: {title, description?, badge?, badgeVariant?})
- SubSection (props: {title, description?, badge?, badgeVariant?})
- Paragraph (props: {text})
- BulletList (props: {items: string[]})
- KeyValueTable (props: {items: {label, value}[]})
- KeyValue (props: {label, value}) NUR für ein einzelnes, isoliertes Paar
- Metric (props: {label, value, subValue?, trend?})
- DataTable (props: {columns: {key,label}[], rows: Record<string,string>[], compact?})
- CitedExcerpts (props: {title?, items: {excerpt, citation?, score?}[]})
- BarChart (props: {title?, description?, data: {label,value}[], format?, height?, color?})
- AreaChart (props: {title?, description?, data: {label,value}[], format?, height?, color?})

REGELN:
- Root MUSS eine Section sein.
- ZUERST eine Zusammenfassung als Paragraph (4-10 Sätze), klar und entscheidungsrelevant.
- DANACH 3-7 SubSections mit konkreten Details (nicht generisch).
- Keine Rohdaten kopieren: immer strukturieren und interpretieren.
- Keine doppelten Aussagen.
- Wenn Informationen fehlen: explizit sagen was fehlt und warum es relevant ist (statt zu raten).
- Kein Grid, keine verschachtelten Cards, kein ResultCard.

KEIN MARKDOWN:
- Keine "###" Überschriften, keine "---" Trenner, keine Markdown-Tabellen ("| :--- |") in Texten.
- Wenn Daten tabellarisch wirken: DataTable nutzen.

VISUALS (nur wenn passend):
- BarChart für Vergleiche/Anteile (z.B. Gewichtungen).
- AreaChart für Verläufe über Zeit (z.B. Vertragsjahre).

QUELLEN:
- Quellen werden automatisch ergänzt; keine Quellenliste in Texten bauen.

KEY-VALUE REGELN:
- NIEMALS mehrere separate KeyValue-Elemente hintereinander.
- Bei 2+ Paaren: IMMER KeyValueTable.

SPRACHE: Deutsch, professionell, prägnant.`;

    let tree: JsonRenderTree | null = null;
    let confidence = 55;

    try {
      const out = await generateStructuredOutput({
        model: 'default',
        schema,
        system,
        prompt: [
          `SECTION_ID: ${sectionId}`,
          `SECTION_TITLE: ${title}`,
          '',
          'BRIEFING:',
          sectionBriefing,
          '',
          'DOKUMENT-KONTEXT (RAG):',
          ragContext,
          '',
          refinementPrompt ? `USER_REFINEMENT: ${refinementPrompt}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        temperature: 0.2,
        maxTokens: 5000,
        timeout: 60_000,
      });

      const candidate: JsonRenderTree = {
        root: out.visualization.root,
        elements: out.visualization.elements as unknown as JsonRenderTree['elements'],
      };

      const validation = validateTree(candidate);
      if (!validation.ok) {
        console.warn('[PreQual Visualize API] Invalid tree generated, using minimal fallback:', {
          sectionId,
          error: validation.error,
        });
        tree = buildDeterministicFallbackTree({
          title,
          sectionId,
          message:
            'Hier sind belastbare Auszüge aus den Dokumenten und sichere Next Steps. ' +
            'Bitte prüfe die Quellen direkt im PDF und kläre Unklarheiten vor Angebotsabgabe.',
          chunks,
        });
        confidence = Math.min(35, out.confidence);
      } else {
        tree = candidate;
        confidence = out.confidence;
      }
    } catch (e) {
      console.error('[PreQual Visualize API] Generation failed, using minimal fallback:', e);
      tree = buildDeterministicFallbackTree({
        title,
        sectionId,
        message:
          'Die Visualisierung konnte gerade nicht generiert werden (Fehler/Timeout). ' +
          'Unten findest du belastbare Auszüge und sichere Next Steps.',
        chunks,
      });
      confidence = 25;
    }

    if (!tree) {
      tree = buildMinimalTree({
        title,
        message:
          'Die Visualisierung konnte nicht erzeugt werden. Unten sind sichere Next Steps. Bitte versuche es später erneut.',
      });
    }

    // Deterministically append sources so the UI is always auditable.
    tree = injectSourcesPanel(tree as any, sources, {
      subSectionTitle: 'Quellen',
      panelTitle: 'Quellen',
      maxSources: 10,
    }) as unknown as JsonRenderTree;

    const finalValidation = validateTree(tree);
    if (!finalValidation.ok) {
      console.warn(
        '[PreQual Visualize API] Tree became invalid after sources injection, using minimal fallback:',
        {
          sectionId,
          error: finalValidation.error,
        }
      );
      tree = injectSourcesPanel(
        buildMinimalTree({
          title,
          message:
            'Die Visualisierung konnte nicht in einem gültigen Format erzeugt werden. ' +
            'Unten sind sichere Next Steps. Bitte prüfe die Originaldokumente.',
        }) as any,
        sources,
        { subSectionTitle: 'Quellen', panelTitle: 'Quellen', maxSources: 10 }
      ) as unknown as JsonRenderTree;
      confidence = Math.min(confidence, 35);
    }

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
      agentName: 'prequal_section_visualize_api',
      chunkType: 'visualization',
      chunkIndex: 0,
      chunkCategory: 'elaboration',
      content: JSON.stringify(tree),
      confidence,
      embedding: null,
      metadata: JSON.stringify({
        sectionId,
        isVisualization: true,
        elementCount: Object.keys(tree.elements).length,
        generatedAt: new Date().toISOString(),
        ...(refinementPrompt ? { refinementPrompt } : {}),
        schemaVersion: 2,
      }),
    });

    return NextResponse.json({
      success: true,
      visualizationTree: tree,
      confidence,
      message: `Visualisierung für "${sectionId}" erfolgreich generiert`,
    });
  } catch (error) {
    console.error('[PreQual Visualize API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
