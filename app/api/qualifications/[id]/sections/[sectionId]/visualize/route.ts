import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealEmbeddings, qualifications } from '@/lib/db/schema';
import { generateSectionVisualization } from '@/lib/json-render/section-visualization-agent';

/**
 * POST /api/qualifications/[id]/sections/[sectionId]/visualize
 *
 * Agent-native visualization generation for a section.
 * Uses RAG data + project context to generate a JsonRenderTree visualization.
 *
 * Body:
 * - refinementPrompt?: string - Optional user prompt to refine/customize the visualization
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

    const { id: qualificationId, sectionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const refinementPrompt = body.refinementPrompt as string | undefined;

    console.log(
      `[Visualize API] POST /qualifications/${qualificationId}/sections/${sectionId}/visualize`,
      { refinementPrompt: refinementPrompt?.substring(0, 50) }
    );

    // Get qualification with project context
    const qualification = await db.query.qualifications.findFirst({
      where: eq(qualifications.id, qualificationId),
    });

    if (!qualification) {
      return NextResponse.json({ error: 'Qualification not found' }, { status: 404 });
    }

    // Get existing RAG data for this section
    const ragChunks = await db.query.dealEmbeddings.findMany({
      where: and(
        eq(dealEmbeddings.qualificationId, qualificationId),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`,
        sql`chunk_type != 'visualization'`
      ),
      orderBy: (embeddings, { desc }) => [desc(embeddings.confidence)],
      limit: 20,
    });

    if (ragChunks.length === 0) {
      return NextResponse.json(
        {
          error: 'Keine RAG-Daten für diese Sektion vorhanden. Führe zuerst einen Deep Scan durch.',
        },
        { status: 400 }
      );
    }

    // Build project context
    const projectContext = {
      customerName: qualification.customerName,
      websiteUrl: qualification.websiteUrl,
      industry: qualification.industry,
      projectDescription: qualification.projectDescription,
    };

    // Generate visualization via agent
    const result = await generateSectionVisualization({
      qualificationId,
      sectionId,
      ragChunks: ragChunks.map(chunk => ({
        content: chunk.content,
        confidence: chunk.confidence ?? 50,
        chunkType: chunk.chunkType ?? 'finding',
        agentName: chunk.agentName ?? 'unknown',
      })),
      projectContext,
      refinementPrompt,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      visualizationTree: result.visualizationTree,
      confidence: result.confidence,
      message: `Visualisierung für "${sectionId}" erfolgreich generiert`,
    });
  } catch (error) {
    console.error('[Visualize API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
