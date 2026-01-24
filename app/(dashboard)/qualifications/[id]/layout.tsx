import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { LeadLayoutClient } from './layout-client';

import { LeadSidebarRight } from '@/components/qualifications/qualification-sidebar-right';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { qualifications } from '@/lib/db/schema';

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

  const [lead] = await db.select().from(qualifications).where(eq(qualifications.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  return (
    <LeadLayoutClient>
      <div className="flex h-full w-full gap-4">
        <div className="flex-1 overflow-auto">{children}</div>
        {/* Right Sidebar: Lead-specific Navigation - sticky for scroll persistence */}
        <div className="sticky top-0 h-screen shrink-0">
          <LeadSidebarRight
            leadId={id}
            customerName={lead.customerName}
            status={lead.status}
            blVote={lead.blVote}
          />
        </div>
      </div>
    </LeadLayoutClient>
  );
}
