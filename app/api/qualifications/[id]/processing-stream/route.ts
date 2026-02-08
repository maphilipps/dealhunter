import { eq, and, desc } from 'drizzle-orm';
import Redis from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications, users } from '@/lib/db/schema';
import {
  QualificationEventType,
  type QualificationProcessingEvent,
} from '@/lib/streaming/qualification-events';
import { getQualificationEvents } from '@/lib/streaming/qualification-publisher';
import { REDIS_URL } from '@/lib/streaming/redis-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/qualifications/[id]/processing-stream
 *
 * Streams SSE events for real-time qualification processing progress via Redis pub/sub.
 * Falls back to replaying stored events for completed/failed jobs.
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

    const { id: qualificationId } = await context.params;

    // Verify qualification exists and check ownership
    const [prequal] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, qualificationId))
      .limit(1);

    if (!prequal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Authorization: owner or admin
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && prequal.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the latest background job for this qualification
    const [job] = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.preQualificationId, qualificationId),
          eq(backgroundJobs.jobType, 'qualification')
        )
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: 'No processing job found' }, { status: 404 });
    }

    const isTerminal = ['completed', 'failed'].includes(job.status);

    // For terminal jobs: replay stored events and close
    if (isTerminal) {
      const storedEvents = await getQualificationEvents(qualificationId);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(`data: ${JSON.stringify({ type: 'connected', qualificationId })}\n\n`);

          if (storedEvents.length === 0) {
            const syntheticEvent: QualificationProcessingEvent = {
              type: QualificationEventType.COMPLETE,
              timestamp: Date.now(),
              progress: 100,
              data: { message: 'Verarbeitung abgeschlossen (Details nicht mehr verfügbar)' },
            };
            controller.enqueue(`data: ${JSON.stringify(syntheticEvent)}\n\n`);
          } else {
            for (const event of storedEvents) {
              controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
            }
          }

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

    // For active jobs: replay stored events, then stream live events via Redis pub/sub
    const subscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

    const cleanupSubscriber = async () => {
      try {
        await subscriber.unsubscribe();
        await subscriber.quit();
      } catch (err) {
        console.warn('[QualificationStream] Subscriber cleanup error:', err);
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        const channel = `qualification:processing:${qualificationId}`;

        // Heartbeat every 15s to keep connection alive behind proxies
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(': keepalive\n\n');
          } catch (err) {
            console.warn('[QualificationStream] Heartbeat failed:', err);
            clearInterval(heartbeat);
          }
        }, 15_000);

        // Cleanup on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          void cleanupSubscriber();
          try {
            controller.close();
          } catch (err) {
            console.warn('[QualificationStream] Close after abort failed:', err);
          }
        });

        subscriber.on('error', err => {
          console.error('[QualificationStream] Redis subscriber error:', err);
          clearInterval(heartbeat);
          try {
            const errorEvent: QualificationProcessingEvent = {
              type: QualificationEventType.ERROR,
              timestamp: Date.now(),
              data: { error: 'Streaming-Verbindung unterbrochen. Bitte Seite neu laden.' },
            };
            controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`);
          } catch {
            /* stream may be closed */
          }
          void cleanupSubscriber();
          try {
            controller.close();
          } catch (err) {
            console.warn('[QualificationStream] Close after error failed:', err);
          }
        });

        subscriber.on('message', (_ch: string, message: string) => {
          try {
            controller.enqueue(`data: ${message}\n\n`);
          } catch (err) {
            console.warn('[QualificationStream] Enqueue message failed:', err);
            clearInterval(heartbeat);
            void cleanupSubscriber();
          }
        });

        // Subscribe before replaying to avoid missing events
        await subscriber.subscribe(channel);

        // Send connected event
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected', qualificationId })}\n\n`);

        // Replay stored events so client has immediate state
        const storedEvents = await getQualificationEvents(qualificationId);
        for (const event of storedEvents) {
          try {
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
          } catch (err) {
            console.warn('[QualificationStream] Replay enqueue failed:', err);
            break;
          }
        }
      },
      cancel() {
        void cleanupSubscriber();
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
    console.error('[GET /api/qualifications/:id/processing-stream] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
