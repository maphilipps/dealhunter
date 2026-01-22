import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { RfpMobileNav } from '@/components/bids/rfp-mobile-nav';
import { RfpSidebarRight } from '@/components/bids/rfp-sidebar-right';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { auth } from '@/lib/auth';
import { getCachedRfp, getCachedUser, getRfpTitle } from '@/lib/rfps/cached-queries';

export default async function RfpDashboardLayout({
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

  // Parallel fetch of RFP and user data
  const [rfp, dbUser, rfpTitle] = await Promise.all([
    getCachedRfp(id),
    getCachedUser(session.user.id),
    getRfpTitle(id),
  ]);

  if (!rfp) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">RFP nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte RFP konnte nicht gefunden werden.</p>
      </div>
    );
  }

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
    <SidebarProvider>
      {/* Left Sidebar: Main Navigation (preserved from dashboard) */}
      <AppSidebar user={user} />

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center gap-2">
            <div className="flex-1">
              <h2 className="text-sm font-semibold">{rfpTitle}</h2>
              <p className="text-xs text-muted-foreground">RFP Dashboard</p>
            </div>
            {/* Mobile navigation trigger for RFP sections */}
            <RfpMobileNav rfpId={id} title={rfpTitle} status={rfp.status} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>

      {/* Right Sidebar: RFP-specific Navigation */}
      <RfpSidebarRight rfpId={id} title={rfpTitle} status={rfp.status} />
    </SidebarProvider>
  );
}
