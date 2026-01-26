/**
 * Selective Deep Scan Re-Run API Endpoint
 *
 * POST /api/qualifications/[id]/deep-scan/selective
 * - Re-run specific experts without full re-scan
 * - Automatically includes dependent synthesis experts
 * - Does NOT re-run scraping (uses existing RAG data)
 */

import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { addDeepScanJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, qualifications, users } from '@/lib/db/schema';
import { getDependentExperts } from '@/lib/deep-scan/expert-dependencies';
import { SECTION_TO_EXPERT, getExpertForSection } from '@/lib/deep-scan/section-expert-mapping';

/**
 * Given a list of section IDs, determine which experts need to run
 * and add dependent synthesis experts automatically.
 */
function resolveExpertsToRun(sectionIds: string[]): string[] {
  const expertsSet = new Set<string>();

  // Map sections to experts
  for (const sectionId of sectionIds) {
    const expert = getExpertForSection(sectionId);
    if (expert) {
      expertsSet.add(expert);
    }
  }

  // Add dependent synthesis experts
  // If any base expert is selected, add project + costs + decision
  const baseExperts = [
    'tech',
    'website',
    'performance',
    'architecture',
    'hosting',
    'integrations',
    'migration',
  ];
  const hasBaseExpert = baseExperts.some(e => expertsSet.has(e));

  if (hasBaseExpert) {
    // Get all experts that depend on any of the selected experts
    for (const expert of expertsSet) {
      const dependents = getDependentExperts(expert);
      for (const dep of dependents) {
        expertsSet.add(dep);
      }
    }
  }

  return Array.from(expertsSet);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leadId } = await params;

    // Parse request body
    let sectionIds: string[] = [];
    try {
      const body = (await request.json()) as { sectionIds?: unknown };
      const rawSectionIds = body.sectionIds;

      if (Array.isArray(rawSectionIds)) {
        sectionIds = rawSectionIds.filter((item): item is string => typeof item === 'string');
      }

      if (sectionIds.length === 0) {
        return NextResponse.json(
          { error: 'sectionIds must be a non-empty array of strings' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate section IDs
    const validSections = Object.keys(SECTION_TO_EXPERT);
    const invalidSections = sectionIds.filter(id => !validSections.includes(id));
    if (invalidSections.length > 0) {
      return NextResponse.json(
        { error: `Invalid section IDs: ${invalidSections.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify lead exists and get website URL
    const leads = await db
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

    // Check if lead has been scanned before (RAG data exists)
    if (lead.deepScanStatus !== 'completed' && lead.deepScanStatus !== 'failed') {
      return NextResponse.json(
        {
          error: 'Lead must have completed initial deep scan before selective re-scan',
          hint: 'Use /api/qualifications/[id]/deep-scan/start for initial scan',
        },
        { status: 400 }
      );
    }

    // Check if a job is already running
    const existingJobs = await db
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

    const existingJob = existingJobs[0];

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

    // Resolve which experts need to run
    const expertsToRun = resolveExpertsToRun(sectionIds);

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
      currentStep: 'Selective re-scan: Waiting in queue...',
      currentExpert: null,
      completedExperts: JSON.stringify([]),
      pendingExperts: JSON.stringify(expertsToRun),
      sectionConfidences: JSON.stringify({}),
    });

    // Update lead status
    await db
      .update(qualifications)
      .set({ deepScanStatus: 'pending' })
      .where(eq(qualifications.id, leadId));

    // Enqueue BullMQ job with selected experts
    const bullmqJob = await addDeepScanJob(
      {
        qualificationId: leadId,
        websiteUrl: lead.websiteUrl,
        userId: session.user.id,
        dbJobId,
        forceReset: false, // Never reset for selective scan
        selectedExperts: expertsToRun,
      },
      dbJobId
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
      pollUrl: `/api/qualifications/${leadId}/background-job?type=deep-scan`,
      message: 'Selective deep scan job queued successfully',
      expertsToRun,
      requestedSections: sectionIds,
    });
  } catch (error) {
    console.error('[Selective Deep Scan API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start selective deep scan' },
      { status: 500 }
    );
  }
}
