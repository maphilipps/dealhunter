'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { technologies, businessLines } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getTechnologies() {
  try {
    const tech = await db
      .select({
        id: technologies.id,
        name: technologies.name,
        baselineHours: technologies.baselineHours,
        baselineName: technologies.baselineName,
        baselineEntityCounts: technologies.baselineEntityCounts,
        isDefault: technologies.isDefault,
        createdAt: technologies.createdAt,
        businessLineId: technologies.businessLineId,
        businessLineName: businessLines.name,
      })
      .from(technologies)
      .leftJoin(businessLines, eq(technologies.businessLineId, businessLines.id))
      .orderBy(technologies.createdAt);

    return { success: true, technologies: tech };
  } catch (error) {
    console.error('Error fetching technologies:', error);
    return { success: false, error: 'Fehler beim Laden der Technologien' };
  }
}

export async function getBusinessLinesForSelect() {
  try {
    const lines = await db
      .select({
        id: businessLines.id,
        name: businessLines.name,
      })
      .from(businessLines)
      .orderBy(businessLines.name);

    return { success: true, businessLines: lines };
  } catch (error) {
    console.error('Error fetching business lines:', error);
    return { success: false, error: 'Fehler beim Laden der Business Lines' };
  }
}

export async function createTechnology(data: {
  name: string;
  businessLineId: string;
  baselineHours: number;
  baselineName: string;
  baselineEntityCounts: Record<string, number>;
  isDefault: boolean;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  const { name, businessLineId, baselineHours, baselineName, baselineEntityCounts, isDefault } = data;

  // Validate inputs
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Name ist erforderlich' };
  }

  if (!businessLineId) {
    return { success: false, error: 'Business Line ist erforderlich' };
  }

  if (!baselineHours || baselineHours <= 0) {
    return { success: false, error: 'Baseline-Stunden müssen größer als 0 sein' };
  }

  if (!baselineName || baselineName.trim().length === 0) {
    return { success: false, error: 'Baseline-Name ist erforderlich' };
  }

  if (!baselineEntityCounts || Object.keys(baselineEntityCounts).length === 0) {
    return { success: false, error: 'Baseline-Entity-Counts sind erforderlich' };
  }

  try {
    const [technology] = await db
      .insert(technologies)
      .values({
        name: name.trim(),
        businessLineId,
        baselineHours,
        baselineName: baselineName.trim(),
        baselineEntityCounts: JSON.stringify(baselineEntityCounts),
        isDefault,
      })
      .returning();

    revalidatePath('/admin/technologies');

    return { success: true, technology };
  } catch (error) {
    console.error('Error creating technology:', error);
    return { success: false, error: 'Fehler beim Erstellen der Technologie' };
  }
}

export async function deleteTechnology(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    await db.delete(technologies).where(eq(technologies.id, id));

    revalidatePath('/admin/technologies');

    return { success: true };
  } catch (error) {
    console.error('Error deleting technology:', error);
    return { success: false, error: 'Fehler beim Löschen der Technologie' };
  }
}
