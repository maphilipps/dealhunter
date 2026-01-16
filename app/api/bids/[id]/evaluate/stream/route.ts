import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { runBitEvaluationWithStreaming } from '@/lib/bit-evaluation/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming BIT evaluation
 * Best practice: Use native Web Streams for real-time updates
 */
export async function GET(
  request: NextRequest,
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

    if (!bid.extractedRequirements) {
      return new Response(
        JSON.stringify({ error: 'No extracted requirements found' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create SSE stream
    const stream = createAgentEventStream(async (emit) => {
      emit({ type: AgentEventType.START });

      // Run evaluation with streaming callbacks
      const result = await runBitEvaluationWithStreaming(
        {
          bidId: bid.id,
          extractedRequirements: bid.extractedRequirements,
          quickScanResults: bid.quickScanResults,
        },
        emit
      );

      // Emit decision event
      emit({
        type: AgentEventType.DECISION,
        data: {
          decision: result.decision.decision === 'bit' ? 'BIT' : 'NO_BIT',
          overallScore: result.decision.scores.overall,
          confidence: result.decision.overallConfidence,
          reasoning: result.decision.executiveSummary,
          scores: {
            capability: result.decision.scores.capability,
            dealQuality: result.decision.scores.dealQuality,
            strategicFit: result.decision.scores.strategicFit,
            competition: result.decision.scores.winProbability,
          },
        },
      });

      // Update database with result
      await db
        .update(bidOpportunities)
        .set({
          bitEvaluation: result,
          status: 'bit_decided',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(bidOpportunities.id, id));
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('BIT evaluation stream error:', error);
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
