'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { businessLines } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getBusinessLines() {
  try {
    const lines = await db.select().from(businessLines).orderBy(businessLines.createdAt);
    return { success: true, businessLines: lines };
  } catch (error) {
    console.error('Error fetching business lines:', error);
    return { success: false, error: 'Fehler beim Laden der Business Lines' };
  }
}

export async function createBusinessLine(data: {
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
    const [businessLine] = await db
      .insert(businessLines)
      .values({
        name: name.trim(),
        leaderName: leaderName.trim(),
        leaderEmail: leaderEmail.trim(),
        keywords: JSON.stringify(keywords),
      })
      .returning();

    revalidatePath('/admin/business-lines');

    return { success: true, businessLine };
  } catch (error) {
    console.error('Error creating business line:', error);
    return { success: false, error: 'Fehler beim Erstellen der Business Line' };
  }
}

export async function deleteBusinessLine(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    await db.delete(businessLines).where(eq(businessLines.id, id));

    revalidatePath('/admin/business-lines');

    return { success: true };
  } catch (error) {
    console.error('Error deleting business line:', error);
    return { success: false, error: 'Fehler beim Löschen der Business Line' };
  }
}
