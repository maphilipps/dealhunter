import { eq, desc, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, preQualifications } from '@/lib/db/schema';

type BackgroundJobType = 'deep-analysis' | 'team-notification' | 'cleanup';
type BackgroundJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

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
    const jobType = searchParams.get('jobType') as BackgroundJobType | null;
    const status = searchParams.get('status') as BackgroundJobStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query conditions
    const conditions = [eq(backgroundJobs.userId, session.user.id)];

    if (rfpId) {
      conditions.push(eq(backgroundJobs.preQualificationId, rfpId));
    }

    if (jobType) {
      conditions.push(eq(backgroundJobs.jobType, jobType));
    }

    if (status) {
      conditions.push(eq(backgroundJobs.status, status));
    }

    // Fetch jobs with RFP details
    const jobs = await db
      .select({
        job: backgroundJobs,
        rfp: preQualifications,
      })
      .from(backgroundJobs)
      .leftJoin(preQualifications, eq(backgroundJobs.preQualificationId, preQualifications.id))
      .where(and(...conditions))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit);

    return NextResponse.json({
      jobs: jobs.map(({ job, rfp }) => ({
        ...job,
        rfp: rfp
          ? {
              id: rfp.id,
              status: rfp.status,
              websiteUrl: rfp.websiteUrl,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
