import { redirect } from 'next/navigation';

import { signOut } from '@/lib/auth';

/**
 * Route to clear invalid sessions (e.g., when user no longer exists in DB)
 * Used by dashboard layout when user in JWT doesn't exist in database
 */
export async function GET() {
  await signOut({ redirect: false });
  redirect('/login?error=user_not_found');
}
