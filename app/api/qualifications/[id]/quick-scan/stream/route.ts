import { eq, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { AI_TIMEOUTS } from '@/lib/ai/config';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, leadScans } from '@/lib/db/schema';
import {
  createAgentEventStream,
  createSSEResponse,
} from '@/lib/streaming/in-process/event-emitter';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Qualification Scan activity
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
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get the existing QualificationScan record
    if (!bid.qualificationScanId) {
      return new Response(JSON.stringify({ error: 'No Qualification found for this bid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [qualificationScan] = await db
      .select()
      .from(leadScans)
      .where(eq(leadScans.id, bid.qualificationScanId));

    if (!qualificationScan) {
      return new Response(JSON.stringify({ error: 'Qualification record not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!qualificationScan.websiteUrl) {
      return new Response(JSON.stringify({ error: 'No website URL in Qualification' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = createAgentEventStream(async emit => {
      emit({ type: AgentEventType.START });

      let lastCount = 0;
      let announcedRunning = false;

      // Timeout-Konstanten
      const startTime = Date.now();
      const MAX_STREAM_DURATION = AI_TIMEOUTS.SSE_STREAM;
      const POLL_INTERVAL = 2000;

      while (Date.now() - startTime < MAX_STREAM_DURATION) {
        const [latestQualificationScan] = await db
          .select()
          .from(leadScans)
          .where(eq(leadScans.id, qualificationScan.id))
          .limit(1);

        if (!latestQualificationScan) {
          emit({
            type: AgentEventType.ERROR,
            data: { message: 'Qualification record not found', code: 'NOT_FOUND' },
          });
          break;
        }

        const activityLog = latestQualificationScan.activityLog
          ? (JSON.parse(latestQualificationScan.activityLog) as Array<{
              timestamp: string;
              action: string;
              details?: string;
            }>)
          : [];

        if (!announcedRunning && ['pending', 'running'].includes(latestQualificationScan.status)) {
          emit({
            type: AgentEventType.AGENT_PROGRESS,
            data: {
              agent: 'Qualification',
              message: 'Qualification läuft im Hintergrund...',
            },
          });
          announcedRunning = true;
        }

        if (activityLog.length > lastCount) {
          const newEntries = activityLog.slice(lastCount);
          for (const entry of newEntries) {
            emit({
              type: AgentEventType.AGENT_PROGRESS,
              data: { agent: 'Qualification', message: entry.action, details: entry.details },
            });
          }
          lastCount = activityLog.length;
        }

        if (latestQualificationScan.status === 'completed') {
          emit({
            type: AgentEventType.AGENT_COMPLETE,
            data: {
              agent: 'Qualification',
              result: {
                recommendedBusinessUnit: latestQualificationScan.recommendedBusinessUnit,
                confidence: latestQualificationScan.confidence,
              },
            },
          });
          break;
        }

        if (latestQualificationScan.status === 'failed') {
          emit({
            type: AgentEventType.ERROR,
            data: {
              message: 'Qualification fehlgeschlagen',
              code: 'QUICK_SCAN_FAILED',
            },
          });
          break;
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }

      // Check if we actually timed out (vs exited due to completed/failed status)
      const timedOut = Date.now() - startTime >= MAX_STREAM_DURATION;
      if (timedOut) {
        emit({
          type: AgentEventType.ERROR,
          data: {
            message: 'Qualification hat das Zeitlimit überschritten (10 Minuten)',
            code: 'STREAM_TIMEOUT',
          },
        });
      }
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('Quick scan stream error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
