'use server';

import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references } from '@/lib/db/schema';

export async function createReference(data: {
  projectName: string;
  customerName: string;
  industry: string;
  technologies: string[];
  scope: string;
  teamSize: number;
  durationMonths: number;
  budgetRange: string;
  outcome: string;
  highlights?: string[];
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const {
    projectName,
    customerName,
    industry,
    technologies,
    scope,
    teamSize,
    durationMonths,
    budgetRange,
    outcome,
    highlights,
  } = data;

  // Validate required fields
  if (!projectName || !customerName || !industry || !scope || !budgetRange || !outcome) {
    return { success: false, error: 'Alle Pflichtfelder müssen ausgefüllt werden' };
  }

  if (!technologies || technologies.length === 0) {
    return { success: false, error: 'Mindestens eine Technologie muss angegeben werden' };
  }

  if (teamSize <= 0) {
    return { success: false, error: 'Teamgröße muss größer als 0 sein' };
  }

  if (durationMonths <= 0) {
    return { success: false, error: 'Dauer muss größer als 0 sein' };
  }

  try {
    const [reference] = await db
      .insert(references)
      .values({
        userId: session.user.id,
        projectName,
        customerName,
        industry,
        technologies: JSON.stringify(technologies),
        scope,
        teamSize,
        durationMonths,
        budgetRange,
        outcome,
        highlights: highlights ? JSON.stringify(highlights) : null,
        isValidated: false,
      })
      .returning();

    revalidatePath('/references');
    revalidatePath('/admin/references');

    return {
      success: true,
      referenceId: reference.id,
    };
  } catch (error) {
    console.error('Reference creation error:', error);
    return { success: false, error: 'Erstellen der Referenz fehlgeschlagen' };
  }
}

export async function getReferences() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    let userReferences;

    if (session.user.role === 'admin') {
      // Admin sees all references
      userReferences = await db.select().from(references).orderBy(desc(references.createdAt));
    } else {
      // Other users see only their own references
      userReferences = await db
        .select()
        .from(references)
        .where(eq(references.userId, session.user.id))
        .orderBy(desc(references.createdAt));
    }

    return {
      success: true,
      references: userReferences,
    };
  } catch (error) {
    console.error('Get references error:', error);
    return { success: false, error: 'Abrufen der Referenzen fehlgeschlagen' };
  }
}

export async function getPendingReferences() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Only admins can view pending references
  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    const pendingReferences = await db
      .select()
      .from(references)
      .where(eq(references.isValidated, false))
      .orderBy(desc(references.createdAt));

    return {
      success: true,
      references: pendingReferences,
    };
  } catch (error) {
    console.error('Get pending references error:', error);
    return { success: false, error: 'Abrufen der ausstehenden Referenzen fehlgeschlagen' };
  }
}

export async function validateReference(referenceId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Only admins can validate references
  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    const [updatedReference] = await db
      .update(references)
      .set({
        isValidated: true,
        validatedByUserId: session.user.id,
        validatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(references.id, referenceId))
      .returning();

    if (!updatedReference) {
      return { success: false, error: 'Referenz nicht gefunden' };
    }

    revalidatePath('/admin/references');
    revalidatePath('/references');

    return {
      success: true,
      reference: updatedReference,
    };
  } catch (error) {
    console.error('Validate reference error:', error);
    return { success: false, error: 'Validieren fehlgeschlagen' };
  }
}

export async function getReferenceById(referenceId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const [reference] = await db
      .select()
      .from(references)
      .where(eq(references.id, referenceId))
      .limit(1);

    if (!reference) {
      return { success: false, error: 'Referenz nicht gefunden' };
    }

    return {
      success: true,
      reference,
    };
  } catch (error) {
    console.error('Get reference error:', error);
    return { success: false, error: 'Abrufen der Referenz fehlgeschlagen' };
  }
}
