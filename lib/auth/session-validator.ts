/**
 * Session Validator
 *
 * Ensures that the authenticated user exists in the database.
 * If not, redirects to login to force re-authentication.
 */

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export async function requireValidUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Verify user exists in database
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!user) {
    // User exists in session but not in database
    // This can happen after DB reset or user deletion
    // Force logout by redirecting to login
    redirect('/login?error=user_not_found');
  }

  return { user, session };
}

/**
 * Server Action helper - validates user exists before proceeding
 * Returns error message if user doesn't exist
 */
export async function validateUserForAction(userId: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return {
      valid: false,
      error: 'Benutzer nicht gefunden. Bitte melden Sie sich erneut an.',
    };
  }

  return { valid: true };
}
