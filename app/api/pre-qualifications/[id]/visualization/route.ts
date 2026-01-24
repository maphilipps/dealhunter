import { eq, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, quickScans } from '@/lib/db/schema';
import { generateQuickScanVisualization } from '@/lib/json-render/visualization-agent';
import type { QuickScanResult } from '@/lib/quick-scan/agent';

const visualizationRequestSchema = z.object({
  results: z.custom<QuickScanResult>(data => {
    // Validation happens in the agent function
    return data !== null && typeof data === 'object';
  }),
});

export const runtime = 'nodejs';

/**
 * GET /api/pre-qualifications/[id]/visualization
 * Get cached visualization or return null
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
      .from(preQualifications)
      .where(and(eq(preQualifications.id, bidId), eq(preQualifications.userId, session.user.id)));

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

    const visualizationTree = JSON.parse(quickScan.visualizationTree) as Record<string, unknown>;
    return new Response(JSON.stringify({ tree: visualizationTree }), {
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
 * POST /api/pre-qualifications/[id]/visualization
 * Generate and cache a json-render visualization tree from Quick Scan results
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const body = (await request.json()) as unknown;
    const parsed = visualizationRequestSchema.safeParse(body);

    if (!parsed.success || !parsed.data.results) {
      return new Response(JSON.stringify({ error: 'Missing results' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { results } = parsed.data as { results: QuickScanResult };

    // Get bid and verify ownership
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, bidId), eq(preQualifications.userId, session.user.id)));

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
