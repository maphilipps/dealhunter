import { eq, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, qualifications } from '@/lib/db/schema';

/**
 * GET /api/qualifications/[id]/background-job
 *
 * Fetch the latest background job for a lead
 * Used for real-time polling of job progress
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leadId } = await context.params;

    // Verify lead exists
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Get latest background job for this lead
    // Note: backgroundJobs.rfpId is nullable, so we need to handle that
    // For leads, we need to join via rfpId since backgroundJobs references rfps
    const [latestJob] = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.preQualificationId, lead.preQualificationId))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1);

    if (!latestJob) {
      return NextResponse.json({ job: null }, { status: 200 });
    }

    // Transform DB record to API response
    const job = {
      id: latestJob.id,
      jobType: latestJob.jobType,
      status: latestJob.status,
      progress: latestJob.progress,
      currentStep: latestJob.currentStep,
      errorMessage: latestJob.errorMessage,
      startedAt: latestJob.startedAt,
      completedAt: latestJob.completedAt,
    };

    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/qualifications/:id/background-job] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
