import { notFound, redirect } from 'next/navigation';

import { RfpSidebarRight } from '@/components/bids/rfp-sidebar-right';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
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
    notFound();
  }

  if (!dbUser) {
    redirect('/api/auth/clear-session');
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>

      {/* Right Sidebar: RFP-specific Navigation */}
      <RfpSidebarRight rfpId={id} title={rfpTitle} status={rfp.status} />
    </SidebarProvider>
  );
}
