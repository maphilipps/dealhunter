import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { generateStructuredOutput } from '@/lib/ai/config';
import { auth } from '@/lib/auth';
import { SECTION_BY_ID } from '@/lib/dashboard/sections';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import { getPreQualSectionQueryTemplate } from '@/lib/qualifications/section-queries';
import { formatRAGContext, queryRawChunks } from '@/lib/rag/raw-retrieval-service';

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
  // Tables/Metrics
  'KeyValue',
  'KeyValueTable',
  'Metric',
  'DataTable',
]);

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
    const body = await request.json().catch(() => ({}));
    const refinementPrompt =
      body && typeof body === 'object' && typeof (body as any).refinementPrompt === 'string'
        ? ((body as any).refinementPrompt as string).trim()
        : undefined;

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

REGELN:
- Root MUSS eine Section sein.
- ZUERST eine Zusammenfassung als Paragraph (4-10 Sätze), klar und entscheidungsrelevant.
- DANACH 3-7 SubSections mit konkreten Details (nicht generisch).
- Keine Rohdaten kopieren: immer strukturieren und interpretieren.
- Keine doppelten Aussagen.
- Wenn Informationen fehlen: explizit sagen was fehlt und warum es relevant ist (statt zu raten).
- Kein Grid, keine verschachtelten Cards, kein ResultCard.

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
        tree = buildMinimalTree({
          title,
          message:
            'Die Visualisierung konnte nicht in einem gültigen Format erzeugt werden. ' +
            'Unten sind sichere Next Steps. Bitte versuche es erneut oder prüfe die Originaldokumente.',
        });
        confidence = Math.min(35, out.confidence);
      } else {
        tree = candidate;
        confidence = out.confidence;
      }
    } catch (e) {
      console.error('[PreQual Visualize API] Generation failed, using minimal fallback:', e);
      tree = buildMinimalTree({
        title,
        message:
          'Die Visualisierung konnte gerade nicht generiert werden (Fehler/Timeout). ' +
          'Unten sind sichere Next Steps. Bitte versuche es später erneut.',
      });
      confidence = 25;
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
