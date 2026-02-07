import { eq, and, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, deepMigrationAnalyses } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/qualifications/[id]/deep-analysis/status
 *
 * Retrieves the current status of the deep migration analysis for a bid.
 *
 * Security: Requires authentication and bid ownership verification
 * Returns: {
 *   status: 'not_started' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
 *   analysisId?: string,
 *   startedAt?: string,
 *   completedAt?: string,
 *   errorMessage?: string,
 * }
 *
 * Errors:
 * - 401 Unauthorized: User not authenticated
 * - 404 Not Found: Bid not found or user doesn't own it
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await context.params;

  try {
    // 2. Verify bid ownership by joining through rfps
    // This implements Solution 2 from HIGH-003 todo (join through bids table)
    // Once userId is added to deepMigrationAnalyses, this can be simplified
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)))
      .limit(1);

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch most recent analysis for this bid
    const [analysis] = await db
      .select()
      .from(deepMigrationAnalyses)
      .where(eq(deepMigrationAnalyses.preQualificationId, id))
      .orderBy(desc(deepMigrationAnalyses.createdAt))
      .limit(1);

    // 4. Return status
    if (!analysis) {
      return Response.json({ status: 'not_started' });
    }

    return Response.json({
      success: true,
      analysis: {
        id: analysis.id,
        status: analysis.status,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
        errorMessage: analysis.errorMessage,
        contentArchitecture: analysis.contentArchitecture,
        migrationComplexity: analysis.migrationComplexity,
        accessibilityAudit: analysis.accessibilityAudit,
        ptEstimation: analysis.ptEstimation,
      },
    });
  } catch (error) {
    console.error('[API] Failed to fetch analysis status:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
