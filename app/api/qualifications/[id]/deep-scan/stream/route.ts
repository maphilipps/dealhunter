import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, qualifications } from '@/lib/db/schema';
import {
  createAgentEventStream,
  createSSEResponse,
  type EventEmitter,
} from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10 minutes for background status streaming

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function emitJobProgress(
  emit: EventEmitter,
  job: typeof backgroundJobs.$inferSelect,
  lastCompleted: Set<string>
) {
  const completedExperts = parseJson<string[]>(job.completedExperts) || [];
  const currentExpert = job.currentExpert || 'Processing';

  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: currentExpert,
      message: `Fortschritt ${job.progress}%`,
      progress: job.progress,
    },
  });

  for (const expert of completedExperts) {
    if (!lastCompleted.has(expert)) {
      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: { agent: expert, result: { status: 'completed' } },
      });
      lastCompleted.add(expert);
    }
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await params;

  const [lead] = await db
    .select({ id: qualifications.id })
    .from(qualifications)
    .where(eq(qualifications.id, id))
    .limit(1);

  if (!lead) {
    return new Response(JSON.stringify({ error: 'Lead not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = createAgentEventStream(async emit => {
    emit({ type: AgentEventType.START });

    const lastCompleted = new Set<string>();

    while (true) {
      const [job] = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.qualificationId, id),
            eq(backgroundJobs.jobType, 'deep-scan'),
            inArray(backgroundJobs.status, ['pending', 'running', 'completed', 'failed'])
          )
        )
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(1);

      if (!job) {
        emit({
          type: AgentEventType.ERROR,
          data: { message: 'Kein Deep Scan Job gefunden', code: 'JOB_NOT_FOUND' },
        });
        break;
      }

      if (job.status === 'pending') {
        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: { agent: 'DeepScan', message: 'Job wartet in der Queue...' },
        });
      }

      if (job.status === 'running') {
        emitJobProgress(emit, job, lastCompleted);
      }

      if (job.status === 'completed') {
        emitJobProgress(emit, job, lastCompleted);
        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'DeepScan',
            result: parseJson(job.result) || { status: 'completed' },
          },
        });
        break;
      }

      if (job.status === 'failed') {
        emit({
          type: AgentEventType.ERROR,
          data: {
            message: job.errorMessage || 'Deep Scan fehlgeschlagen',
            code: 'DEEP_SCAN_FAILED',
          },
        });
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

  return createSSEResponse(stream);
}
