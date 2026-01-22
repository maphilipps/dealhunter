import { eq, and, or, like, desc, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { competitors, type NewCompetitor } from '@/lib/db/schema';

// ============================================================================
// Zod Schemas
// ============================================================================

const createCompetitorSchema = z.object({
  companyName: z.string().min(1).max(200),
  website: z.string().url().max(500).optional(),
  industry: z.array(z.string()).optional(),
  description: z.string().max(2000).optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  typicalMarkets: z.array(z.string()).optional(),
  encounterNotes: z
    .array(
      z.object({
        date: z.string(),
        opportunity: z.string(),
        outcome: z.string(),
        notes: z.string().optional(),
      })
    )
    .optional(),
});

const updateCompetitorSchema = createCompetitorSchema.partial().extend({
  id: z.string().min(1).max(50),
  version: z.number().int().min(1),
});

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ============================================================================
// GET /api/master-data/competitors
// ============================================================================

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error },
        { status: 400 }
      );
    }

    const { status, search, page = 1, limit = 50 } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (session.user.role !== 'admin') {
      conditions.push(eq(competitors.isValidated, true));
    }

    if (status) {
      conditions.push(eq(competitors.status, status));
    }

    if (search) {
      conditions.push(
        or(
          like(competitors.companyName, `%${search}%`),
          like(competitors.description, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalCount] = await Promise.all([
      db
        .select()
        .from(competitors)
        .where(whereClause)
        .orderBy(desc(competitors.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(competitors)
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
    console.error('GET /api/master-data/competitors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/master-data/competitors
// ============================================================================

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const newCompetitor: NewCompetitor = {
      ...parsed.data,
      industry: parsed.data.industry ? JSON.stringify(parsed.data.industry) : null,
      strengths: parsed.data.strengths ? JSON.stringify(parsed.data.strengths) : null,
      weaknesses: parsed.data.weaknesses ? JSON.stringify(parsed.data.weaknesses) : null,
      typicalMarkets: parsed.data.typicalMarkets
        ? JSON.stringify(parsed.data.typicalMarkets)
        : null,
      encounterNotes: parsed.data.encounterNotes
        ? JSON.stringify(parsed.data.encounterNotes)
        : null,
      userId: session.user.id,
      status: 'pending',
      isValidated: false,
    };

    const [created] = await db.insert(competitors).values(newCompetitor).returning();

    return NextResponse.json({ success: true, competitor: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/master-data/competitors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/master-data/competitors
// ============================================================================

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateCompetitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const { id, version, ...updates } = parsed.data;

    const [existing] = await db.select().from(competitors).where(eq(competitors.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: any = { ...updates, updatedAt: new Date(), version: existing.version + 1 };

    if (updates.industry) {
      updateData.industry = JSON.stringify(updates.industry);
    }
    if (updates.strengths) {
      updateData.strengths = JSON.stringify(updates.strengths);
    }
    if (updates.weaknesses) {
      updateData.weaknesses = JSON.stringify(updates.weaknesses);
    }
    if (updates.typicalMarkets) {
      updateData.typicalMarkets = JSON.stringify(updates.typicalMarkets);
    }
    if (updates.encounterNotes) {
      updateData.encounterNotes = JSON.stringify(updates.encounterNotes);
    }

    const [updated] = await db
      .update(competitors)
      .set(updateData)
      .where(and(eq(competitors.id, id), eq(competitors.version, version)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, competitor: updated });
  } catch (error) {
    console.error('PATCH /api/master-data/competitors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
