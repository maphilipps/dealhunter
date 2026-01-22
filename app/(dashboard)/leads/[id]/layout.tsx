import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { LeadSidebarRight } from '@/components/leads/lead-sidebar-right';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, users } from '@/lib/db/schema';

export default async function LeadDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead for right sidebar metadata
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Get user for main sidebar (same as parent dashboard layout)
  const dbUser = session.user.id
    ? await db
        .select({
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
        .then(r => r[0])
    : null;

  if (!dbUser) {
    redirect('/api/auth/clear-session');
  }

  const user = {
    name: dbUser.name || session.user?.name || 'Unknown',
    email: dbUser.email || session.user?.email || '',
    role: dbUser.role,
    avatar: '',
  };

  return (
    <SidebarProvider defaultOpen>
      {/* Left Sidebar: Main Navigation (preserved from dashboard) */}
      <AppSidebar user={user} collapsible="none" />

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex flex-1 items-center gap-2">
            <div>
              <h2 className="text-sm font-semibold">{lead.customerName}</h2>
              <p className="text-xs text-muted-foreground">Lead Dashboard</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>

      {/* Right Sidebar: Lead-specific Navigation */}
      <LeadSidebarRight leadId={id} customerName={lead.customerName} status={lead.status} />
    </SidebarProvider>
  );
}
