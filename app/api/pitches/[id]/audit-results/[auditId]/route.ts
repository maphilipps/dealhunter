import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchAuditResults } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const idSchema = z.object({
  id: z.string().min(1).max(50),
  auditId: z.string().min(1).max(50),
});

const updateAuditResultSchema = z.object({
  techStack: z.record(z.string(), z.unknown()).optional(),
  performance: z.record(z.string(), z.unknown()).optional(),
  accessibility: z.record(z.string(), z.unknown()).optional(),
  architecture: z.record(z.string(), z.unknown()).optional(),
  hosting: z.record(z.string(), z.unknown()).optional(),
  integrations: z.record(z.string(), z.unknown()).optional(),
  componentLibrary: z.record(z.string(), z.unknown()).optional(),
  screenshots: z.record(z.string(), z.unknown()).optional(),
  performanceScore: z.number().int().min(0).max(100).optional(),
  accessibilityScore: z.number().int().min(0).max(100).optional(),
  migrationComplexity: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  complexityScore: z.number().int().min(0).max(100).optional(),
  completedAt: z.coerce.date().optional(),
  generateShareToken: z.boolean().optional(),
  shareExpiresInDays: z.number().int().min(1).max(365).optional(),
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
// GET /api/pitches/[id]/audit-results/[auditId]
// ============================================================================

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const parsed = idSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { id: pitchId, auditId } = parsed.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [auditResult] = await db
      .select()
      .from(pitchAuditResults)
      .where(and(eq(pitchAuditResults.id, auditId), eq(pitchAuditResults.pitchId, pitchId)));

    if (!auditResult) {
      return NextResponse.json({ error: 'Audit result not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, auditResult });
  } catch (error) {
    console.error('[GET /api/pitches/:id/audit-results/:auditId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/pitches/[id]/audit-results/[auditId]
// ============================================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = idSchema.safeParse(params);

    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { id: pitchId, auditId } = parsedParams.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Check audit result exists
    const [existing] = await db
      .select()
      .from(pitchAuditResults)
      .where(and(eq(pitchAuditResults.id, auditId), eq(pitchAuditResults.pitchId, pitchId)));

    if (!existing) {
      return NextResponse.json({ error: 'Audit result not found' }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const parsed = updateAuditResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const { generateShareToken, shareExpiresInDays, ...updates } = parsed.data;

    const updateData: Record<string, unknown> = {};

    // Handle JSON fields
    if (updates.techStack) updateData.techStack = JSON.stringify(updates.techStack);
    if (updates.performance) updateData.performance = JSON.stringify(updates.performance);
    if (updates.accessibility) updateData.accessibility = JSON.stringify(updates.accessibility);
    if (updates.architecture) updateData.architecture = JSON.stringify(updates.architecture);
    if (updates.hosting) updateData.hosting = JSON.stringify(updates.hosting);
    if (updates.integrations) updateData.integrations = JSON.stringify(updates.integrations);
    if (updates.componentLibrary)
      updateData.componentLibrary = JSON.stringify(updates.componentLibrary);
    if (updates.screenshots) updateData.screenshots = JSON.stringify(updates.screenshots);

    // Handle scalar fields
    if (updates.performanceScore !== undefined)
      updateData.performanceScore = updates.performanceScore;
    if (updates.accessibilityScore !== undefined)
      updateData.accessibilityScore = updates.accessibilityScore;
    if (updates.migrationComplexity !== undefined)
      updateData.migrationComplexity = updates.migrationComplexity;
    if (updates.complexityScore !== undefined) updateData.complexityScore = updates.complexityScore;
    if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt;

    // Handle share token generation
    if (generateShareToken) {
      updateData.shareToken = createId();
      const expiresIn = shareExpiresInDays ?? 30;
      updateData.shareExpiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000);
    }

    const [updated] = await db
      .update(pitchAuditResults)
      .set(updateData)
      .where(and(eq(pitchAuditResults.id, auditId), eq(pitchAuditResults.pitchId, pitchId)))
      .returning();

    return NextResponse.json({ success: true, auditResult: updated });
  } catch (error) {
    console.error('[PATCH /api/pitches/:id/audit-results/:auditId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/pitches/[id]/audit-results/[auditId]
// ============================================================================

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const parsed = idSchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { id: pitchId, auditId } = parsed.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Check audit result exists
    const [existing] = await db
      .select()
      .from(pitchAuditResults)
      .where(and(eq(pitchAuditResults.id, auditId), eq(pitchAuditResults.pitchId, pitchId)));

    if (!existing) {
      return NextResponse.json({ error: 'Audit result not found' }, { status: 404 });
    }

    await db
      .delete(pitchAuditResults)
      .where(and(eq(pitchAuditResults.id, auditId), eq(pitchAuditResults.pitchId, pitchId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pitches/:id/audit-results/:auditId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
