'use server';

import { eq, and, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references, competencies, competitors } from '@/lib/db/schema';

// ============================================================================
// Authorization Middleware
// ============================================================================

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required');
  }
  return session;
}

// ============================================================================
// Get Pending Items (for Admin Queue)
// ============================================================================

export async function getPendingReferences(page = 1, limit = 50) {
  await requireAdmin();

  const offset = (page - 1) * limit;

  const [items, totalCount] = await Promise.all([
    db
      .select()
      .from(references)
      .where(eq(references.status, 'pending'))
      .orderBy(desc(references.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(references)
      .where(eq(references.status, 'pending')),
  ]);

  return {
    items,
    page,
    limit,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
  };
}

export async function getPendingCompetencies(page = 1, limit = 50) {
  await requireAdmin();

  const offset = (page - 1) * limit;

  const [items, totalCount] = await Promise.all([
    db
      .select()
      .from(competencies)
      .where(eq(competencies.status, 'pending'))
      .orderBy(desc(competencies.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(competencies)
      .where(eq(competencies.status, 'pending')),
  ]);

  return {
    items,
    page,
    limit,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
  };
}

export async function getPendingCompetitors(page = 1, limit = 50) {
  await requireAdmin();

  const offset = (page - 1) * limit;

  const [items, totalCount] = await Promise.all([
    db
      .select()
      .from(competitors)
      .where(eq(competitors.status, 'pending'))
      .orderBy(desc(competitors.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(competitors)
      .where(eq(competitors.status, 'pending')),
  ]);

  return {
    items,
    page,
    limit,
    totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
  };
}

// ============================================================================
// Validation Actions (Approve/Reject)
// ============================================================================

const idSchema = z.object({
  id: z.string().min(1).max(50),
});

const rejectSchema = z.object({
  id: z.string().min(1).max(50),
  feedback: z.string().min(1).max(1000),
});

// --- References ---

export async function approveReference(id: string) {
  const session = await requireAdmin();

  // VULN-001 FIX: Zod Validation
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    // VULN-002 FIX: Optimistic Locking
    const [reference] = await db.select().from(references).where(eq(references.id, parsed.data.id));

    if (!reference) {
      return { success: false, error: 'Nicht gefunden' };
    }

    const [updated] = await db
      .update(references)
      .set({
        status: 'approved',
        isValidated: true,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        version: reference.version + 1, // Increment version
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(references.id, parsed.data.id),
          eq(references.version, reference.version) // Optimistic lock check
        )
      )
      .returning();

    if (!updated) {
      // Conflict detected
      return { success: false, error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' };
    }

    revalidatePath('/admin/validations');
    revalidatePath('/references');
    return { success: true };
  } catch (error) {
    console.error('Approval error:', error);
    return { success: false, error: 'Genehmigung fehlgeschlagen' };
  }
}

export async function rejectReference(id: string, feedback: string) {
  const session = await requireAdmin();

  const parsed = rejectSchema.safeParse({ id, feedback });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    const [reference] = await db.select().from(references).where(eq(references.id, parsed.data.id));

    if (!reference) {
      return { success: false, error: 'Nicht gefunden' };
    }

    const [updated] = await db
      .update(references)
      .set({
        status: 'rejected',
        adminFeedback: parsed.data.feedback,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        version: reference.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(references.id, parsed.data.id), eq(references.version, reference.version)))
      .returning();

    if (!updated) {
      return { success: false, error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' };
    }

    revalidatePath('/admin/validations');
    return { success: true };
  } catch (error) {
    console.error('Rejection error:', error);
    return { success: false, error: 'Ablehnung fehlgeschlagen' };
  }
}

// --- Competencies ---

export async function approveCompetency(id: string) {
  const session = await requireAdmin();

  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    const [competency] = await db
      .select()
      .from(competencies)
      .where(eq(competencies.id, parsed.data.id));

    if (!competency) {
      return { success: false, error: 'Nicht gefunden' };
    }

    const [updated] = await db
      .update(competencies)
      .set({
        status: 'approved',
        isValidated: true,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        version: competency.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(competencies.id, parsed.data.id), eq(competencies.version, competency.version)))
      .returning();

    if (!updated) {
      return { success: false, error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' };
    }

    revalidatePath('/admin/validations');
    revalidatePath('/competencies');
    return { success: true };
  } catch (error) {
    console.error('Approval error:', error);
    return { success: false, error: 'Genehmigung fehlgeschlagen' };
  }
}

export async function rejectCompetency(id: string, feedback: string) {
  const session = await requireAdmin();

  const parsed = rejectSchema.safeParse({ id, feedback });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    const [competency] = await db
      .select()
      .from(competencies)
      .where(eq(competencies.id, parsed.data.id));

    if (!competency) {
      return { success: false, error: 'Nicht gefunden' };
    }

    const [updated] = await db
      .update(competencies)
      .set({
        status: 'rejected',
        adminFeedback: parsed.data.feedback,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        version: competency.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(competencies.id, parsed.data.id), eq(competencies.version, competency.version)))
      .returning();

    if (!updated) {
      return { success: false, error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' };
    }

    revalidatePath('/admin/validations');
    return { success: true };
  } catch (error) {
    console.error('Rejection error:', error);
    return { success: false, error: 'Ablehnung fehlgeschlagen' };
  }
}

// --- Competitors ---

export async function approveCompetitor(id: string) {
  const session = await requireAdmin();

  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    const [competitor] = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, parsed.data.id));

    if (!competitor) {
      return { success: false, error: 'Nicht gefunden' };
    }

    const [updated] = await db
      .update(competitors)
      .set({
        status: 'approved',
        isValidated: true,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        version: competitor.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(competitors.id, parsed.data.id), eq(competitors.version, competitor.version)))
      .returning();

    if (!updated) {
      return { success: false, error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' };
    }

    revalidatePath('/admin/validations');
    return { success: true };
  } catch (error) {
    console.error('Approval error:', error);
    return { success: false, error: 'Genehmigung fehlgeschlagen' };
  }
}

export async function rejectCompetitor(id: string, feedback: string) {
  const session = await requireAdmin();

  const parsed = rejectSchema.safeParse({ id, feedback });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    const [competitor] = await db
      .select()
      .from(competitors)
      .where(eq(competitors.id, parsed.data.id));

    if (!competitor) {
      return { success: false, error: 'Nicht gefunden' };
    }

    const [updated] = await db
      .update(competitors)
      .set({
        status: 'rejected',
        adminFeedback: parsed.data.feedback,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        version: competitor.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(competitors.id, parsed.data.id), eq(competitors.version, competitor.version)))
      .returning();

    if (!updated) {
      return { success: false, error: 'Daten wurden zwischenzeitlich geändert. Bitte neu laden.' };
    }

    revalidatePath('/admin/validations');
    return { success: true };
  } catch (error) {
    console.error('Rejection error:', error);
    return { success: false, error: 'Ablehnung fehlgeschlagen' };
  }
}
