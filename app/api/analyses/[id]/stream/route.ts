import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyses } from '@/lib/db/schema';
import { assertValidUuid, RATE_LIMITS, checkRateLimit } from '@/lib/validation';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Type for stream updates
interface StreamUpdate {
  phase: string;
  progress: number;
  message: string;
  timestamp: string;
  agentActivities?: Array<{
    agentName: string;
    action: string;
    message: string;
    timestamp: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Rate limiting for stream endpoint (higher limit for polling)
  const rateLimitResult = await checkRateLimit(session.user.id, RATE_LIMITS.stream);
  if (!rateLimitResult.success) {
    return new Response('Too many requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
        'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
      },
    });
  }

  // UUID validation
  assertValidUuid(params.id, 'analysisId');

  const analysis = await db.query.analyses.findFirst({
    where: and(eq(analyses.id, params.id), eq(analyses.userId, session.user.id)),
  });

  if (!analysis) {
    return new Response('Not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let progress = analysis.progress;
      let status = analysis.status;
      let currentPhase = analysis.currentPhase;

      const sendUpdate = (data: StreamUpdate) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Initial state
      sendUpdate({
        phase: analysis.currentPhase || 'discovery',
        progress: analysis.progress,
        message: 'Analyse gestartet...',
        timestamp: new Date().toISOString(),
      });

      // Poll for updates (TODO: Replace with Redis Pub/Sub for Phase 1.5)
      const interval = setInterval(async () => {
        try {
          const updated = await db.query.analyses.findFirst({
            where: eq(analyses.id, params.id),
          });

          if (!updated) {
            clearInterval(interval);
            controller.close();
            return;
          }

          // Check for changes
          const hasChanges =
            updated.progress !== progress ||
            updated.status !== status ||
            updated.currentPhase !== currentPhase;

          if (hasChanges) {
            progress = updated.progress;
            status = updated.status;
            currentPhase = updated.currentPhase;

            sendUpdate({
              phase: updated.currentPhase || 'discovery',
              progress: updated.progress,
              message: `Phase: ${updated.currentPhase}`,
              timestamp: new Date().toISOString(),
            });
          }

          // Close on completion or failure
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(interval);
            sendUpdate({
              phase: updated.currentPhase || 'completed',
              progress: updated.progress,
              message: updated.status === 'completed' ? 'Analyse abgeschlossen' : 'Analyse fehlgeschlagen',
              timestamp: new Date().toISOString(),
            });
            controller.close();
          }
        } catch (error) {
          console.error('Stream poll error:', error);
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Cleanup after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 5 * 60 * 1000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
