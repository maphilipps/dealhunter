import { eq, desc, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, auditScanRuns, backgroundJobs } from '@/lib/db/schema';
import { loadCheckpoint } from '@/lib/pitch/checkpoints';
import { addPitchJob } from '@/lib/bullmq/queues';

function safeParseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('[answer] Failed to parse targetCmsIds:', raw);
    return [];
  }
}

/**
 * POST /api/pitches/[id]/answer
 *
 * Resumes a paused pipeline by providing the user's answer to a pending question.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    // Find the latest run waiting for user input
    const [run] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.pitchId, pitchId), eq(auditScanRuns.status, 'waiting_for_user')))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'No run waiting for user input' }, { status: 404 });
    }

    // Load checkpoint and verify pending question
    const checkpoint = await loadCheckpoint(run.id);
    if (!checkpoint?.pendingQuestion) {
      return NextResponse.json(
        { error: 'No pending question found in checkpoint' },
        { status: 400 }
      );
    }

    // Parse user answer from request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userAnswer } = body as { userAnswer: string };

    if (typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
      return NextResponse.json({ error: 'userAnswer must be a non-empty string' }, { status: 400 });
    }

    if (userAnswer.length > 5000) {
      return NextResponse.json(
        { error: 'userAnswer exceeds maximum length (5000 characters)' },
        { status: 400 }
      );
    }

    // Atomically claim the run to prevent double-submit
    const [updated] = await db
      .update(auditScanRuns)
      .set({ status: 'running' as const, updatedAt: new Date() })
      .where(and(eq(auditScanRuns.id, run.id), eq(auditScanRuns.status, 'waiting_for_user')))
      .returning({ id: auditScanRuns.id });

    if (!updated) {
      return NextResponse.json(
        { error: 'Run already resumed or no longer waiting for input' },
        { status: 409 }
      );
    }

    // Enqueue BullMQ job to resume the pipeline
    await addPitchJob({
      runId: run.id,
      pitchId,
      websiteUrl: lead.websiteUrl || '',
      userId: session.user.id,
      targetCmsIds: safeParseJsonArray(run.targetCmsIds),
      checkpointId: run.id,
      userAnswer,
    });

    // Update background job status back to processing
    await db
      .update(backgroundJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(
        and(
          eq(backgroundJobs.pitchId, pitchId),
          eq(backgroundJobs.jobType, 'pitch'),
          eq(backgroundJobs.status, 'pending')
        )
      );

    return NextResponse.json({ success: true, runId: run.id });
  } catch (error) {
    console.error('[POST /api/pitches/:id/answer] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
