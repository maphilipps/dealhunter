import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { getRAGQueryTemplate } from '@/lib/pitches/navigation-config';
import { calculateConfidenceScore, queryRagForLead } from '@/lib/rag/lead-retrieval-service';
import type { SectionQueryResult } from '@/lib/rag/lead-retrieval-service';

/**
 * JsonRenderTree type for UI visualization
 */
export interface JsonRenderTree {
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

/**
 * Try to get a directly stored visualization from dealEmbeddings
 * (Agent-native output - new pattern)
 */
async function getDirectVisualization(
  pitchId: string,
  sectionId: string
): Promise<{ tree: JsonRenderTree; confidence: number } | null> {
  try {
    const result = await db.query.dealEmbeddings.findFirst({
      where: and(
        eq(dealEmbeddings.pitchId, pitchId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      ),
    });

    if (result?.content) {
      const tree = JSON.parse(result.content) as JsonRenderTree;
      return {
        tree,
        confidence: result.confidence ?? 50,
      };
    }
    return null;
  } catch (error) {
    console.error(`[Section API] Error fetching direct visualization:`, error);
    return null;
  }
}

/**
 * Extended Section Query Result with visualization tree
 */
export interface SynthesizedSectionResult extends SectionQueryResult {
  visualizationTree?: JsonRenderTree;
  synthesisMethod?: 'ai' | 'fallback';
}

/**
 * GET /api/pitches/[id]/sections/[sectionId]
 *
 * Fetch RAG data for a specific lead section.
 * Returns agent-native visualization if available.
 *
 * Query params:
 * - raw=true: Return raw RAG results without visualization (for debugging)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leadId, sectionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const rawMode = searchParams.get('raw') === 'true';

    console.error(`[Section API] GET /pitches/${leadId}/sections/${sectionId} (raw=${rawMode})`);

    // Get RAG query template for this section
    const template = getRAGQueryTemplate(sectionId);
    if (!template) {
      console.error(`[Section API] No RAG template found for section ${sectionId}`);
      const result: SynthesizedSectionResult = {
        sectionId,
        results: [],
        confidence: 0,
        status: 'error',
        errorMessage: `No RAG template found for section ${sectionId}`,
      };
      return NextResponse.json(result, { status: 404 });
    }

    console.error(`[Section API] RAG template: ${template.substring(0, 50)}...`);

    // Query RAG
    const results = await queryRagForLead({
      pitchId: leadId,
      sectionId,
      question: template,
      maxResults: 10,
    });

    console.error(`[Section API] RAG returned ${results.length} results`);

    // Calculate confidence
    const confidence = calculateConfidenceScore(results);

    // Raw mode: return without visualization (for debugging)
    if (rawMode) {
      const result: SectionQueryResult = {
        sectionId,
        results,
        confidence,
        status: results.length > 0 ? 'success' : 'no_data',
      };
      return NextResponse.json(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // AGENT-NATIVE PATH: Get directly stored visualization from agents
    // Agents now store visualizations directly via ragTools.storeVisualization()
    // ═══════════════════════════════════════════════════════════════════════════════
    const directViz = await getDirectVisualization(leadId, sectionId);
    if (directViz) {
      console.error(
        `[Section API] Found direct visualization for ${sectionId}, elements=${Object.keys(directViz.tree.elements || {}).length}`
      );
      const result: SynthesizedSectionResult = {
        sectionId,
        results, // Keep raw results for reference
        confidence: directViz.confidence,
        status: 'success',
        visualizationTree: directViz.tree,
        synthesisMethod: 'ai', // Agent-native is considered AI-generated
      };
      return NextResponse.json(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // NO VISUALIZATION: Return RAG data without visualization
    // The frontend can render a fallback or re-trigger analysis
    // ═══════════════════════════════════════════════════════════════════════════════
    if (results.length === 0) {
      console.error(`[Section API] No RAG data, returning no_data status`);
      const result: SynthesizedSectionResult = {
        sectionId,
        results: [],
        confidence: 0,
        status: 'no_data',
        errorMessage: 'Keine RAG-Daten für diese Sektion vorhanden',
      };
      return NextResponse.json(result);
    }

    // Return RAG results without visualization
    // This happens when agents haven't stored a visualization yet
    console.error(`[Section API] No visualization found for ${sectionId}, returning RAG data only`);
    const result: SynthesizedSectionResult = {
      sectionId,
      results,
      confidence,
      status: 'success',
      synthesisMethod: 'fallback', // Indicates no visualization available
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Section API] GET error:', error);
    const result: SynthesizedSectionResult = {
      sectionId: 'unknown',
      results: [],
      confidence: 0,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
    return NextResponse.json(result, { status: 500 });
  }
}
