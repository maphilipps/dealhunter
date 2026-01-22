import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getRAGQueryTemplate } from '@/lib/leads/navigation-config';
import { calculateConfidenceScore, queryRagForLead } from '@/lib/rag/lead-retrieval-service';
import type { SectionQueryResult } from '@/lib/rag/lead-retrieval-service';

/**
 * GET /api/leads/[id]/sections/[sectionId]
 *
 * Fetch RAG data for a specific lead section
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

    // Get RAG query template for this section
    const template = getRAGQueryTemplate(sectionId);
    if (!template) {
      const result: SectionQueryResult = {
        sectionId,
        results: [],
        confidence: 0,
        status: 'error',
        errorMessage: `No RAG template found for section ${sectionId}`,
      };
      return NextResponse.json(result, { status: 404 });
    }

    // Query RAG
    const results = await queryRagForLead({
      leadId,
      sectionId,
      question: template,
      maxResults: 10,
    });

    // Calculate confidence
    const confidence = calculateConfidenceScore(results);

    const result: SectionQueryResult = {
      sectionId,
      results,
      confidence,
      status: results.length > 0 ? 'success' : 'no_data',
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Section API] GET error:', error);
    const result: SectionQueryResult = {
      sectionId: 'unknown',
      results: [],
      confidence: 0,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
    return NextResponse.json(result, { status: 500 });
  }
}
