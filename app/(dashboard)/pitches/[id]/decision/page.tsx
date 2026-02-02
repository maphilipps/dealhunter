import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { DecisionPageClient } from './decision-page-client';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches } from '@/lib/db/schema';

/**
 * DEA-152: Decision Page - BID/NO-BID Final Decision
 *
 * This page aggregates all section analyses into a final decision page:
 * - Executive Summary (AI-generated from all agents)
 * - Pros/Cons categorized by domain (Tech, Commercial, Risk, Legal, etc.)
 * - Weighted Confidence Score
 * - Final BID/NO-BID recommendation
 * - Action buttons with confirmation dialog
 */
export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Get lead
  const [lead] = await db.select().from(pitches).where(eq(pitches.id, id)).limit(1);

  if (!lead) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Lead nicht gefunden</h1>
        <p className="text-muted-foreground">Der angeforderte Lead konnte nicht gefunden werden.</p>
      </div>
    );
  }

  return <DecisionPageClient lead={lead} />;
}
