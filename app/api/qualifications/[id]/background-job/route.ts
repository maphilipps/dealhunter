import { eq, desc, and, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs, qualifications, users } from '@/lib/db/schema';

/**
 * GET /api/qualifications/[id]/background-job
 *
 * Fetch the latest background job for a lead
 * Used for real-time polling of job progress
 *
 * Query params:
 * - type: 'deep-scan' | 'deep-analysis' | undefined (filter by job type)
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
    const jobType = request.nextUrl.searchParams.get('type');

    // Verify lead exists
    const leads = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, leadId))
      .limit(1);

    const lead = leads[0];

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Authorization: Verify user has access to this lead's business unit
    const currentUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const currentUser = currentUsers[0];

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Admins can access all leads; BL/BD must match business unit
    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only access leads in your Business Unit' },
        { status: 403 }
      );
    }

    // Build query conditions
    // Search by qualificationId (new) or preQualificationId (legacy)
    const whereConditions = or(
      eq(backgroundJobs.qualificationId, leadId),
      eq(backgroundJobs.preQualificationId, lead.preQualificationId)
    );

    // Get latest background job for this lead
    const query = db
      .select()
      .from(backgroundJobs)
      .where(
        jobType
          ? and(
              whereConditions,
              eq(backgroundJobs.jobType, jobType as 'deep-scan' | 'deep-analysis')
            )
          : whereConditions
      )
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1);

    const jobs = await query;
    const latestJob = jobs[0];

    if (!latestJob) {
      return NextResponse.json({ job: null }, { status: 200 });
    }

    // Parse JSON fields for deep-scan jobs
    let completedExperts: string[] = [];
    let pendingExperts: string[] = [];
    let sectionConfidences: Record<string, number> = {};

    if (latestJob.jobType === 'deep-scan') {
      try {
        if (latestJob.completedExperts) {
          const parsed = JSON.parse(latestJob.completedExperts) as unknown;
          completedExperts = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        }
        if (latestJob.pendingExperts) {
          const parsed = JSON.parse(latestJob.pendingExperts) as unknown;
          pendingExperts = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        }
        if (latestJob.sectionConfidences) {
          const parsed = JSON.parse(latestJob.sectionConfidences) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            sectionConfidences = parsed as Record<string, number>;
          }
        }
      } catch {
        // JSON parse errors - use defaults
      }
    }

    // Determine current phase based on completed experts
    let currentPhase: 'scraping' | 'phase2' | 'phase3' | 'completed' = 'scraping';
    if (completedExperts.includes('scraper')) {
      currentPhase = 'phase2';
    }
    if (
      completedExperts.some(e =>
        [
          'tech',
          'website',
          'performance',
          'architecture',
          'hosting',
          'integrations',
          'migration',
        ].includes(e)
      )
    ) {
      currentPhase = 'phase2';
    }
    if (completedExperts.some(e => ['project', 'costs', 'decision'].includes(e))) {
      currentPhase = 'phase3';
    }
    if (latestJob.status === 'completed') {
      currentPhase = 'completed';
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
      // Deep scan specific fields
      currentExpert: latestJob.currentExpert,
      currentPhase,
      completedExperts,
      pendingExperts,
      sectionConfidences,
      bullmqJobId: latestJob.bullmqJobId,
    };

    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/qualifications/:id/background-job] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
