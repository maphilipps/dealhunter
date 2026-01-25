/**
 * Deep Scan Start API Endpoint
 *
 * POST /api/qualifications/[id]/deep-scan/start
 * - Enqueue a new deep scan background job via BullMQ
 * - Returns immediately with job info for polling
 * - Returns 409 if a job is already running
 */

import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { addDeepScanJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, qualifications, users } from '@/lib/db/schema';
import { resetCheckpoints } from '@/lib/deep-scan/checkpoint';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leadId } = await params;

    // Parse request body for optional parameters
    let forceReset = false;
    let selectedExperts: string[] | undefined;
    try {
      const body = await request.json();
      forceReset = body.forceReset === true;
      selectedExperts = body.selectedExperts;
    } catch {
      // Empty body is fine
    }

    // Verify lead exists and get website URL
    const [lead] = await db
      .select({
        id: qualifications.id,
        preQualificationId: qualifications.preQualificationId,
        websiteUrl: qualifications.websiteUrl,
        deepScanStatus: qualifications.deepScanStatus,
        businessUnitId: qualifications.businessUnitId,
      })
      .from(qualifications)
      .where(eq(qualifications.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Authorization: Verify user has access to this lead's business unit
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Admins can access all leads; BL/BD must match business unit
    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only start scans for leads in your Business Unit' },
        { status: 403 }
      );
    }

    if (!lead.websiteUrl) {
      return NextResponse.json(
        { error: 'No website URL configured for this lead' },
        { status: 400 }
      );
    }

    // Check if a job is already running
    const [existingJob] = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.qualificationId, leadId),
          eq(backgroundJobs.jobType, 'deep-scan'),
          inArray(backgroundJobs.status, ['pending', 'running'])
        )
      )
      .limit(1);

    if (existingJob) {
      return NextResponse.json(
        {
          error: 'A deep scan is already running for this lead',
          jobId: existingJob.id,
          status: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Reset checkpoints if requested
    if (forceReset) {
      await resetCheckpoints(leadId);
    }

    // Create database job record
    const dbJobId = nanoid();
    await db.insert(backgroundJobs).values({
      id: dbJobId,
      jobType: 'deep-scan',
      status: 'pending',
      userId: session.user.id,
      preQualificationId: lead.preQualificationId,
      qualificationId: leadId,
      progress: 0,
      currentStep: 'Waiting in queue...',
      currentExpert: null,
      completedExperts: JSON.stringify([]),
      pendingExperts: selectedExperts ? JSON.stringify(selectedExperts) : null,
      sectionConfidences: JSON.stringify({}),
    });

    // Update lead status
    await db
      .update(qualifications)
      .set({ deepScanStatus: 'pending' })
      .where(eq(qualifications.id, leadId));

    // Enqueue BullMQ job
    const bullmqJob = await addDeepScanJob(
      {
        qualificationId: leadId,
        websiteUrl: lead.websiteUrl,
        userId: session.user.id,
        dbJobId,
        forceReset,
        selectedExperts,
      },
      dbJobId // Use same ID for correlation
    );

    // Update with BullMQ job ID
    await db
      .update(backgroundJobs)
      .set({ bullmqJobId: bullmqJob.id })
      .where(eq(backgroundJobs.id, dbJobId));

    return NextResponse.json({
      success: true,
      jobId: dbJobId,
      status: 'queued',
      pollUrl: `/api/qualifications/${leadId}/background-job`,
      message: 'Deep scan job queued successfully',
    });
  } catch (error) {
    console.error('[Deep Scan Start API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start deep scan' },
      { status: 500 }
    );
  }
}
