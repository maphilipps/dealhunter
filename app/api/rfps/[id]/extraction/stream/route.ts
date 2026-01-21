import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rfps } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { runExtractionWithStreaming } from '@/lib/extraction/agent';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Extraction activity
 * Best practice: Use native Web Streams for real-time updates
 * Security: Requires authentication and bid ownership verification
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    // 3. Check if already extracted
    if (bid.extractedRequirements && bid.status !== 'draft' && bid.status !== 'extracting') {
      // Already extracted - return the existing data as replay
      const stream = createAgentEventStream(async emit => {
        emit({ type: AgentEventType.START });

        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: { agent: 'Extraktion', message: 'Extraktion bereits abgeschlossen' },
        });

        const requirements = JSON.parse(bid.extractedRequirements!);
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Extraktion',
            result: requirements,
            confidence: requirements.confidenceScore,
          },
        });
      });

      return createSSEResponse(stream);
    }

    // 4. Update status to extracting
    await db
      .update(rfps)
      .set({
        status: 'extracting',
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, id));

    // 5. Create SSE stream for live updates
    const stream = createAgentEventStream(async emit => {
      emit({ type: AgentEventType.START });

      // Parse metadata if available
      const metadata = bid.metadata ? JSON.parse(bid.metadata) : {};

      // Run extraction with streaming callbacks
      const result = await runExtractionWithStreaming(
        {
          rawText: bid.rawInput,
          inputType: bid.inputType as 'pdf' | 'email' | 'freetext',
          metadata,
        },
        emit
      );

      if (result.success) {
        // Save extracted requirements and update status to reviewing
        await db
          .update(rfps)
          .set({
            extractedRequirements: JSON.stringify(result.requirements),
            status: 'reviewing',
            updatedAt: new Date(),
          })
          .where(eq(rfps.id, id));

        // Emit completion event
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Extraktion',
            result: result.requirements,
            confidence: result.requirements.confidenceScore,
          },
        });
      } else {
        // Update status back to draft on error
        await db
          .update(rfps)
          .set({
            status: 'draft',
            updatedAt: new Date(),
          })
          .where(eq(rfps.id, id));

        emit({
          type: AgentEventType.ERROR,
          data: {
            message: result.error || 'Extraktion fehlgeschlagen',
            code: 'EXTRACTION_ERROR',
          },
        });
      }
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('Extraction stream error:', error);
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
