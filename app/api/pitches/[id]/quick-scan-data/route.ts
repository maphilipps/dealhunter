import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, quickScans, preQualifications } from '@/lib/db/schema';

/**
 * GET /api/pitches/[id]/quick-scan-data
 *
 * Fetch Quick Scan data for a lead, including:
 * - Tech stack detection results
 * - Company intelligence
 * - Decision makers
 * - Migration complexity preview
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: leadId } = await context.params;

    // Fetch lead to get quickScanId
    const [lead] = await db
      .select({
        id: pitches.id,
        quickScanId: pitches.quickScanId,
        preQualificationId: pitches.preQualificationId,
      })
      .from(pitches)
      .where(eq(pitches.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // If no quickScanId, try to get from Pre-Qualification
    let quickScanId = lead.quickScanId;

    if (!quickScanId && lead.preQualificationId) {
      const [preQualification] = await db
        .select({ quickScanId: preQualifications.quickScanId })
        .from(preQualifications)
        .where(eq(preQualifications.id, lead.preQualificationId))
        .limit(1);

      quickScanId = preQualification?.quickScanId ?? null;
    }

    if (!quickScanId) {
      return NextResponse.json({
        quickScan: null,
        rfpExtraction: null,
        message: 'No Pitch data available',
      });
    }

    // Fetch quick scan data
    const [quickScan] = await db
      .select({
        id: quickScans.id,
        status: quickScans.status,
        websiteUrl: quickScans.websiteUrl,
        cms: quickScans.cms,
        framework: quickScans.framework,
        hosting: quickScans.hosting,
        pageCount: quickScans.pageCount,
        techStack: quickScans.techStack,
        companyIntelligence: quickScans.companyIntelligence,
        decisionMakers: quickScans.decisionMakers,
        migrationComplexity: quickScans.migrationComplexity,
        features: quickScans.features,
        integrations: quickScans.integrations,
        completedAt: quickScans.completedAt,
      })
      .from(quickScans)
      .where(eq(quickScans.id, quickScanId))
      .limit(1);

    if (!quickScan) {
      return NextResponse.json({
        quickScan: null,
        rfpExtraction: null,
        message: 'Pitch not found',
      });
    }

    // Parse JSON fields safely
    const parseJson = <T>(value: string | null): T | null => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    };

    return NextResponse.json({
      quickScan: {
        id: quickScan.id,
        status: quickScan.status,
        websiteUrl: quickScan.websiteUrl,
        cms: quickScan.cms,
        framework: quickScan.framework,
        hosting: quickScan.hosting,
        pageCount: quickScan.pageCount,
        techStack: parseJson(quickScan.techStack),
        companyIntelligence: parseJson(quickScan.companyIntelligence),
        decisionMakers: parseJson(quickScan.decisionMakers),
        migrationComplexity: parseJson(quickScan.migrationComplexity),
        features: parseJson(quickScan.features),
        integrations: parseJson(quickScan.integrations),
        completedAt: quickScan.completedAt?.toISOString() ?? null,
      },
      rfpExtraction: null, // Could be extended to include Pre-Qualification extraction data
    });
  } catch (error) {
    console.error('[quick-scan-data] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
