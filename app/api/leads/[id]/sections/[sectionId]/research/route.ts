import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import type { SectionQueryResult } from '@/lib/rag/lead-retrieval-service';

/**
 * POST /api/leads/[id]/sections/[sectionId]/research
 *
 * Trigger web research for a section to enrich RAG data
 *
 * NOTE: This is a placeholder for DEA-144 (Web Research Service)
 * For now, it returns a mock response
 */
export async function POST(
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

    // TODO (DEA-144): Implement Web Research Service
    // - Use Exa API (primary) or native Web Search (fallback)
    // - Chunk results and embed into RAG
    // - Track sources (URL, timestamp, query)
    // - Return updated section data

    console.warn(`[Web Research] Triggered for Lead ${leadId}, Section ${sectionId}`);

    // Mock response for now
    const result: SectionQueryResult = {
      sectionId,
      results: [],
      confidence: 0,
      status: 'error',
      errorMessage: 'Web Research Service not yet implemented (DEA-144)',
    };

    return NextResponse.json(result, { status: 501 }); // 501 Not Implemented
  } catch (error) {
    console.error('[Web Research API] POST error:', error);
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
