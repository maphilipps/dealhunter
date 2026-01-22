import { eq, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { runBitEvaluationWithStreaming } from '@/lib/bit-evaluation/agent';
import { db } from '@/lib/db';
import { rfps } from '@/lib/db/schema';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming BIT evaluation
 * Best practice: Use native Web Streams for real-time updates
 * Security: Requires authentication and bid ownership verification
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
      .from(rfps)
      .where(and(eq(rfps.id, id), eq(rfps.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!bid.extractedRequirements) {
      return new Response(JSON.stringify({ error: 'No extracted requirements found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create SSE stream
    const stream = createAgentEventStream(async emit => {
      emit({ type: AgentEventType.START });

      // Capture version for optimistic locking
      const currentVersion = bid.version;

      // Run evaluation with streaming callbacks
      const result = await runBitEvaluationWithStreaming(
        {
          bidId: bid.id,
          extractedRequirements: bid.extractedRequirements,
          // quickScanResults is in separate quickScans table, not on bid object
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
          reasoning: result.decision.reasoning,
          scores: {
            capability: result.decision.scores.capability,
            dealQuality: result.decision.scores.dealQuality,
            strategicFit: result.decision.scores.strategicFit,
            competition: result.decision.scores.winProbability,
          },
        },
      });

      // Update database with result using optimistic locking
      const updated = await db
        .update(rfps)
        .set({
          decisionEvaluation: JSON.stringify(result),
          decision:
            result.decision.decision === 'bit'
              ? 'bid'
              : result.decision.decision === 'no_bit'
                ? 'no_bid'
                : 'pending',
          status: 'decision_made',
          version: currentVersion + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(rfps.id, id), eq(rfps.version, currentVersion)))
        .returning();

      // Check if update succeeded (version conflict detection)
      if (!updated || updated.length === 0) {
        throw new Error(
          'Bid was modified during evaluation. The evaluation has completed, but the results could not be saved due to concurrent changes. Please refresh the page and try again.'
        );
      }
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
