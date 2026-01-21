'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung', users: [] };
  }

  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(users.createdAt);

    return { success: true, users: allUsers, currentUserId: session.user.id };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, error: 'Fehler beim Laden der Benutzer', users: [] };
  }
}

export async function updateUserRole(userId: string, role: 'bd' | 'bl' | 'admin') {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    const [user] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();

    revalidatePath('/admin/users');
    return { success: true, user };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Rolle' };
  }
}

export async function deleteUser(userId: string) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  if (userId === session.user.id) {
    return { success: false, error: 'Sie können sich selbst nicht löschen' };
  }

  try {
    // Soft delete instead of hard delete to avoid FK constraint violations
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, error: 'Fehler beim Löschen des Benutzers' };
  }
}
