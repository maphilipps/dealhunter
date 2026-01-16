import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { runQuickScanWithStreaming } from '@/lib/quick-scan/agent';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Quick Scan
 * Best practice: Use native Web Streams for real-time updates
 * Security: Requires authentication and bid ownership verification
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await context.params;

  try {
    // 2. Fetch bid data and verify ownership
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(and(eq(bidOpportunities.id, id), eq(bidOpportunities.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!bid.websiteUrl) {
      return new Response(JSON.stringify({ error: 'No website URL found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create SSE stream
    const stream = createAgentEventStream(async (emit) => {
      emit({ type: AgentEventType.START });

      // Run quick scan with streaming callbacks
      const result = await runQuickScanWithStreaming(
        {
          websiteUrl: bid.websiteUrl,
          extractedRequirements: bid.extractedRequirements,
        },
        emit
      );

      // Update database with result
      await db
        .update(bidOpportunities)
        .set({
          quickScanResults: JSON.stringify(result),
          updatedAt: new Date(),
        })
        .where(eq(bidOpportunities.id, id));
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('Quick scan stream error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
