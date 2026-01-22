import { sql, count, eq, and, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, businessUnits } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all RFPs for aggregation
    const allRfps = await db
      .select({
        id: rfps.id,
        status: rfps.status,
        decision: rfps.decision,
        source: rfps.source,
        stage: rfps.stage,
        assignedBusinessUnitId: rfps.assignedBusinessUnitId,
        createdAt: rfps.createdAt,
        updatedAt: rfps.updatedAt,
      })
      .from(rfps);

    // Calculate bid rate
    const decidedBids = allRfps.filter(r => r.decision !== 'pending');
    const bidCount = decidedBids.filter(r => r.decision === 'bid').length;
    const noBidCount = decidedBids.filter(r => r.decision === 'no_bid').length;
    const bidRate = decidedBids.length > 0 ? Math.round((bidCount / decidedBids.length) * 100) : 0;

    // Calculate time to decision (average)
    let avgTimeToDecision = 0;
    const rfpsWithDecision = allRfps.filter(
      r => r.decision !== 'pending' && r.createdAt && r.updatedAt
    );
    if (rfpsWithDecision.length > 0) {
      const totalTime = rfpsWithDecision.reduce((sum, r) => {
        const created =
          r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(r.createdAt!).getTime();
        const updated =
          r.updatedAt instanceof Date ? r.updatedAt.getTime() : new Date(r.updatedAt!).getTime();
        return sum + (updated - created);
      }, 0);
      avgTimeToDecision = Math.round(totalTime / rfpsWithDecision.length / (1000 * 60 * 60)); // hours
    }

    // Source distribution
    const reactiveCount = allRfps.filter(r => r.source === 'reactive').length;
    const proactiveCount = allRfps.filter(r => r.source === 'proactive').length;

    // Stage distribution
    const coldCount = allRfps.filter(r => r.stage === 'cold').length;
    const warmCount = allRfps.filter(r => r.stage === 'warm').length;
    const rfpCount = allRfps.filter(r => r.stage === 'rfp').length;

    // Status funnel
    const draftCount = allRfps.filter(r => r.status === 'draft').length;
    const evaluatingCount = allRfps.filter(r =>
      ['quick_scanning', 'evaluating', 'bit_pending'].includes(r.status)
    ).length;
    const decisionMadeCount = allRfps.filter(r => r.status === 'decision_made').length;
    const routedCount = allRfps.filter(r => ['routed', 'bl_reviewing'].includes(r.status)).length;
    const assignedCount = allRfps.filter(r =>
      ['team_assigned', 'notified', 'handed_off'].includes(r.status)
    ).length;
    const archivedCount = allRfps.filter(r => r.status === 'archived').length;

    // Business Line distribution
    const businessUnitsList = await db.select().from(businessUnits);
    const blDistribution = businessUnitsList.map(bu => ({
      name: bu.name,
      count: allRfps.filter(r => r.assignedBusinessUnitId === bu.id).length,
    }));

    // Timeline data (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timelineData: { date: string; bids: number; noBids: number }[] = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      const dayRfps = allRfps.filter(r => {
        if (!r.createdAt) return false;
        const createdDate = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
        return createdDate.toISOString().split('T')[0] === dateStr;
      });

      timelineData.push({
        date: dateStr,
        bids: dayRfps.filter(r => r.decision === 'bid').length,
        noBids: dayRfps.filter(r => r.decision === 'no_bid').length,
      });
    }

    return NextResponse.json({
      summary: {
        totalRfps: allRfps.length,
        bidRate,
        avgTimeToDecision,
        activeBids: allRfps.filter(r => !['archived', 'handed_off'].includes(r.status)).length,
      },
      bidDecision: {
        bid: bidCount,
        noBid: noBidCount,
        pending: allRfps.length - decidedBids.length,
      },
      source: {
        reactive: reactiveCount,
        proactive: proactiveCount,
      },
      stage: {
        cold: coldCount,
        warm: warmCount,
        rfp: rfpCount,
      },
      funnel: {
        draft: draftCount,
        evaluating: evaluatingCount,
        decisionMade: decisionMadeCount,
        routed: routedCount,
        assigned: assignedCount,
        archived: archivedCount,
      },
      blDistribution,
      timeline: timelineData,
    });
  } catch (error) {
    console.error('[GET /api/analytics/overview] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
