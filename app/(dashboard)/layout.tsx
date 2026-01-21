import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { DynamicBreadcrumb } from '@/components/dynamic-breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Verify user exists in database (handles stale sessions after DB reseed)
  const [dbUser] = await db.select().from(users).where(eq(users.id, session.user.id!)).limit(1);

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

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <DynamicBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
