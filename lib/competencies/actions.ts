'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { competencies } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';

export async function createCompetency(data: {
  name: string;
  category: 'technology' | 'methodology' | 'industry' | 'soft_skill';
  level: 'basic' | 'advanced' | 'expert';
  certifications?: string[];
  description?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const { name, category, level, certifications, description } = data;

  if (!name || !category || !level) {
    return { success: false, error: 'Alle Pflichtfelder müssen ausgefüllt werden' };
  }

  try {
    const [competency] = await db
      .insert(competencies)
      .values({
        userId: session.user.id,
        name: name.trim(),
        category,
        level,
        certifications:
          certifications && certifications.length > 0 ? JSON.stringify(certifications) : null,
        description: description?.trim() || null,
      })
      .returning();

    revalidatePath('/competencies');

    return {
      success: true,
      competencyId: competency.id,
    };
  } catch (error) {
    console.error('Competency creation error:', error);
    return { success: false, error: 'Erstellen der Kompetenz fehlgeschlagen' };
  }
}

export async function getCompetencies() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const allCompetencies = await db
      .select()
      .from(competencies)
      .orderBy(desc(competencies.createdAt));

    return {
      success: true,
      competencies: allCompetencies,
    };
  } catch (error) {
    console.error('Get competencies error:', error);
    return { success: false, error: 'Abrufen der Kompetenzen fehlgeschlagen' };
  }
}
