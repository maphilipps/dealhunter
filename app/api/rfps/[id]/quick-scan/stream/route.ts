import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rfps, quickScans } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createAgentEventStream, createSSEResponse } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { runQuickScanWithStreaming } from '@/lib/quick-scan/agent';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for streaming Quick Scan activity
 * Best practice: Use native Web Streams for real-time updates
 * Security: Requires authentication and bid ownership verification
 */
export async function GET(
  _request: NextRequest,
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
    // 2. Fetch bid data and verify ownership
    const [bid] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, id), eq(rfps.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get the existing QuickScan record
    if (!bid.quickScanId) {
      return new Response(JSON.stringify({ error: 'No Quick Scan found for this bid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [quickScan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, bid.quickScanId));

    if (!quickScan) {
      return new Response(JSON.stringify({ error: 'Quick Scan record not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!quickScan.websiteUrl) {
      return new Response(JSON.stringify({ error: 'No website URL in Quick Scan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If scan is already completed, return the activity log as events
    if (quickScan.status === 'completed' && quickScan.activityLog) {
      const activityLog = JSON.parse(quickScan.activityLog);
      const stream = createAgentEventStream(async (emit) => {
        emit({ type: AgentEventType.START });

        // Replay the activity log
        for (const entry of activityLog) {
          emit({
            type: AgentEventType.AGENT_PROGRESS,
            data: { agent: entry.agent || 'Quick Scan', message: entry.message },
          });
        }

        emit({
          type: AgentEventType.AGENT_COMPLETE,
          data: {
            agent: 'Quick Scan',
            result: {
              recommendedBusinessUnit: quickScan.recommendedBusinessUnit,
              confidence: quickScan.confidence,
            },
          },
        });
      });

      return createSSEResponse(stream);
    }

    // If scan is still running, stream the live activity
    // Create SSE stream for live updates
    const stream = createAgentEventStream(async (emit) => {
      emit({ type: AgentEventType.START });

      // Parse extracted requirements if available
      const extractedReqs = bid.extractedRequirements
        ? JSON.parse(bid.extractedRequirements)
        : null;

      // Run quick scan with streaming callbacks
      const result = await runQuickScanWithStreaming(
        {
          websiteUrl: quickScan.websiteUrl,
          extractedRequirements: extractedReqs,
          bidId: id, // Pass bid ID for screenshot storage
        },
        emit
      );

      // Update QuickScan record with results (including new enhanced audit fields)
      await db
        .update(quickScans)
        .set({
          status: 'completed',
          techStack: JSON.stringify(result.techStack),
          cms: result.techStack.cms || null,
          framework: result.techStack.framework || null,
          hosting: result.techStack.hosting || null,
          contentVolume: JSON.stringify(result.contentVolume),
          features: JSON.stringify(result.features),
          recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
          confidence: result.blRecommendation.confidence,
          reasoning: result.blRecommendation.reasoning,
          // Enhanced audit fields (NEW)
          navigationStructure: result.navigationStructure ? JSON.stringify(result.navigationStructure) : null,
          accessibilityAudit: result.accessibilityAudit ? JSON.stringify(result.accessibilityAudit) : null,
          seoAudit: result.seoAudit ? JSON.stringify(result.seoAudit) : null,
          legalCompliance: result.legalCompliance ? JSON.stringify(result.legalCompliance) : null,
          performanceIndicators: result.performanceIndicators ? JSON.stringify(result.performanceIndicators) : null,
          screenshots: result.screenshots ? JSON.stringify(result.screenshots) : null,
          companyIntelligence: result.companyIntelligence ? JSON.stringify(result.companyIntelligence) : null,
          activityLog: JSON.stringify(result.activityLog),
          completedAt: new Date(),
        })
        .where(eq(quickScans.id, quickScan.id));

      // Emit completion event
      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: {
          agent: 'Quick Scan',
          result: {
            recommendedBusinessUnit: result.blRecommendation.primaryBusinessLine,
            confidence: result.blRecommendation.confidence,
          },
        },
      });
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('Quick scan stream error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
