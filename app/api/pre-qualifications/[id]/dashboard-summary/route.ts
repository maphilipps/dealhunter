import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAgentResult, hasExpertAgentResults } from '@/lib/agents/expert-agents';
import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { auth } from '@/lib/auth';
import { DASHBOARD_SECTIONS } from '@/lib/dashboard/sections';
import type {
  BURoutingRecommendation,
  DashboardSummaryResponse,
  SectionHighlight,
} from '@/lib/dashboard/types';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import { isProcessingState } from '@/lib/pre-qualifications/constants';

/**
 * Fetch section highlights from dealEmbeddings
 */
async function getSectionHighlights(preQualificationId: string): Promise<SectionHighlight[]> {
  const highlights: SectionHighlight[] = [];

  // Get all dashboard highlights from dealEmbeddings
  const storedHighlights = await db.query.dealEmbeddings.findMany({
    where: and(
      eq(dealEmbeddings.preQualificationId, preQualificationId),
      eq(dealEmbeddings.chunkType, 'dashboard_highlight')
    ),
  });

  // Build highlights map
  const highlightsMap = new Map<string, { highlights: string[]; confidence: number }>();
  for (const row of storedHighlights) {
    try {
      const metadata = (row.metadata ? JSON.parse(row.metadata) : {}) as Record<string, unknown>;
      const sectionId = typeof metadata.sectionId === 'string' ? metadata.sectionId : null;
      if (sectionId && row.content) {
        const parsed: unknown = JSON.parse(row.content);
        highlightsMap.set(sectionId, {
          highlights: Array.isArray(parsed) ? (parsed as string[]) : [],
          confidence: row.confidence ?? 50,
        });
      }
    } catch {
      // Skip malformed entries
    }
  }

  // Build response for all configured sections
  for (const section of DASHBOARD_SECTIONS) {
    const stored = highlightsMap.get(section.id);
    if (stored && stored.highlights.length > 0) {
      highlights.push({
        sectionId: section.id,
        sectionTitle: section.title,
        highlights: stored.highlights.slice(0, 3),
        confidence: stored.confidence,
        status: 'available',
      });
    } else {
      highlights.push({
        sectionId: section.id,
        sectionTitle: section.title,
        highlights: [],
        status: 'pending',
      });
    }
  }

  return highlights;
}

/**
 * GET /api/pre-qualifications/[id]/dashboard-summary
 *
 * Returns aggregated dashboard data:
 * - Management Summary (from summary_expert agent)
 * - Section Highlights (Top-3 Key Facts per section)
 * - BU Routing Recommendation
 * - Processing Status
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preQualificationId } = await context.params;

    // Verify ownership and get preQualification with quickScan
    const preQualification = await db.query.preQualifications.findFirst({
      where: and(
        eq(preQualifications.id, preQualificationId),
        eq(preQualifications.userId, session.user.id)
      ),
      with: {
        quickScan: true,
      },
    });

    if (!preQualification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get Management Summary from expert agent results
    let managementSummary: ManagementSummary | null = null;
    const hasResults = await hasExpertAgentResults(preQualificationId);
    if (hasResults) {
      const summaryResult = await getAgentResult(preQualificationId, 'summary_expert');
      if (summaryResult?.metadata) {
        managementSummary = summaryResult.metadata as unknown as ManagementSummary;
      }
    }

    // Get Section Highlights
    const sectionHighlights = await getSectionHighlights(preQualificationId);

    // Get BU Routing from quickScan
    const quickScan = preQualification.quickScan;
    const buRouting: BURoutingRecommendation = {
      recommendedBusinessUnit: quickScan?.recommendedBusinessUnit ?? null,
      confidence: quickScan?.confidence ?? null,
      reasoning: quickScan?.reasoning ?? null,
    };

    // Use canonical processing state check
    const isProcessing = isProcessingState(preQualification.status);

    const response: DashboardSummaryResponse = {
      managementSummary,
      sectionHighlights,
      buRouting,
      processingStatus: {
        isProcessing,
        currentStep: isProcessing ? preQualification.status : undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Dashboard Summary API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
