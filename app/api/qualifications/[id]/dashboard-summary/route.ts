import { and, desc, eq, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAgentResult, hasExpertAgentResults } from '@/lib/agents/expert-agents';
import type { ManagementSummary } from '@/lib/agents/expert-agents/summary-schema';
import { auth } from '@/lib/auth';
import { DASHBOARD_SECTIONS, SECTION_BY_ID } from '@/lib/dashboard/sections';
import type {
  BURoutingRecommendation,
  CentralBidderQuestion,
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

async function getCentralBidderQuestions(
  qualificationId: string
): Promise<CentralBidderQuestion[]> {
  const normalizeQuestion = (raw: string): string => {
    let text = raw
      .replace(/^Offene Frage:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '';

    // Remove trailing inline source block "(Quelle ... | Annahme ...)" for stable dedupe.
    if (text.endsWith(')')) {
      const markerIndex = text.lastIndexOf(' (');
      if (markerIndex > 0) {
        const suffix = text.slice(markerIndex + 2, -1);
        if (/\b(Quelle|Annahme)\b/i.test(suffix)) {
          text = text.slice(0, markerIndex).trim();
        }
      }
    }
    return text;
  };

  const knownSectionIds = new Set(SECTION_BY_ID.keys());

  const rows = await db
    .select({
      content: dealEmbeddings.content,
      metadata: dealEmbeddings.metadata,
      chunkType: dealEmbeddings.chunkType,
      createdAt: dealEmbeddings.createdAt,
      chunkIndex: dealEmbeddings.chunkIndex,
    })
    .from(dealEmbeddings)
    .where(
      and(
        eq(dealEmbeddings.preQualificationId, qualificationId),
        eq(dealEmbeddings.agentName, 'prequal_section_agent'),
        or(
          eq(dealEmbeddings.chunkType, 'bidder_question'),
          sql`(metadata::jsonb)->>'kind' = 'open_question'`
        )
      )
    )
    .orderBy(desc(dealEmbeddings.createdAt), dealEmbeddings.chunkIndex);

  const out: CentralBidderQuestion[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    let sectionId = 'unknown';
    const rawText = String(row.content || '').trim();

    try {
      const meta = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null;
      if (meta && typeof meta.sectionId === 'string' && meta.sectionId.trim().length > 0) {
        sectionId = meta.sectionId;
      }
    } catch {
      // Keep defaults for malformed metadata
    }

    if (sectionId === 'unknown' && knownSectionIds.has(row.chunkType)) {
      sectionId = row.chunkType;
    }
    if (sectionId === 'unknown') continue;

    const text = normalizeQuestion(rawText);
    if (!text) continue;

    const dedupeKey = `${sectionId}::${text.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      sectionId,
      sectionTitle: SECTION_BY_ID.get(sectionId)?.title ?? sectionId,
      question: text,
    });
  }

  return out.slice(0, 30);
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

    const bidderQuestions = await getCentralBidderQuestions(qualificationId);

    // Get BU Routing from qualificationScan
    const qualificationScan = preQualification.qualificationScan as Record<string, unknown> | null;
    const buRouting: BURoutingRecommendation = {
      recommendedBusinessUnit:
        qualificationScan && typeof qualificationScan.recommendedBusinessUnit === 'string'
          ? qualificationScan.recommendedBusinessUnit
          : null,
      confidence:
        qualificationScan && typeof qualificationScan.confidence === 'number'
          ? qualificationScan.confidence
          : null,
      reasoning:
        qualificationScan && typeof qualificationScan.reasoning === 'string'
          ? qualificationScan.reasoning
          : null,
    };

    const response: DashboardSummaryResponse = {
      managementSummary,
      sectionHighlights,
      bidderQuestions,
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
