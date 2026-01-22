import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { competencies } from '@/lib/db/schema';

const idSchema = z.object({
  id: z.string().min(1).max(50),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const [competency] = await db
      .select()
      .from(competencies)
      .where(eq(competencies.id, parsed.data.id));

    if (!competency) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && !competency.isValidated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ competency });
  } catch (error) {
    console.error('GET /api/master-data/competencies/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const [existing] = await db
      .select()
      .from(competencies)
      .where(eq(competencies.id, parsed.data.id));

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.delete(competencies).where(eq(competencies.id, parsed.data.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/master-data/competencies/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
