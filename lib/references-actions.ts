'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { references } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';

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
  highlights: string[];
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

  if (!projectName || !customerName || !industry || !scope || !teamSize || !durationMonths || !budgetRange || !outcome) {
    return { success: false, error: 'Alle Pflichtfelder müssen ausgefüllt werden' };
  }

  try {
    const [reference] = await db
      .insert(references)
      .values({
        userId: session.user.id,
        projectName: projectName.trim(),
        customerName: customerName.trim(),
        industry: industry.trim(),
        technologies: JSON.stringify(technologies),
        scope: scope.trim(),
        teamSize,
        durationMonths,
        budgetRange: budgetRange.trim(),
        outcome: outcome.trim(),
        highlights: highlights.length > 0 ? JSON.stringify(highlights) : null,
      })
      .returning();

    revalidatePath('/references');

    return {
      success: true,
      referenceId: reference.id
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
    const allReferences = await db
      .select()
      .from(references)
      .orderBy(desc(references.createdAt));

    return {
      success: true,
      references: allReferences
    };
  } catch (error) {
    console.error('Get references error:', error);
    return { success: false, error: 'Abrufen der Referenzen fehlgeschlagen' };
  }
}

export async function getReference(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const reference = await db.query.references.findFirst({
      where: eq(references.id, id)
    });

    if (!reference) {
      return { success: false, error: 'Referenz nicht gefunden' };
    }

    return {
      success: true,
      reference
    };
  } catch (error) {
    console.error('Get reference error:', error);
    return { success: false, error: 'Abrufen der Referenz fehlgeschlagen' };
  }
}
