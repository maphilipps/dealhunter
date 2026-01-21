import { eq, and, or, like, desc, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references, type NewReference } from '@/lib/db/schema';

// ============================================================================
// Zod Schemas (VULN-001 Fix)
// ============================================================================

const createReferenceSchema = z.object({
  projectName: z.string().min(1).max(200),
  customerName: z.string().min(1).max(200),
  industry: z.string().min(1).max(100),
  technologies: z.array(z.string()).min(1),
  scope: z.string().min(1).max(2000),
  teamSize: z.number().int().min(1).max(1000),
  durationMonths: z.number().int().min(1).max(240),
  budgetRange: z.string().min(1).max(100),
  outcome: z.string().min(1).max(2000),
  highlights: z.array(z.string()).optional(),
});

const updateReferenceSchema = createReferenceSchema.partial().extend({
  id: z.string().min(1).max(50),
  version: z.number().int().min(1),
});

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'needs_revision']).optional(),
  industry: z.string().optional(),
  technology: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ============================================================================
// GET /api/master-data/references
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

    const { status, industry, technology, search, page = 1, limit = 50 } = parsed.data;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: any[] = [];

    // Only show validated references to non-admins
    if (session.user.role !== 'admin') {
      conditions.push(eq(references.isValidated, true));
    }

    if (status) {
      conditions.push(eq(references.status, status));
    }

    if (industry) {
      conditions.push(eq(references.industry, industry));
    }

    if (technology) {
      conditions.push(like(references.technologies, `%${technology}%`));
    }

    if (search) {
      conditions.push(
        or(
          like(references.projectName, `%${search}%`),
          like(references.customerName, `%${search}%`),
          like(references.scope, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalCount] = await Promise.all([
      db
        .select()
        .from(references)
        .where(whereClause)
        .orderBy(desc(references.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(references)
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
    console.error('GET /api/master-data/references error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST /api/master-data/references
// ============================================================================

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createReferenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const newReference: NewReference = {
      ...parsed.data,
      technologies: JSON.stringify(parsed.data.technologies),
      highlights: parsed.data.highlights ? JSON.stringify(parsed.data.highlights) : null,
      userId: session.user.id,
      status: 'pending',
      isValidated: false,
    };

    const [created] = await db.insert(references).values(newReference).returning();

    return NextResponse.json({ success: true, reference: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/master-data/references error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PATCH /api/master-data/references
// ============================================================================

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateReferenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 });
    }

    const { id, version, ...updates } = parsed.data;

    // Check ownership (admins can edit all, users can only edit their own pending items)
    const [existing] = await db.select().from(references).where(eq(references.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = { ...updates, updatedAt: new Date(), version: existing.version + 1 };

    if (updates.technologies) {
      updateData.technologies = JSON.stringify(updates.technologies);
    }
    if (updates.highlights) {
      updateData.highlights = JSON.stringify(updates.highlights);
    }

    // Optimistic locking
    const [updated] = await db
      .update(references)
      .set(updateData)
      .where(and(eq(references.id, id), eq(references.version, version)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, reference: updated });
  } catch (error) {
    console.error('PATCH /api/master-data/references error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
