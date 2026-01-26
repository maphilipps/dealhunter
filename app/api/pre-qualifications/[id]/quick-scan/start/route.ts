/**
 * Quick Scan Start API Endpoint
 *
 * POST /api/pre-qualifications/[id]/quick-scan/start
 * - Enqueue a new quick scan background job via BullMQ
 * - Returns immediately with job info for polling
 * - Returns 409 if a job is already running
 */

import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { addQuickScanJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications, quickScans } from '@/lib/db/schema';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preQualId } = await params;

    // Verify pre-qualification exists
    const [preQual] = await db
      .select({
        id: preQualifications.id,
        userId: preQualifications.userId,
        websiteUrl: preQualifications.websiteUrl,
        quickScanId: preQualifications.quickScanId,
      })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualId))
      .limit(1);

    if (!preQual) {
      return NextResponse.json({ error: 'Pre-qualification not found' }, { status: 404 });
    }

    // Check ownership
    if (preQual.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const websiteUrl = preQual.websiteUrl;
    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'No website URL configured for this pre-qualification' },
        { status: 400 }
      );
    }

    // Check if a job is already running
    const [existingJob] = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.preQualificationId, preQualId),
          eq(backgroundJobs.jobType, 'quick-scan'),
          inArray(backgroundJobs.status, ['pending', 'running'])
        )
      )
      .limit(1);

    if (existingJob) {
      return NextResponse.json(
        {
          error: 'A quick scan is already running for this pre-qualification',
          jobId: existingJob.id,
          status: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Get or create QuickScan record
    let quickScanId = preQual.quickScanId;
    if (!quickScanId) {
      quickScanId = nanoid();
      const [newQuickScan] = await db
        .insert(quickScans)
        .values({
          id: quickScanId,
          preQualificationId: preQualId,
          websiteUrl,
          status: 'pending',
        })
        .returning({ id: quickScans.id });

      if (newQuickScan) {
        await db
          .update(preQualifications)
          .set({ quickScanId: newQuickScan.id })
          .where(eq(preQualifications.id, preQualId));
      }
    }

    // Create database job record
    const dbJobId = nanoid();
    await db.insert(backgroundJobs).values({
      id: dbJobId,
      jobType: 'quick-scan',
      status: 'pending',
      userId: session.user.id,
      preQualificationId: preQualId,
      progress: 0,
      currentStep: 'Waiting in queue...',
    });

    // Enqueue BullMQ job
    const bullmqJob = await addQuickScanJob({
      preQualificationId: preQualId,
      quickScanId,
      websiteUrl,
      userId: session.user.id,
    });

    // Update with BullMQ job ID
    await db
      .update(backgroundJobs)
      .set({ bullmqJobId: bullmqJob.id })
      .where(eq(backgroundJobs.id, dbJobId));

    return NextResponse.json({
      success: true,
      jobId: dbJobId,
      status: 'queued',
      pollUrl: `/api/pre-qualifications/${preQualId}/background-job`,
      message: 'Quick scan job queued successfully',
    });
  } catch (error) {
    console.error('[Quick Scan Start API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start quick scan' },
      { status: 500 }
    );
  }
}
