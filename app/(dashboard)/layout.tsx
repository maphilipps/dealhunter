import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

/**
 * Cached user query function for per-request deduplication.
 *
 * This ensures that if multiple components in the same request need user data,
 * the database query is only executed once. Subsequent calls return the cached result.
 *
 * @see https://react.dev/reference/react/cache
 */
const getUserById = cache(async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
});

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Note: Auth and DB query are sequential (not parallel) because the DB query depends on session.user.id.
  // This is intentional and optimal for this use case:
  // - Early redirect prevents unnecessary DB queries for unauthenticated users
  // - React.cache() ensures per-request deduplication (DEA-123)
  // - Parallel execution is not possible without the user ID from auth()
  //
  // Alternative patterns considered (DEA-113):
  // - Promise.all: Not possible (DB query requires session ID)
  // - Cache users table: Adds complexity without significant benefit
  // - after() for user check: Not appropriate (user data needed for render)
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Verify user exists in database (handles stale sessions after DB reseed)
  const dbUser = await getUserById(session.user.id);

  if (!dbUser) {
    // User in JWT but not in DB - clear session via API route and redirect to login
    redirect('/api/auth/clear-session');
  }

  const user = {
    name: dbUser.name || session.user?.name || 'Unknown',
    email: dbUser.email || session.user?.email || '',
    role: dbUser.role,
    avatar: '', // Empty avatar triggers AvatarFallback with initials
  };

  // For lead detail pages, make sidebars non-collapsible
  return (
    <SidebarProvider>
      <AppSidebar user={user} collapsible="none" />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
