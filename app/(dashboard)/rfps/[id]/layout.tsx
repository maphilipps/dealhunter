import { notFound, redirect } from 'next/navigation';

import { RfpSidebarRight } from '@/components/bids/rfp-sidebar-right';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '@/lib/auth';
import {
  getCachedRfpWithRelations,
  getCachedUser,
  getRfpTitle,
} from '@/lib/rfps/cached-queries';
import { getQuickScanDataAvailability } from '@/lib/rfps/navigation';

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

  // Parallel fetch of RFP with relations and user data
  const [{ rfp, quickScan }, dbUser, rfpTitle] = await Promise.all([
    getCachedRfpWithRelations(id),
    getCachedUser(session.user.id),
    getRfpTitle(id),
  ]);

  if (!rfp) {
    notFound();
  }

  if (!dbUser) {
    redirect('/api/auth/clear-session');
  }

  // Calculate data availability from quickScan
  const dataAvailability = getQuickScanDataAvailability(quickScan);

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>

      {/* Right Sidebar: RFP-specific Navigation */}
      <RfpSidebarRight
        rfpId={id}
        title={rfpTitle}
        status={rfp.status}
        dataAvailability={dataAvailability}
      />
    </SidebarProvider>
  );
}
