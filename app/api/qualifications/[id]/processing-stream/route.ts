import { eq, and, desc } from 'drizzle-orm';
import Redis from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications, users } from '@/lib/db/schema';
import {
  QualificationEventType,
  type QualificationProcessingEvent,
} from '@/lib/streaming/redis/qualification-events';
import { getQualificationEvents } from '@/lib/streaming/redis/qualification-publisher';
import { REDIS_URL } from '@/lib/streaming/redis/redis-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
  Connection: 'keep-alive',
} as const;

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, { headers: SSE_HEADERS });
}

function safeClose(controller: ReadableStreamDefaultController, label: string) {
  try {
    controller.close();
  } catch (err) {
    console.warn(`[QualificationStream] Close failed (${label}):`, err);
  }
}

type MessageListener = (message: string) => void;
type ErrorListener = (error: unknown) => void;

type ChannelState = {
  listeners: Set<MessageListener>;
  subscribePromise: Promise<void> | null;
};

let sharedSubscriber: Redis | null = null;
const channelStates = new Map<string, ChannelState>();
const errorListeners = new Set<ErrorListener>();

function getOrCreateSubscriber(): Redis {
  if (sharedSubscriber) return sharedSubscriber;

  const subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });

  subscriber.on('message', (channel: string, message: string) => {
    const state = channelStates.get(channel);
    if (!state) return;
    for (const listener of state.listeners) {
      try {
        listener(message);
      } catch {
        /* isolate SSE listeners */
      }
    }
  });

  subscriber.on('error', err => {
    // Fan-out error to all active SSE clients.
    for (const listener of errorListeners) {
      try {
        listener(err);
      } catch {
        /* isolate SSE listeners */
      }
    }
  });

  sharedSubscriber = subscriber;
  return subscriber;
}

async function ensureSubscribed(channel: string): Promise<void> {
  const subscriber = getOrCreateSubscriber();

  let state = channelStates.get(channel);
  if (!state) {
    state = { listeners: new Set(), subscribePromise: null };
    channelStates.set(channel, state);
  }

  if (!state.subscribePromise) {
    state.subscribePromise = subscriber.subscribe(channel).then(() => undefined);
  }

  await state.subscribePromise;
}

async function addChannelListener(
  channel: string,
  onMessage: MessageListener,
  onError: ErrorListener
): Promise<() => Promise<void>> {
  await ensureSubscribed(channel);

  const state = channelStates.get(channel);
  if (!state) throw new Error(`Missing channel state after subscribe: ${channel}`);

  state.listeners.add(onMessage);
  errorListeners.add(onError);

  return async () => {
    state.listeners.delete(onMessage);
    errorListeners.delete(onError);

    if (state.listeners.size === 0) {
      channelStates.delete(channel);
      try {
        await sharedSubscriber?.unsubscribe(channel);
      } catch (err) {
        console.warn('[QualificationStream] Unsubscribe error:', err);
      }
    }
  };
}

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

          safeClose(controller, 'terminal');
        },
      });

      return sseResponse(stream);
    }

    // For active jobs: replay stored events, then stream live events via Redis pub/sub
    let cleanupListener: (() => Promise<void>) | null = null;

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
          void cleanupListener?.();
          safeClose(controller, 'abort');
        });

        const onRedisMessage: MessageListener = (message: string) => {
          try {
            controller.enqueue(`data: ${message}\n\n`);
          } catch (err) {
            console.warn('[QualificationStream] Enqueue message failed:', err);
            clearInterval(heartbeat);
            void cleanupListener?.();
          }
        };

        const onRedisError: ErrorListener = err => {
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
          void cleanupListener?.();
          safeClose(controller, 'error');
        };

        // Subscribe before replaying to avoid missing events
        cleanupListener = await addChannelListener(channel, onRedisMessage, onRedisError);

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
        // The abort handler covers normal disconnects, but cancel can happen in other cases.
        // Best-effort cleanup: per-stream listener removal.
        void cleanupListener?.();
      },
    });

    return sseResponse(stream);
  } catch (error) {
    console.error('[GET /api/qualifications/:id/processing-stream] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
