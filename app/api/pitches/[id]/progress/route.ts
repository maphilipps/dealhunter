import { eq, desc } from 'drizzle-orm';
import Redis from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchRuns } from '@/lib/db/schema';
import { buildSnapshotEvent } from '@/lib/pitch/checkpoints';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * GET /api/pitches/[id]/progress
 *
 * Streams SSE events for real-time pitch pipeline progress via Redis pub/sub.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    // Verify pitch exists
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Authorization
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only access leads in your Business Unit' },
        { status: 403 }
      );
    }

    // Find the latest run for this pitch
    const [run] = await db
      .select()
      .from(pitchRuns)
      .where(eq(pitchRuns.pitchId, pitchId))
      .orderBy(desc(pitchRuns.createdAt))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'No run found' }, { status: 404 });
    }

    const runId = run.id;
    const snapshot = buildSnapshotEvent(run);
    const isTerminal = ['completed', 'failed'].includes(run.status);

    // For terminal runs, send snapshot and close immediately (no Redis needed)
    if (isTerminal) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);
          controller.enqueue(`data: ${JSON.stringify(snapshot)}\n\n`);
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
          Connection: 'keep-alive',
        },
      });
    }

    // Set up SSE stream via Redis pub/sub for active runs
    const subscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const channel = `pitch:progress:${runId}`;

        // Heartbeat every 15s to keep connection alive behind proxies
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(': keepalive\n\n');
          } catch {
            clearInterval(heartbeat);
          }
        }, 15_000);

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          subscriber.disconnect();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });

        subscriber.on('error', err => {
          console.error('[Progress SSE] Redis subscriber error:', err);
          clearInterval(heartbeat);
          subscriber.disconnect();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });

        subscriber.on('message', (_ch: string, message: string) => {
          try {
            controller.enqueue(`data: ${message}\n\n`);
          } catch {
            clearInterval(heartbeat);
            subscriber.disconnect();
          }
        });

        await subscriber.subscribe(channel);

        // Send connected + DB snapshot so client has immediate state
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);
        controller.enqueue(`data: ${JSON.stringify(snapshot)}\n\n`);
      },
      cancel() {
        subscriber.disconnect();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[GET /api/pitches/:id/progress] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
