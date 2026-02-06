import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, qualificationScans } from '@/lib/db/schema';
import { WorkflowEngine } from '@/lib/qualification-scan/workflow/engine';
import { qualificationScanSteps } from '@/lib/qualification-scan/workflow/steps';
import type { StepResult } from '@/lib/qualification-scan/workflow/types';

export const runtime = 'nodejs';

/**
 * POST /api/qualifications/[id]/qualification-scan/rescan
 *
 * Re-executes a single workflow step using cached results for dependencies.
 * Body: { stepId: string }
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { stepId?: string };

  if (!body.stepId || typeof body.stepId !== 'string') {
    return NextResponse.json({ error: 'stepId is required' }, { status: 400 });
  }

  const { stepId } = body;

  // Verify step exists in registry
  if (!qualificationScanSteps.has(stepId)) {
    return NextResponse.json({ error: `Unknown step: ${stepId}` }, { status: 400 });
  }

  try {
    // Fetch qualification and verify ownership
    const [qualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));

    if (!qualification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!qualification.qualificationScanId) {
      return NextResponse.json({ error: 'No qualification scan found' }, { status: 400 });
    }

    // Load the scan record
    const [scan] = await db
      .select()
      .from(qualificationScans)
      .where(eq(qualificationScans.id, qualification.qualificationScanId));

    if (!scan) {
      return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
    }

    if (!scan.websiteUrl) {
      return NextResponse.json({ error: 'No website URL in scan' }, { status: 400 });
    }

    // Build cached results from rawScanData
    const cachedResults = new Map<string, StepResult>();
    if (scan.rawScanData) {
      const rawData = JSON.parse(scan.rawScanData) as Record<
        string,
        { success: boolean; output?: unknown; duration?: number }
      >;
      for (const [key, value] of Object.entries(rawData)) {
        cachedResults.set(key, {
          stepId: key,
          success: value.success,
          output: value.output,
          duration: value.duration ?? 0,
        });
      }
    }

    // Create a simple emit function that collects events
    const events: Array<{ type: string; data: unknown }> = [];
    const emit = (event: { type: string; data?: unknown }) => {
      events.push({ type: event.type, data: event.data });
    };

    // Create engine and execute single step
    const engine = new WorkflowEngine({
      steps: qualificationScanSteps,
      emit,
      preQualificationId: id,
    });

    const result = await engine.executeSingleStep(
      stepId,
      {
        websiteUrl: scan.websiteUrl,
        bidId: qualification.id,
        preQualificationId: id,
      },
      scan.websiteUrl,
      cachedResults
    );

    // Update rawScanData with new result
    if (result.success && scan.rawScanData) {
      const rawData = JSON.parse(scan.rawScanData) as Record<string, unknown>;
      rawData[stepId] = {
        success: result.success,
        output: result.output,
        duration: result.duration,
      };
      await db
        .update(qualificationScans)
        .set({ rawScanData: JSON.stringify(rawData) })
        .where(eq(qualificationScans.id, scan.id));
    }

    return NextResponse.json({
      success: result.success,
      stepId: result.stepId,
      duration: result.duration,
      error: result.error,
      result: result.output,
    });
  } catch (error) {
    console.error('[Rescan] Error:', error);
    return NextResponse.json(
      {
        error: 'Rescan fehlgeschlagen',
      },
      { status: 500 }
    );
  }
}
