import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { addPreQualProcessingJob, getPreQualProcessingQueue } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, documents, preQualifications } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAILED_STATES = [
  'extraction_failed',
  'duplicate_check_failed',
  'qualification_scan_failed',
  'timeline_failed',
];

/**
 * POST /api/qualifications/[id]/retry
 *
 * Retries a failed PreQualification processing job.
 * Resets the status, creates a new background job, and re-queues for processing.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Verify ownership and failed status
    const [prequal] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));

    if (!prequal) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!FAILED_STATES.includes(prequal.status)) {
      return NextResponse.json(
        { error: 'Nur fehlgeschlagene Jobs können erneut gestartet werden' },
        { status: 400 }
      );
    }

    // Load associated documents for file data
    const docs = await db.select().from(documents).where(eq(documents.preQualificationId, id));

    // Avoid non-null assertions: build the list only from docs that actually have fileData.
    const files = docs.flatMap(d => {
      if (!d.fileData) return [];
      return [
        {
          name: d.fileName,
          base64: d.fileData,
          size: d.fileSize,
        },
      ];
    });

    // Create new background job
    const [qualificationJob] = await db
      .insert(backgroundJobs)
      .values({
        userId: session.user.id,
        jobType: 'qualification',
        status: 'pending',
        preQualificationId: id,
      })
      .returning();

    // Reset PreQualification status
    await db
      .update(preQualifications)
      .set({
        status: 'processing',
        agentErrors: null,
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, id));

    // Remove old BullMQ job (same jobId = preQualificationId would cause dedup)
    const queue = getPreQualProcessingQueue();
    const existingJob = await queue.getJob(id);
    if (existingJob) {
      await existingJob.remove();
    }

    // Determine if we can skip extraction (rawInput already populated)
    const hasExistingRequirements = Boolean(prequal.rawInput && prequal.rawInput.trim().length > 0);

    // Queue new processing job
    await addPreQualProcessingJob({
      preQualificationId: id,
      userId: session.user.id,
      backgroundJobId: qualificationJob.id,
      files,
      websiteUrls: prequal.websiteUrl ? [prequal.websiteUrl] : [],
      additionalText: '',
      enableDSGVO: true,
      useExistingRequirements: hasExistingRequirements,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Retry API] Error:', error);
    return NextResponse.json({ error: 'Fehler beim Neustart der Verarbeitung' }, { status: 500 });
  }
}
