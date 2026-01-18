import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, quickScans } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateQuickScanVisualization } from '@/lib/json-render/visualization-agent';

export const runtime = 'nodejs';

/**
 * GET /api/rfps/[id]/visualization
 * Get cached visualization or return null
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    if (!bid || !bid.quickScanId) {
      return new Response(JSON.stringify({ tree: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get quick scan with cached visualization
    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, bid.quickScanId));

    if (!quickScan?.visualizationTree) {
      return new Response(JSON.stringify({ tree: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ tree: JSON.parse(quickScan.visualizationTree) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Visualization fetch error:', error);
    return new Response(JSON.stringify({ tree: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/rfps/[id]/visualization
 * Generate and cache a json-render visualization tree from Quick Scan results
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: bidId } = await context.params;

  try {
    const { results } = await request.json();

    if (!results) {
      return new Response(JSON.stringify({ error: 'Missing results' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Generate visualization using the expert agent
    const tree = await generateQuickScanVisualization(results);

    // Cache the visualization in the quick_scans table
    if (bid.quickScanId) {
      await db
        .update(quickScans)
        .set({ visualizationTree: JSON.stringify(tree) })
        .where(eq(quickScans.id, bid.quickScanId));
    }

    return new Response(JSON.stringify({ tree }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Visualization error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Visualization generation failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
