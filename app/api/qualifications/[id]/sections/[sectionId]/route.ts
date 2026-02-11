import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { SECTION_BY_ID } from '@/lib/dashboard/sections';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import { isProcessingState } from '@/lib/qualifications/constants';
import { getPreQualSectionQueryTemplate } from '@/lib/qualifications/section-queries';
import { queryRAG } from '@/lib/rag/retrieval-service';

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

async function getDirectVisualization(
  qualificationId: string,
  sectionId: string
): Promise<{ tree: JsonRenderTree; confidence: number } | null> {
  try {
    const result = await db.query.dealEmbeddings.findFirst({
      where: and(
        eq(dealEmbeddings.preQualificationId, qualificationId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      ),
    });

    if (result?.content) {
      // Stale deliverables visualizations (pre split into Lieferumfang/Abgabe) did not include schemaVersion.
      // Treat them as missing so the UI can self-heal via "Visualisierung generieren".
      if (sectionId === 'deliverables') {
        try {
          const meta = (result.metadata ? JSON.parse(result.metadata) : null) as any;
          const schemaVersion = typeof meta?.schemaVersion === 'number' ? meta.schemaVersion : null;
          if (!schemaVersion || schemaVersion < 2) return null;
        } catch {
          return null;
        }
      }
      return {
        tree: JSON.parse(result.content) as JsonRenderTree,
        confidence: result.confidence ?? 50,
      };
    }
    return null;
  } catch (error) {
    console.error('[Qualification Section API] Direct viz error:', error);
    return null;
  }
}

function calculateConfidence(similarities: number[]): number {
  if (similarities.length === 0) return 0;
  const avg = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  return Math.round(avg * 100);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: qualificationId, sectionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const rawMode = searchParams.get('raw') === 'true';

    const preQualification = await db.query.preQualifications.findFirst({
      where: and(
        eq(preQualifications.id, qualificationId),
        eq(preQualifications.userId, session.user.id)
      ),
    });

    if (!preQualification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const template = getPreQualSectionQueryTemplate(sectionId);
    if (!template) {
      return NextResponse.json({ error: 'No template found' }, { status: 404 });
    }

    // Use a short, section-specific RAG query (long templates perform poorly for retrieval).
    const retrievalQuery = SECTION_BY_ID.get(sectionId)?.ragQuery ?? sectionId;

    const isProcessing = isProcessingState(preQualification.status);
    const canRegenerate = !isProcessing;

    const [results, directViz, findingsCountRows, highlightRow] = await Promise.all([
      queryRAG({
        preQualificationId: qualificationId,
        question: retrievalQuery,
        maxResults: 10,
      }),
      getDirectVisualization(qualificationId, sectionId),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(dealEmbeddings)
        .where(
          and(
            eq(dealEmbeddings.preQualificationId, qualificationId),
            eq(dealEmbeddings.agentName, 'prequal_section_agent'),
            eq(dealEmbeddings.chunkType, sectionId)
          )
        ),
      db.query.dealEmbeddings.findFirst({
        where: and(
          eq(dealEmbeddings.preQualificationId, qualificationId),
          eq(dealEmbeddings.chunkType, 'dashboard_highlight'),
          eq(dealEmbeddings.agentName, `dashboard_${sectionId}`)
        ),
      }),
    ]);

    const findingsCount = findingsCountRows[0]?.count ?? 0;
    const artifacts = {
      findingsCount,
      hasHighlight: Boolean(highlightRow),
      hasVisualization: Boolean(directViz),
    };

    const confidence = directViz?.confidence ?? calculateConfidence(results.map(r => r.similarity));

    if (rawMode) {
      return NextResponse.json({
        sectionId,
        retrievalQuery,
        results,
        confidence,
        status: results.length > 0 ? 'success' : 'no_data',
        qualificationStatus: preQualification.status,
        artifacts,
        canRegenerate,
      });
    }

    if (directViz) {
      return NextResponse.json({
        sectionId,
        results,
        confidence: directViz.confidence,
        status: 'success',
        visualizationTree: directViz.tree,
        synthesisMethod: 'ai',
        qualificationStatus: preQualification.status,
        artifacts,
        canRegenerate,
      });
    }

    if (
      results.length === 0 &&
      !artifacts.hasVisualization &&
      !artifacts.hasHighlight &&
      findingsCount === 0
    ) {
      return NextResponse.json({
        sectionId,
        results: [],
        confidence: 0,
        status: 'no_data',
        errorMessage: 'Keine RAG-Daten für diese Sektion vorhanden',
        qualificationStatus: preQualification.status,
        artifacts,
        canRegenerate,
      });
    }

    return NextResponse.json({
      sectionId,
      results,
      confidence,
      status: 'success',
      ...(results.length > 0 ? { synthesisMethod: 'fallback' as const } : {}),
      qualificationStatus: preQualification.status,
      artifacts,
      canRegenerate,
    });
  } catch (error) {
    console.error('[Qualification Section API] Error:', error);
    return NextResponse.json(
      { error: 'Sektionsdaten konnten nicht geladen werden' },
      { status: 500 }
    );
  }
}
