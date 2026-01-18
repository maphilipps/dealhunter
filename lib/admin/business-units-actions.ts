'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { businessUnits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getBusinessUnits() {
  try {
    const units = await db.select().from(businessUnits).orderBy(businessUnits.createdAt);
    return { success: true, businessUnits: units };
  } catch (error) {
    console.error('Error fetching business units:', error);
    return { success: false, error: 'Fehler beim Laden der Business Units' };
  }
}

export async function createBusinessUnit(data: {
  name: string;
  leaderName: string;
  leaderEmail: string;
  keywords: string[];
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  const { name, leaderName, leaderEmail, keywords } = data;

  // Validate inputs
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Name ist erforderlich' };
  }

  if (!leaderName || leaderName.trim().length === 0) {
    return { success: false, error: 'Leiter-Name ist erforderlich' };
  }

  if (!leaderEmail || leaderEmail.trim().length === 0) {
    return { success: false, error: 'Leiter-E-Mail ist erforderlich' };
  }

  if (!keywords || keywords.length === 0) {
    return { success: false, error: 'Mindestens ein Keyword ist erforderlich' };
  }

  try {
    const [businessUnit] = await db
      .insert(businessUnits)
      .values({
        name: name.trim(),
        leaderName: leaderName.trim(),
        leaderEmail: leaderEmail.trim(),
        keywords: JSON.stringify(keywords),
      })
      .returning();

    revalidatePath('/admin/business-units');

    return { success: true, businessUnit };
  } catch (error) {
    console.error('Error creating business unit:', error);
    return { success: false, error: 'Fehler beim Erstellen der Business Unit' };
  }
}

export async function deleteBusinessUnit(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    await db.delete(businessUnits).where(eq(businessUnits.id, id));

    revalidatePath('/admin/business-units');

    return { success: true };
  } catch (error) {
    console.error('Error deleting business unit:', error);
    return { success: false, error: 'Fehler beim Löschen der Business Unit' };
  }
}
