import { createId } from '@paralleldrive/cuid2';
import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { addVisualizationJob, getVisualizationJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, dealEmbeddings, qualifications } from '@/lib/db/schema';
import { QUALIFICATION_NAVIGATION_SECTIONS } from '@/lib/qualifications/navigation-config';

/**
 * POST /api/qualifications/[id]/visualize-all
 *
 * Queue a background job to generate visualizations for ALL sections
 * that have RAG data but no visualization.
 *
 * Body:
 * - focusPrompt?: string - Common focus/refinement prompt for all visualizations
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: qualificationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const focusPrompt = body.focusPrompt as string | undefined;

    console.log(`[VisualizeAll API] POST /qualifications/${qualificationId}/visualize-all`, {
      focusPrompt: focusPrompt?.substring(0, 50),
    });

    // Verify qualification exists
    const qualification = await db.query.qualifications.findFirst({
      where: eq(qualifications.id, qualificationId),
    });

    if (!qualification) {
      return NextResponse.json({ error: 'Qualification not found' }, { status: 404 });
    }

    // Check if there's already a running visualization job
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: and(
        eq(backgroundJobs.qualificationId, qualificationId),
        eq(backgroundJobs.jobType, 'qualification'),
        eq(backgroundJobs.status, 'running')
      ),
    });

    if (existingJob) {
      return NextResponse.json({
        success: true,
        jobId: existingJob.id,
        status: 'already_running',
        message: 'Eine Visualisierungs-Generierung läuft bereits',
      });
    }

    // Create background job record
    const jobId = createId();
    await db.insert(backgroundJobs).values({
      id: jobId,
      userId: session.user.id,
      qualificationId,
      type: 'visualization',
      status: 'pending',
      progress: 0,
      metadata: JSON.stringify({ focusPrompt }),
      createdAt: new Date(),
    });

    // Add to BullMQ queue
    await addVisualizationJob({
      qualificationId,
      sectionIds: [], // Empty = process all missing
      userId: session.user.id,
      dbJobId: jobId,
      focusPrompt,
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      message: 'Visualisierungs-Generierung wurde gestartet',
    });
  } catch (error) {
    console.error('[VisualizeAll API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/qualifications/[id]/visualize-all
 *
 * Get status of visualization job and which sections have/need visualizations.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: qualificationId } = await context.params;

    // Check for running job
    const runningJob = await db.query.backgroundJobs.findFirst({
      where: and(
        eq(backgroundJobs.qualificationId, qualificationId),
        eq(backgroundJobs.type, 'visualization'),
        sql`status IN ('pending', 'running')`
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    // Get all section IDs
    const allSectionIds = QUALIFICATION_NAVIGATION_SECTIONS.flatMap(section => {
      const ids = [section.id];
      if (section.subsections) {
        ids.push(...section.subsections.map(sub => sub.id));
      }
      return ids;
    }).filter(id => id !== 'overview' && id !== 'executive-summary');

    const sectionStatus: { sectionId: string; hasRagData: boolean; hasVisualization: boolean }[] =
      [];

    for (const sectionId of allSectionIds) {
      const hasRagData = !!(await db.query.dealEmbeddings.findFirst({
        where: and(
          eq(dealEmbeddings.qualificationId, qualificationId),
          sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`,
          sql`chunk_type != 'visualization'`
        ),
      }));

      const hasVisualization = !!(await db.query.dealEmbeddings.findFirst({
        where: and(
          eq(dealEmbeddings.qualificationId, qualificationId),
          eq(dealEmbeddings.chunkType, 'visualization'),
          sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
        ),
      }));

      if (hasRagData) {
        sectionStatus.push({ sectionId, hasRagData, hasVisualization });
      }
    }

    const missingCount = sectionStatus.filter(s => !s.hasVisualization).length;

    return NextResponse.json({
      sections: sectionStatus,
      totalWithData: sectionStatus.length,
      missingVisualizations: missingCount,
      job: runningJob
        ? {
            id: runningJob.id,
            status: runningJob.status,
            progress: runningJob.progress,
          }
        : null,
    });
  } catch (error) {
    console.error('[VisualizeAll API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
