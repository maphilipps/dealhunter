import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const idSchema = z.object({
  id: z.string().min(1).max(50),
});

// ============================================================================
// GET /api/master-data/references/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parsed = idSchema.safeParse({ id });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const [reference] = await db
      .select()
      .from(references)
      .where(eq(references.id, parsed.data.id));

    if (!reference) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Non-admins can only see validated references
    if (session.user.role !== 'admin' && !reference.isValidated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ reference });
  } catch (error) {
    console.error('GET /api/master-data/references/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/master-data/references/[id]
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parsed = idSchema.safeParse({ id });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Check ownership
    const [existing] = await db
      .select()
      .from(references)
      .where(eq(references.id, parsed.data.id));

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.delete(references).where(eq(references.id, parsed.data.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/master-data/references/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
