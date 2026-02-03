import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, pitchDocuments } from '@/lib/db/schema';

// Next.js Route Segment Config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schemas
// ============================================================================

const idSchema = z.object({
  id: z.string().min(1).max(50),
  docId: z.string().min(1).max(50),
});

const updateDocumentSchema = z.object({
  content: z.string().optional(),
  fileData: z.string().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().min(0).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  flags: z.array(z.string()).optional(),
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
// GET /api/pitches/[id]/documents/[docId]
// ============================================================================

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
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

    const { id: pitchId, docId } = parsed.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [document] = await db
      .select()
      .from(pitchDocuments)
      .where(and(eq(pitchDocuments.id, docId), eq(pitchDocuments.pitchId, pitchId)));

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error('[GET /api/pitches/:id/documents/:docId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/pitches/[id]/documents/[docId]
// ============================================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
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

    const { id: pitchId, docId } = parsedParams.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Check document exists
    const [existing] = await db
      .select()
      .from(pitchDocuments)
      .where(and(eq(pitchDocuments.id, docId), eq(pitchDocuments.pitchId, pitchId)));

    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const parsed = updateDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.flags) {
      updateData.flags = JSON.stringify(parsed.data.flags);
    }

    const [updated] = await db
      .update(pitchDocuments)
      .set(updateData)
      .where(and(eq(pitchDocuments.id, docId), eq(pitchDocuments.pitchId, pitchId)))
      .returning();

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[PATCH /api/pitches/:id/documents/:docId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/pitches/[id]/documents/[docId]
// ============================================================================

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
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

    const { id: pitchId, docId } = parsed.data;

    const access = await checkPitchAccess(pitchId, session.user.id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Check document exists
    const [existing] = await db
      .select()
      .from(pitchDocuments)
      .where(and(eq(pitchDocuments.id, docId), eq(pitchDocuments.pitchId, pitchId)));

    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await db
      .delete(pitchDocuments)
      .where(and(eq(pitchDocuments.id, docId), eq(pitchDocuments.pitchId, pitchId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/pitches/:id/documents/:docId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
