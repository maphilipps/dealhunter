import { NextRequest } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { runTechnologyResearchOrchestrator } from '@/lib/cms-matching/technology-research-orchestrator';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

const orchestratorRequestSchema = z.object({
  featureNames: z.array(z.string()),
  autoReview: z.boolean().optional(),
  reviewMode: z.enum(['quick', 'deep']).optional(),
  maxConcurrency: z.number().optional(),
});

/**
 * POST /api/admin/technologies/[id]/orchestrator
 *
 * Technology Research Orchestrator mit SSE Streaming
 *
 * Body:
 * - featureNames: string[] - Features zum Recherchieren
 * - autoReview?: boolean - Automatisch Review nach Research (default: true)
 * - reviewMode?: 'quick' | 'deep' - Review-Modus (default: 'quick')
 * - maxConcurrency?: number - Max parallele Agents (default: 3)
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    const parsed = orchestratorRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parsed.error.flatten() }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { featureNames, autoReview, reviewMode, maxConcurrency } = parsed.data;

    if (featureNames.length === 0) {
      return new Response(JSON.stringify({ error: 'featureNames ist erforderlich' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // SSE Stream Setup
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Event Emitter für Orchestrator
    const emit = (event: AgentEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      void writer.write(encoder.encode(data)).catch(console.error);
    };

    // Start Orchestrator in Background
    void (async () => {
      try {
        const result = await runTechnologyResearchOrchestrator(id, featureNames, {
          autoReview: autoReview ?? true,
          reviewMode: reviewMode ?? 'quick',
          maxConcurrency: maxConcurrency ?? 3,
          saveToDb: true,
          emit,
        });

        // Send final result
        emit({
          id: `result-${Date.now()}`,
          type: AgentEventType.AGENT_COMPLETE,
          timestamp: Date.now(),
          data: {
            agent: 'Orchestrator',
            message: 'Workflow abgeschlossen',
            result,
          },
        });
      } catch (error) {
        emit({
          id: `error-${Date.now()}`,
          type: AgentEventType.ERROR,
          timestamp: Date.now(),
          data: {
            message: error instanceof Error ? error.message : 'Orchestrator fehlgeschlagen',
            code: 'ORCHESTRATOR_ERROR',
          },
        });
      } finally {
        // Close stream
        emit({
          id: `done-${Date.now()}`,
          type: AgentEventType.COMPLETE,
          timestamp: Date.now(),
          data: { message: 'Stream beendet' },
        });
        writer.close().catch(console.error);
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Orchestrator error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Orchestrator fehlgeschlagen',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
