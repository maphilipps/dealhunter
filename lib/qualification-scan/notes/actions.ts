'use server';

import { eq, and, desc } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sectionNotes, type SectionNote } from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// Section Notes CRUD — Server Actions
// ═══════════════════════════════════════════════════════════════════════════════

export async function createNote(
  qualificationId: string,
  sectionId: string,
  content: string
): Promise<{ success: boolean; note?: SectionNote; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Nicht authentifiziert' };

  try {
    const [note] = await db
      .insert(sectionNotes)
      .values({
        qualificationId,
        sectionId,
        userId: session.user.id,
        content,
      })
      .returning();

    return { success: true, note };
  } catch (error) {
    console.error('createNote error:', error);
    return { success: false, error: 'Notiz konnte nicht erstellt werden' };
  }
}

export async function getNotesForSection(
  qualificationId: string,
  sectionId: string
): Promise<{ success: boolean; notes?: SectionNote[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Nicht authentifiziert' };

  try {
    const notes = await db
      .select()
      .from(sectionNotes)
      .where(
        and(
          eq(sectionNotes.qualificationId, qualificationId),
          eq(sectionNotes.sectionId, sectionId)
        )
      )
      .orderBy(desc(sectionNotes.createdAt));

    return { success: true, notes };
  } catch (error) {
    console.error('getNotesForSection error:', error);
    return { success: false, error: 'Notizen konnten nicht geladen werden' };
  }
}

export async function updateNote(
  noteId: string,
  content: string
): Promise<{ success: boolean; note?: SectionNote; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Nicht authentifiziert' };

  try {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(sectionNotes)
      .where(eq(sectionNotes.id, noteId))
      .limit(1);

    if (!existing) return { success: false, error: 'Notiz nicht gefunden' };
    if (existing.userId !== session.user.id) return { success: false, error: 'Keine Berechtigung' };

    const [updated] = await db
      .update(sectionNotes)
      .set({ content, updatedAt: new Date() })
      .where(eq(sectionNotes.id, noteId))
      .returning();

    return { success: true, note: updated };
  } catch (error) {
    console.error('updateNote error:', error);
    return { success: false, error: 'Notiz konnte nicht aktualisiert werden' };
  }
}

export async function deleteNote(noteId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Nicht authentifiziert' };

  try {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(sectionNotes)
      .where(eq(sectionNotes.id, noteId))
      .limit(1);

    if (!existing) return { success: false, error: 'Notiz nicht gefunden' };
    if (existing.userId !== session.user.id) return { success: false, error: 'Keine Berechtigung' };

    await db.delete(sectionNotes).where(eq(sectionNotes.id, noteId));

    return { success: true };
  } catch (error) {
    console.error('deleteNote error:', error);
    return { success: false, error: 'Notiz konnte nicht gelöscht werden' };
  }
}
