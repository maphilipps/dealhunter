import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, auditScanRuns } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const querySchema = z.object({
  status: z
    .enum([
      'pending',
      'running',
      'audit_complete',
      'generating',
      'waiting_for_user',
      'review',
      'completed',
      'failed',
    ])
    .optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ============================================================================
// Helper: Check Pitch Access
// ============================================================================

async function checkPitchAccess(pitchId: string, userId: string) {
  const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

  if (!pitch) {
    return { error: 'Pitch not found', status: 404 };
  }

  const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!currentUser) {
    return { error: 'User not found', status: 401 };
  }

  if (currentUser.role !== 'admin' && currentUser.businessUnitId !== pitch.businessUnitId) {
    return { error: 'Forbidden: You can only access pitches in your Business Unit', status: 403 };
  }

  return { pitch, currentUser };
}

// ============================================================================
// GET /api/pitches/[id]/runs
// ============================================================================

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error },
        { status: 400 }
      );
    }

    const { status, limit = 50 } = parsed.data;

    // Build WHERE conditions
    const conditions = [eq(auditScanRuns.pitchId, pitchId)];
    if (status) conditions.push(eq(auditScanRuns.status, status));

    const runs = await db
      .select({
        id: auditScanRuns.id,
        pitchId: auditScanRuns.pitchId,
        userId: auditScanRuns.userId,
        status: auditScanRuns.status,
        runNumber: auditScanRuns.runNumber,
        targetCmsIds: auditScanRuns.targetCmsIds,
        selectedCmsId: auditScanRuns.selectedCmsId,
        currentPhase: auditScanRuns.currentPhase,
        progress: auditScanRuns.progress,
        currentStep: auditScanRuns.currentStep,
        completedAgents: auditScanRuns.completedAgents,
        failedAgents: auditScanRuns.failedAgents,
        agentConfidences: auditScanRuns.agentConfidences,
        startedAt: auditScanRuns.startedAt,
        completedAt: auditScanRuns.completedAt,
        createdAt: auditScanRuns.createdAt,
        updatedAt: auditScanRuns.updatedAt,
      })
      .from(auditScanRuns)
      .where(and(...conditions))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(limit);

    return NextResponse.json({ success: true, runs });
  } catch (error) {
    console.error('[GET /api/pitches/:id/runs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
