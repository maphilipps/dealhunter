import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { backgroundJobs, rfps } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

/**
 * GET /api/jobs - List background jobs for current user
 * Query params:
 * - rfpId: Filter by RFP ID
 * - jobType: Filter by job type (deep-analysis, team-notification, cleanup)
 * - status: Filter by status (pending, running, completed, failed, cancelled)
 * - limit: Max results (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rfpId = searchParams.get('rfpId');
    const jobType = searchParams.get('jobType');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query conditions
    const conditions = [eq(backgroundJobs.userId, session.user.id)];

    if (rfpId) {
      conditions.push(eq(backgroundJobs.rfpId, rfpId));
    }

    if (jobType) {
      conditions.push(eq(backgroundJobs.jobType, jobType as any));
    }

    if (status) {
      conditions.push(eq(backgroundJobs.status, status as any));
    }

    // Fetch jobs with RFP details
    const jobs = await db
      .select({
        job: backgroundJobs,
        rfp: rfps,
      })
      .from(backgroundJobs)
      .leftJoin(rfps, eq(backgroundJobs.rfpId, rfps.id))
      .where(and(...conditions))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit);

    return NextResponse.json({
      jobs: jobs.map(({ job, rfp }) => ({
        ...job,
        rfp: rfp ? {
          id: rfp.id,
          status: rfp.status,
          websiteUrl: rfp.websiteUrl,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
