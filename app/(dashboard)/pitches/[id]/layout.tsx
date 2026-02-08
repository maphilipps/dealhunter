import { and, desc, eq, notInArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { LeadLayoutClient } from './layout-client';

import { LeadSidebarRight } from '@/components/pitches/pitch-sidebar-right';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, auditScanRuns } from '@/lib/db/schema';
import type { PitchScanCheckpoint } from '@/lib/pitch-scan/types';
import {
  generateNavigation,
  generatePendingNavigation,
  type GeneratedNavigation,
} from '@/lib/pitch-scan/navigation';

function safeParseCheckpoint(snapshotData: string | null): PitchScanCheckpoint | null {
  if (!snapshotData) return null;
  try {
    return JSON.parse(snapshotData) as PitchScanCheckpoint;
  } catch {
    return null;
  }
}

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

  // Fetch runs in parallel (avoid waterfalls in layout rendering).
  const [[activeRun], [latestRun]] = await Promise.all([
    db
      .select({ id: auditScanRuns.id })
      .from(auditScanRuns)
      .where(
        and(
          eq(auditScanRuns.pitchId, id),
          notInArray(auditScanRuns.status, ['completed', 'failed'])
        )
      )
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(1),
    db
      .select({
        id: auditScanRuns.id,
        status: auditScanRuns.status,
        snapshotData: auditScanRuns.snapshotData,
      })
      .from(auditScanRuns)
      .where(eq(auditScanRuns.pitchId, id))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(1),
  ]);

  const checkpoint = safeParseCheckpoint(latestRun?.snapshotData ?? null);
  let pitchScanNavigation: GeneratedNavigation | null = null;
  if (checkpoint?.plan) {
    pitchScanNavigation =
      latestRun && ['pending', 'running', 'waiting_for_user', 'review'].includes(latestRun.status)
        ? generatePendingNavigation(checkpoint.plan)
        : generateNavigation(checkpoint.plan, checkpoint.phaseResults);
  }

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
              pitchScanNavigation={pitchScanNavigation}
              pitchScanIsRunning={
                !!(latestRun && ['pending', 'running'].includes(latestRun.status))
              }
            />
          </div>
        )}
      </div>
    </LeadLayoutClient>
  );
}
