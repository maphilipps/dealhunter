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
import { isProcessingState } from '@/lib/qualifications/constants';

/**
 * Fetch section highlights from dealEmbeddings
 */
async function getSectionHighlights(
  qualificationId: string,
  isProcessing: boolean
): Promise<SectionHighlight[]> {
  const highlights: SectionHighlight[] = [];

  // Get all dashboard highlights from dealEmbeddings
  const storedHighlights = await db.query.dealEmbeddings.findMany({
    where: and(
      eq(dealEmbeddings.preQualificationId, qualificationId),
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
        status: isProcessing ? 'pending' : 'no_data',
      });
    }
  }

  return highlights;
}

/**
 * GET /api/qualifications/[id]/dashboard-summary
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

    const { id: qualificationId } = await context.params;

    // Verify ownership and get qualification with qualificationScan
    const preQualification = await db.query.preQualifications.findFirst({
      where: and(
        eq(preQualifications.id, qualificationId),
        eq(preQualifications.userId, session.user.id)
      ),
      with: {
        qualificationScan: true,
      },
    });

    if (!preQualification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get Management Summary from expert agent results
    let managementSummary: ManagementSummary | null = null;
    const hasResults = await hasExpertAgentResults(qualificationId);
    if (hasResults) {
      const summaryResult = await getAgentResult(qualificationId, 'summary_expert');
      if (summaryResult?.metadata) {
        managementSummary = summaryResult.metadata as unknown as ManagementSummary;
      }
    }

    // Use canonical processing state check
    const isProcessing = isProcessingState(preQualification.status);

    // Get Section Highlights
    const sectionHighlights = await getSectionHighlights(qualificationId, isProcessing);

    // Get BU Routing from qualificationScan
    const qualificationScan = preQualification.qualificationScan as Record<string, any> | null;
    const buRouting: BURoutingRecommendation = {
      recommendedBusinessUnit: qualificationScan?.recommendedBusinessUnit ?? null,
      confidence: qualificationScan?.confidence ?? null,
      reasoning: qualificationScan?.reasoning ?? null,
    };

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
      { error: 'Dashboard-Zusammenfassung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
