/**
 * Background Job Status API Endpoint
 *
 * GET /api/pre-qualifications/[id]/background-job
 * - Returns the latest background job (quick-scan) for this pre-qualification
 * - Used for polling job status from the client
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications } from '@/lib/db/schema';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preQualId } = await params;

    // Verify pre-qualification exists and ownership
    const preQuals = await db
      .select({ id: preQualifications.id, userId: preQualifications.userId })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualId))
      .limit(1);

    const preQual = preQuals[0];

    if (!preQual) {
      return NextResponse.json({ error: 'Pre-qualification not found' }, { status: 404 });
    }

    if (preQual.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get latest quick-scan job for this pre-qualification
    const jobs = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.preQualificationId, preQualId),
          eq(backgroundJobs.jobType, 'quick-scan')
        )
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1);

    const job = jobs[0];

    if (!job) {
      return NextResponse.json({ job: null, message: 'No jobs found' });
    }

    // Parse result JSON safely
    let parsedResult: unknown = null;
    if (job.result) {
      try {
        parsedResult = JSON.parse(job.result) as unknown;
      } catch {
        parsedResult = null;
      }
    }

    // Return job status
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        errorMessage: job.errorMessage,
        result: parsedResult,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    console.error('[Background Job API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
