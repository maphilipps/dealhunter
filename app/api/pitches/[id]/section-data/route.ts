import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchSectionData, type NewPitchSectionData } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const createSectionDataSchema = z.object({
  sectionId: z.string().min(1).max(100),
  content: z.record(z.string(), z.unknown()),
  confidence: z.number().int().min(0).max(100).optional(),
  sources: z.array(z.record(z.string(), z.unknown())).optional(),
});

const querySchema = z.object({
  sectionId: z.string().optional(),
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
// GET /api/pitches/[id]/section-data
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

    const { sectionId } = parsed.data;

    // Build WHERE conditions
    const conditions = [eq(pitchSectionData.pitchId, pitchId)];
    if (sectionId) conditions.push(eq(pitchSectionData.sectionId, sectionId));

    const sections = await db
      .select()
      .from(pitchSectionData)
      .where(and(...conditions))
      .orderBy(desc(pitchSectionData.updatedAt));

    return NextResponse.json({ success: true, sections });
  } catch (error) {
    console.error('[GET /api/pitches/:id/section-data] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/pitches/[id]/section-data
// ============================================================================

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const body = (await request.json()) as unknown;
    const parsed = createSectionDataSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    // Check if section already exists (upsert behavior)
    const [existing] = await db
      .select()
      .from(pitchSectionData)
      .where(
        and(
          eq(pitchSectionData.pitchId, pitchId),
          eq(pitchSectionData.sectionId, parsed.data.sectionId)
        )
      );

    if (existing) {
      // Update existing section
      const [updated] = await db
        .update(pitchSectionData)
        .set({
          content: JSON.stringify(parsed.data.content),
          confidence: parsed.data.confidence ?? existing.confidence,
          sources: parsed.data.sources ? JSON.stringify(parsed.data.sources) : existing.sources,
          updatedAt: new Date(),
        })
        .where(eq(pitchSectionData.id, existing.id))
        .returning();

      return NextResponse.json({ success: true, section: updated, updated: true });
    }

    // Create new section
    const newSectionData: NewPitchSectionData = {
      pitchId,
      sectionId: parsed.data.sectionId,
      content: JSON.stringify(parsed.data.content),
      confidence: parsed.data.confidence ?? null,
      sources: parsed.data.sources ? JSON.stringify(parsed.data.sources) : null,
    };

    const [created] = await db.insert(pitchSectionData).values(newSectionData).returning();

    return NextResponse.json({ success: true, section: created, updated: false }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/pitches/:id/section-data] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
