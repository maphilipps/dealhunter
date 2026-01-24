import { eq, and, or, like, desc, sql, type SQL } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { competencies, type NewCompetency } from '@/lib/db/schema';

// ============================================================================
// Zod Schemas
// ============================================================================

const createCompetencySchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['technology', 'methodology', 'industry', 'soft_skill']),
  level: z.enum(['basic', 'advanced', 'expert']),
  description: z.string().max(2000).optional(),
  certifications: z.array(z.string()).optional(),
});

const updateCompetencySchema = createCompetencySchema.partial().extend({
  id: z.string().min(1).max(50),
  version: z.number().int().min(1),
});

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  category: z.enum(['technology', 'methodology', 'industry', 'soft_skill']).optional(),
  level: z.enum(['basic', 'advanced', 'expert']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ============================================================================
// GET /api/master-data/competencies
// ============================================================================

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(_request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error },
        { status: 400 }
      );
    }

    const { status, category, level, search, page = 1, limit = 50 } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (session.user.role !== 'admin') {
      conditions.push(eq(competencies.isValidated, true));
    }

    if (status) {
      conditions.push(eq(competencies.status, status));
    }

    if (category) {
      conditions.push(eq(competencies.category, category));
    }

    if (level) {
      conditions.push(eq(competencies.level, level));
    }

    if (search) {
      const searchCondition = or(
        like(competencies.name, `%${search}%`),
        like(competencies.description, `%${search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalCount] = await Promise.all([
      db
        .select()
        .from(competencies)
        .where(whereClause)
        .orderBy(desc(competencies.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(competencies)
        .where(whereClause),
    ]);

    return NextResponse.json({
      items,
      page,
      limit,
      totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
      totalCount: totalCount[0]?.count || 0,
    });
  } catch (error) {
    console.error('GET /api/master-data/competencies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/master-data/competencies
// ============================================================================

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const parsed = createCompetencySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const newCompetency: NewCompetency = {
      ...parsed.data,
      certifications: parsed.data.certifications
        ? JSON.stringify(parsed.data.certifications)
        : null,
      userId: session.user.id,
      status: 'pending',
      isValidated: false,
    };

    const [created] = await db.insert(competencies).values(newCompetency).returning();

    return NextResponse.json({ success: true, competency: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/master-data/competencies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/master-data/competencies
// ============================================================================

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateCompetencySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const { id, version, ...updates } = parsed.data;

    const existing = (await db.select().from(competencies).where(eq(competencies.id, id)))[0];

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
      version: existing.version + 1,
    };

    if (updates.certifications) {
      updateData.certifications = JSON.stringify(updates.certifications);
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = (
      await db
        .update(competencies)
        .set(updateData)
        .where(and(eq(competencies.id, id), eq(competencies.version, version)))
        .returning()
    )[0];

    if (!updated) {
      return NextResponse.json(
        { error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, competency: updated });
  } catch (error) {
    console.error('PATCH /api/master-data/competencies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
