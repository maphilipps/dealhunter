import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import { getPreQualSectionQueryTemplate } from '@/lib/pre-qualifications/section-queries';
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
  preQualificationId: string,
  sectionId: string
): Promise<{ tree: JsonRenderTree; confidence: number } | null> {
  try {
    const result = await db.query.dealEmbeddings.findFirst({
      where: and(
        eq(dealEmbeddings.preQualificationId, preQualificationId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      ),
    });

    if (result?.content) {
      return {
        tree: JSON.parse(result.content) as JsonRenderTree,
        confidence: result.confidence ?? 50,
      };
    }
    return null;
  } catch (error) {
    console.error('[PreQual Section API] Direct viz error:', error);
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

    const { id: preQualificationId, sectionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const rawMode = searchParams.get('raw') === 'true';

    const preQualification = await db.query.preQualifications.findFirst({
      where: and(
        eq(preQualifications.id, preQualificationId),
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

    const results = await queryRAG({
      preQualificationId,
      question: template,
      maxResults: 10,
    });

    const confidence = calculateConfidence(results.map(r => r.similarity));

    if (rawMode) {
      return NextResponse.json({
        sectionId,
        results,
        confidence,
        status: results.length > 0 ? 'success' : 'no_data',
      });
    }

    const directViz = await getDirectVisualization(preQualificationId, sectionId);
    if (directViz) {
      return NextResponse.json({
        sectionId,
        results,
        confidence: directViz.confidence,
        status: 'success',
        visualizationTree: directViz.tree,
        synthesisMethod: 'ai',
      });
    }

    if (results.length === 0) {
      return NextResponse.json({
        sectionId,
        results: [],
        confidence: 0,
        status: 'no_data',
        errorMessage: 'Keine RAG-Daten für diese Sektion vorhanden',
      });
    }

    return NextResponse.json({
      sectionId,
      results,
      confidence,
      status: 'success',
      synthesisMethod: 'fallback',
    });
  } catch (error) {
    console.error('[PreQual Section API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
