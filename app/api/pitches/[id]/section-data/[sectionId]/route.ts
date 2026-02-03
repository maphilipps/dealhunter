import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchSectionData } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const idSchema = z.object({
  id: z.string().min(1).max(50),
  sectionId: z.string().min(1).max(100),
});

const updateSectionDataSchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  sources: z.array(z.record(z.string(), z.unknown())).optional(),
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
// GET /api/pitches/[id]/section-data/[sectionId]
// ============================================================================

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
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

    const { id: pitchId, sectionId } = parsed.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [section] = await db
      .select()
      .from(pitchSectionData)
      .where(and(eq(pitchSectionData.pitchId, pitchId), eq(pitchSectionData.sectionId, sectionId)));

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, section });
  } catch (error) {
    console.error('[GET /api/pitches/:id/section-data/:sectionId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/pitches/[id]/section-data/[sectionId]
// ============================================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
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

    const { id: pitchId, sectionId } = parsedParams.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Check section exists
    const [existing] = await db
      .select()
      .from(pitchSectionData)
      .where(and(eq(pitchSectionData.pitchId, pitchId), eq(pitchSectionData.sectionId, sectionId)));

    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const parsed = updateSectionDataSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (parsed.data.content) {
      updateData.content = JSON.stringify(parsed.data.content);
    }
    if (parsed.data.confidence !== undefined) {
      updateData.confidence = parsed.data.confidence;
    }
    if (parsed.data.sources) {
      updateData.sources = JSON.stringify(parsed.data.sources);
    }

    const [updated] = await db
      .update(pitchSectionData)
      .set(updateData)
      .where(and(eq(pitchSectionData.pitchId, pitchId), eq(pitchSectionData.sectionId, sectionId)))
      .returning();

    return NextResponse.json({ success: true, section: updated });
  } catch (error) {
    console.error('[PATCH /api/pitches/:id/section-data/:sectionId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/pitches/[id]/section-data/[sectionId]
// ============================================================================

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
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

    const { id: pitchId, sectionId } = parsed.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Check section exists
    const [existing] = await db
      .select()
      .from(pitchSectionData)
      .where(and(eq(pitchSectionData.pitchId, pitchId), eq(pitchSectionData.sectionId, sectionId)));

    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    await db
      .delete(pitchSectionData)
      .where(and(eq(pitchSectionData.pitchId, pitchId), eq(pitchSectionData.sectionId, sectionId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pitches/:id/section-data/:sectionId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
