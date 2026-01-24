import { NextRequest, NextResponse } from 'next/server';

import { synthesizeSectionData } from '@/lib/agents/section-synthesizer-agent';
import type { JsonRenderTree } from '@/lib/agents/section-synthesizer-agent';
import { auth } from '@/lib/auth';
import { getRAGQueryTemplate } from '@/lib/leads/navigation-config';
import { calculateConfidenceScore, queryRagForLead } from '@/lib/rag/lead-retrieval-service';
import type { LeadRAGResult, SectionQueryResult } from '@/lib/rag/lead-retrieval-service';

/**
 * Extended Section Query Result with visualization tree
 */
export interface SynthesizedSectionResult extends SectionQueryResult {
  visualizationTree?: JsonRenderTree;
  synthesisMethod?: 'ai' | 'fallback';
}

/**
 * GET /api/leads/[id]/sections/[sectionId]
 *
 * Fetch RAG data for a specific lead section and synthesize into visualization
 *
 * Query params:
 * - raw=true: Return raw RAG results without synthesis (for debugging)
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

    console.log(`[Section API] GET /leads/${leadId}/sections/${sectionId} (raw=${rawMode})`);

    // Get RAG query template for this section
    const template = getRAGQueryTemplate(sectionId);
    if (!template) {
      console.warn(`[Section API] No RAG template found for section ${sectionId}`);
      const result: SynthesizedSectionResult = {
        sectionId,
        results: [],
        confidence: 0,
        status: 'error',
        errorMessage: `No RAG template found for section ${sectionId}`,
      };
      return NextResponse.json(result, { status: 404 });
    }

    console.log(`[Section API] RAG template: ${template.substring(0, 50)}...`);

    // Query RAG
    const results = await queryRagForLead({
      leadId,
      sectionId,
      question: template,
      maxResults: 10,
    });

    console.log(`[Section API] RAG returned ${results.length} results`);

    // Calculate confidence
    const confidence = calculateConfidenceScore(results);

    // Raw mode: return without synthesis (for debugging)
    if (rawMode) {
      const result: SectionQueryResult = {
        sectionId,
        results,
        confidence,
        status: results.length > 0 ? 'success' : 'no_data',
      };
      return NextResponse.json(result);
    }

    // No results → return early with no_data status
    if (results.length === 0) {
      console.log(`[Section API] No RAG data, returning no_data status`);
      const result: SynthesizedSectionResult = {
        sectionId,
        results: [],
        confidence: 0,
        status: 'no_data',
        errorMessage: 'Keine RAG-Daten für diese Sektion vorhanden',
      };
      return NextResponse.json(result);
    }

    // Synthesize RAG results into visualization tree
    console.log(`[Section API] Synthesizing ${results.length} results...`);
    const synthesisResult = await synthesizeSectionData({
      sectionId,
      ragResults: results,
      leadId,
    });

    console.log(
      `[Section API] Synthesis complete: method=${synthesisResult.synthesisMethod}, hasTree=${!!synthesisResult.tree?.root}, elements=${Object.keys(synthesisResult.tree?.elements || {}).length}`
    );

    // Debug: Log full tree for cms-architecture
    if (sectionId === 'cms-architecture') {
      console.log(
        '[Section API] CMS-Architecture tree:',
        JSON.stringify(synthesisResult.tree, null, 2).substring(0, 500)
      );
    }

    const result: SynthesizedSectionResult = {
      sectionId,
      results, // Keep raw results for reference
      confidence: synthesisResult.confidence,
      status: 'success',
      visualizationTree: synthesisResult.tree,
      synthesisMethod: synthesisResult.synthesisMethod,
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
