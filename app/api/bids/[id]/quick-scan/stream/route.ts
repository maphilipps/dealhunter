import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { runQuickScanWithStreaming } from '@/lib/quick-scan/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Quick Scan
 * Best practice: Use native Web Streams for real-time updates
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    // Fetch bid data
    const [bid] = await db.select().from(bidOpportunities).where(eq(bidOpportunities.id, id));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Bid not found' }), {
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
