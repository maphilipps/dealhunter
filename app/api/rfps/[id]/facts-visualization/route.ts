import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, quickScans } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateFactsVisualizationWithAI } from '@/lib/json-render/visualization-agent';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

export const runtime = 'nodejs';

/**
 * GET /api/rfps/[id]/facts-visualization
 * Generate Facts Tab visualization from QuickScan and ExtractedData
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: bidId } = await context.params;

  try {
    // Get bid and verify ownership
    const [bid] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, bidId), eq(rfps.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Bid not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!bid.quickScanId) {
      return new Response(JSON.stringify({ error: 'No QuickScan found', tree: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get quick scan
    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, bid.quickScanId));

    if (!quickScan) {
      return new Response(JSON.stringify({ error: 'QuickScan not found', tree: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get extracted data from rfp
    let extractedData: ExtractedRequirements | null = null;
    if (bid.extractedRequirements) {
      try {
        extractedData = JSON.parse(bid.extractedRequirements) as ExtractedRequirements;
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Generate visualization tree with AI (full creative freedom)
    const tree = await generateFactsVisualizationWithAI(quickScan, extractedData);

    return new Response(JSON.stringify({ tree }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Facts visualization error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Facts visualization generation failed',
        tree: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
