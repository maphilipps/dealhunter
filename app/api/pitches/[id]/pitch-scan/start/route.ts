import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, auditScanRuns, technologies } from '@/lib/db/schema';
import { runPitchScanOrchestrator } from '@/lib/pitch-scan/orchestrator';
import {
  createAgentEventStream,
  createSSEResponse,
} from '@/lib/streaming/in-process/event-emitter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min

const startSchema = z.object({
  targetCmsIds: z.array(z.string()).optional(),
});

/**
 * POST /api/pitches/[id]/pitch-scan/start
 *
 * Starts a new audit scan run. Creates the run record and launches the orchestrator.
 * Returns SSE stream with real-time progress events.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    // Verify pitch exists and user has access
    const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
    if (!pitch) {
      return NextResponse.json({ error: 'Pitch nicht gefunden' }, { status: 404 });
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (!currentUser) {
      return NextResponse.json({ error: 'User nicht gefunden' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== pitch.businessUnitId) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Pitch' }, { status: 403 });
    }

    // Parse body
    const body = await request.json().catch(() => ({}));
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Parameter', details: parsed.error },
        { status: 400 }
      );
    }

    // Resolve target CMS IDs — default to all BU technologies
    let targetCmsIds = parsed.data.targetCmsIds ?? [];
    if (targetCmsIds.length === 0) {
      const buTechs = await db
        .select({ id: technologies.id })
        .from(technologies)
        .where(eq(technologies.businessUnitId, pitch.businessUnitId));
      targetCmsIds = buTechs.map(t => t.id);
    }

    // Count existing runs for run number
    const existingRuns = await db
      .select({ id: auditScanRuns.id })
      .from(auditScanRuns)
      .where(eq(auditScanRuns.pitchId, pitchId));

    // Create run record
    const [run] = await db
      .insert(auditScanRuns)
      .values({
        pitchId,
        userId: session.user.id,
        status: 'pending',
        runNumber: existingRuns.length + 1,
        targetCmsIds: JSON.stringify(targetCmsIds),
        progress: 0,
        startedAt: new Date(),
      })
      .returning();

    // Update pitch status
    await db
      .update(pitches)
      .set({ status: 'audit_scanning', updatedAt: new Date() })
      .where(eq(pitches.id, pitchId));

    // Create SSE stream and launch orchestrator
    const stream = createAgentEventStream(async emit => {
      await runPitchScanOrchestrator(
        {
          runId: run.id,
          pitchId,
          websiteUrl: pitch.websiteUrl ?? '',
          targetCmsIds,
        },
        emit
      );
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('[POST /api/pitches/:id/pitch-scan/start] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
