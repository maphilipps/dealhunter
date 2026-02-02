import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { queryKnowledge } from '@/lib/pitch/rag/retrieval';

/**
 * GET /api/pitches/knowledge/search?query=...&cms=...&industry=...
 *
 * Search knowledge chunks via semantic similarity.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'query parameter is required' }, { status: 400 });
    }

    const filters: Record<string, string> = {};
    const cms = searchParams.get('cms');
    const industry = searchParams.get('industry');
    const documentType = searchParams.get('documentType');
    const businessUnit = searchParams.get('businessUnit');

    if (cms) filters.cms = cms;
    if (industry) filters.industry = industry;
    if (documentType) filters.documentType = documentType;
    if (businessUnit) filters.businessUnit = businessUnit;

    const topK = parseInt(searchParams.get('topK') ?? '10', 10);

    const chunks = await queryKnowledge({
      query,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      topK: Math.min(topK, 50),
    });

    return NextResponse.json({ success: true, chunks });
  } catch (error) {
    console.error('[GET /api/pitches/knowledge/search] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
