import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bidOpportunities, deepMigrationAnalyses } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bids/[id]/deep-analysis/results
 *
 * Retrieves the completed analysis results for a bid opportunity.
 *
 * Security: Requires authentication and bid ownership verification
 * Returns: {
 *   contentArchitecture: ContentArchitectureResult,
 *   migrationComplexity: MigrationComplexityResult,
 *   accessibilityAudit: AccessibilityAuditResult,
 *   ptEstimation: PTEstimationResult,
 * }
 *
 * Errors:
 * - 401 Unauthorized: User not authenticated
 * - 404 Not Found: Bid not found, user doesn't own it, or no completed analysis exists
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    // 2. Verify bid ownership by joining through bidOpportunities
    // This implements Solution 2 from HIGH-003 todo (join through bids table)
    // Once userId is added to deepMigrationAnalyses, this can be simplified
    const [bid] = await db
      .select()
      .from(bidOpportunities)
      .where(and(
        eq(bidOpportunities.id, id),
        eq(bidOpportunities.userId, session.user.id)
      ))
      .limit(1);

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch most recent completed analysis for this bid
    const [analysis] = await db
      .select()
      .from(deepMigrationAnalyses)
      .where(and(
        eq(deepMigrationAnalyses.bidOpportunityId, id),
        eq(deepMigrationAnalyses.status, 'completed')
      ))
      .orderBy(desc(deepMigrationAnalyses.createdAt))
      .limit(1);

    if (!analysis) {
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: 'No completed analysis found for this bid',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Parse and return results
    // All JSON columns are validated by the agents, so we can safely parse them
    return Response.json({
      contentArchitecture: analysis.contentArchitecture
        ? JSON.parse(analysis.contentArchitecture)
        : null,
      migrationComplexity: analysis.migrationComplexity
        ? JSON.parse(analysis.migrationComplexity)
        : null,
      accessibilityAudit: analysis.accessibilityAudit
        ? JSON.parse(analysis.accessibilityAudit)
        : null,
      ptEstimation: analysis.ptEstimation
        ? JSON.parse(analysis.ptEstimation)
        : null,
    });
  } catch (error) {
    console.error('[API] Failed to fetch analysis results:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
