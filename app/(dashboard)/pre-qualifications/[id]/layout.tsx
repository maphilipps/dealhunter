import { and, desc, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { PreQualificationSidebarRight } from '@/components/bids/pre-qualification-sidebar-right';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { QuickScanProvider, type QuickScanStatus } from '@/contexts/quick-scan-context';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { backgroundJobs } from '@/lib/db/schema';
import {
  getCachedPreQualificationWithRelations,
  getCachedUser,
  getPreQualificationTitle,
  getPreQualificationCustomerName,
} from '@/lib/pre-qualifications/cached-queries';
import { getQuickScanDataAvailability } from '@/lib/pre-qualifications/navigation';

export default async function PreQualificationDashboardLayout({
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

  // Parallel fetch of Pre-Qualification with relations and user data
  const [{ preQualification, quickScan }, dbUser, preQualificationTitle, customerName, latestJob] =
    await Promise.all([
      getCachedPreQualificationWithRelations(id),
      getCachedUser(session.user.id),
      getPreQualificationTitle(id),
      getPreQualificationCustomerName(id),
      db
        .select({
          id: backgroundJobs.id,
          status: backgroundJobs.status,
          progress: backgroundJobs.progress,
          currentStep: backgroundJobs.currentStep,
          errorMessage: backgroundJobs.errorMessage,
          createdAt: backgroundJobs.createdAt,
          updatedAt: backgroundJobs.updatedAt,
          completedAt: backgroundJobs.completedAt,
        })
        .from(backgroundJobs)
        .where(
          and(eq(backgroundJobs.preQualificationId, id), eq(backgroundJobs.jobType, 'qualification'))
        )
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(1)
        .then(rows => rows[0] ?? null),
    ]);

  if (!preQualification) {
    notFound();
  }

  if (!dbUser) {
    redirect('/api/auth/clear-session');
  }

  // Calculate data availability from quickScan
  const dataAvailability = getQuickScanDataAvailability(quickScan);
  const initialJob = latestJob
    ? {
        id: latestJob.id,
        status:
          latestJob.status === 'cancelled'
            ? ('failed' as QuickScanStatus)
            : (latestJob.status as QuickScanStatus),
        progress: latestJob.progress,
        currentStep: latestJob.currentStep,
        errorMessage: latestJob.errorMessage,
        createdAt: latestJob.createdAt?.toISOString() ?? null,
        updatedAt: latestJob.updatedAt?.toISOString() ?? null,
        completedAt: latestJob.completedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <QuickScanProvider preQualificationId={id} initialJob={initialJob}>
      <SidebarProvider>
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>

        {/* Right Sidebar: Pre-Qualification-specific Navigation */}
        <PreQualificationSidebarRight
          preQualificationId={id}
          title={preQualificationTitle}
          customerName={customerName}
          status={preQualification.status}
          dataAvailability={dataAvailability}
        />
      </SidebarProvider>
    </QuickScanProvider>
  );
}
