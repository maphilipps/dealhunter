import { and, desc, eq, notInArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { LeadLayoutClient } from './layout-client';

import { LeadSidebarRight } from '@/components/pitches/pitch-sidebar-right';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, auditScanRuns } from '@/lib/db/schema';

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

  const [lead] = await db.select().from(pitches).where(eq(pitches.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Check for an active (non-terminal) pipeline run
  const [activeRun] = await db
    .select({ id: auditScanRuns.id })
    .from(auditScanRuns)
    .where(
      and(eq(auditScanRuns.pitchId, id), notInArray(auditScanRuns.status, ['completed', 'failed']))
    )
    .orderBy(desc(auditScanRuns.createdAt))
    .limit(1);

  // Sidebar nur rendern wenn Pipeline-Daten vorhanden (nicht bei frischen Pitches)
  const hasData = lead.status !== 'routed';

  return (
    <LeadLayoutClient leadId={id} activeRunId={activeRun?.id ?? null}>
      <div className="flex h-full w-full gap-4">
        <div className="flex-1 overflow-auto">{children}</div>
        {hasData && (
          <div className="sticky top-0 h-screen shrink-0">
            <LeadSidebarRight
              leadId={id}
              customerName={lead.customerName}
              status={lead.status}
              blVote={lead.blVote}
            />
          </div>
        )}
      </div>
    </LeadLayoutClient>
  );
}
