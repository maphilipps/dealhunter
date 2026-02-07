import { eq, desc, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, auditScanRuns, backgroundJobs } from '@/lib/db/schema';
import { updateRunStatus } from '@/lib/pitch/checkpoints';
import { addPitchJob } from '@/lib/bullmq/queues';

function safeParseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('[retry] Failed to parse targetCmsIds:', raw);
    return [];
  }
}

/**
 * POST /api/pitches/[id]/retry
 *
 * Retries a failed pitch pipeline run.
 */
export async function POST(
  _request: NextRequest,
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

    // Find the latest failed run
    const [run] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.pitchId, pitchId), eq(auditScanRuns.status, 'failed')))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: 'No failed run found' }, { status: 404 });
    }

    // Reset run status to pending
    await updateRunStatus(run.id, 'pending');

    // Create a new background job record
    const jobId = createId();
    await db.insert(backgroundJobs).values({
      id: jobId,
      jobType: 'pitch',
      pitchId,
      userId: session.user.id,
      status: 'pending',
      progress: 0,
      currentStep: 'Retrying pipeline...',
    });

    // Enqueue BullMQ job with forceReset
    const job = await addPitchJob({
      runId: run.id,
      pitchId,
      websiteUrl: lead.websiteUrl || '',
      userId: session.user.id,
      targetCmsIds: safeParseJsonArray(run.targetCmsIds),
      forceReset: true,
    });

    // Link bullmq job ID to background job
    await db
      .update(backgroundJobs)
      .set({ bullmqJobId: job.id, updatedAt: new Date() })
      .where(eq(backgroundJobs.id, jobId));

    return NextResponse.json({ success: true, runId: run.id });
  } catch (error) {
    console.error('[POST /api/pitches/:id/retry] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
