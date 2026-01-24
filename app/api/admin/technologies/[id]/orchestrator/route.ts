import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { runTechnologyResearchOrchestrator } from '@/lib/cms-matching/technology-research-orchestrator';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

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
    const body = await request.json();
    const featureNames: string[] = body.featureNames || [];

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
      writer.write(encoder.encode(data)).catch(console.error);
    };

    // Start Orchestrator in Background
    void (async () => {
      try {
        const result = await runTechnologyResearchOrchestrator(id, featureNames, {
          autoReview: body.autoReview ?? true,
          reviewMode: body.reviewMode || 'quick',
          maxConcurrency: body.maxConcurrency || 3,
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
