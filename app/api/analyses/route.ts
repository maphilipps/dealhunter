import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyses } from '@/lib/db/schema';
import { analysisQueue } from '@/lib/queue';
import { assertValidUuid, checkRateLimit, RATE_LIMITS } from '@/lib/validation';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting by user ID
  const rateLimitResult = await checkRateLimit(session.user.id, RATE_LIMITS.analysis);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
    }

    // UUID validation
    assertValidUuid(analysisId, 'analysisId');

    // Verify analysis belongs to user
    const analysis = await db.query.analyses.findFirst({
      where: (analyses, { eq, and }) =>
        and(eq(analyses.id, analysisId), eq(analyses.userId, session.user.id)),
    });

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Add job to queue
    await analysisQueue.add('process-analysis', { analysisId });

    // Update status
    await db
      .update(analyses)
      .set({ status: 'discovering', progress: 0, currentPhase: 'discovery' })
      .where(eq(analyses.id, analysisId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to start analysis:', error);

    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}
