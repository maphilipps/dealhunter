import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bidOpportunities, deepMigrationAnalyses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  // Verify bid ownership
  const [bid] = await db
    .select()
    .from(bidOpportunities)
    .where(and(eq(bidOpportunities.id, id), eq(bidOpportunities.userId, session.user.id)))
    .limit(1);

  if (!bid) {
    return NextResponse.json({ error: 'Bid not found or access denied' }, { status: 404 });
  }

  if (!bid.websiteUrl) {
    return NextResponse.json({ error: 'No website URL found - cannot run Deep Analysis' }, { status: 400 });
  }

  // Check if analysis already running
  const [existing] = await db
    .select()
    .from(deepMigrationAnalyses)
    .where(
      and(
        eq(deepMigrationAnalyses.bidOpportunityId, id),
        eq(deepMigrationAnalyses.status, 'running')
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error: 'Analysis already running',
        analysisId: existing.id,
      },
      { status: 409 }
    );
  }

  // Trigger Inngest job
  await inngest.send({
    name: 'deep-analysis.run',
    data: { bidId: id, userId: session.user.id },
  });

  return NextResponse.json({
    success: true,
    message: 'Deep Analysis started - this will take approximately 25-30 minutes',
    bidId: id,
  });
}
