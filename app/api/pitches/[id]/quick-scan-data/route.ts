import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, leadScans, preQualifications } from '@/lib/db/schema';

/**
 * GET /api/pitches/[id]/qualification-scan-data
 *
 * Fetch Qualification Scan data for a lead, including:
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

    // Fetch lead to get qualificationScanId
    const [lead] = await db
      .select({
        id: pitches.id,
        qualificationScanId: pitches.qualificationScanId,
        preQualificationId: pitches.preQualificationId,
      })
      .from(pitches)
      .where(eq(pitches.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // If no qualificationScanId, try to get from Qualification
    let qualificationScanId = lead.qualificationScanId;

    if (!qualificationScanId && lead.preQualificationId) {
      const [preQualification] = await db
        .select({ qualificationScanId: preQualifications.qualificationScanId })
        .from(preQualifications)
        .where(eq(preQualifications.id, lead.preQualificationId))
        .limit(1);

      qualificationScanId = preQualification?.qualificationScanId ?? null;
    }

    if (!qualificationScanId) {
      return NextResponse.json({
        qualificationScan: null,
        rfpExtraction: null,
        message: 'No Pitch data available',
      });
    }

    // Fetch qualification scan data
    const [qualificationScan] = await db
      .select({
        id: leadScans.id,
        status: leadScans.status,
        websiteUrl: leadScans.websiteUrl,
        cms: leadScans.cms,
        framework: leadScans.framework,
        hosting: leadScans.hosting,
        pageCount: leadScans.pageCount,
        techStack: leadScans.techStack,
        companyIntelligence: leadScans.companyIntelligence,
        decisionMakers: leadScans.decisionMakers,
        migrationComplexity: leadScans.migrationComplexity,
        features: leadScans.features,
        integrations: leadScans.integrations,
        completedAt: leadScans.completedAt,
      })
      .from(leadScans)
      .where(eq(leadScans.id, qualificationScanId))
      .limit(1);

    if (!qualificationScan) {
      return NextResponse.json({
        qualificationScan: null,
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
      qualificationScan: {
        id: qualificationScan.id,
        status: qualificationScan.status,
        websiteUrl: qualificationScan.websiteUrl,
        cms: qualificationScan.cms,
        framework: qualificationScan.framework,
        hosting: qualificationScan.hosting,
        pageCount: qualificationScan.pageCount,
        techStack: parseJson(qualificationScan.techStack),
        companyIntelligence: parseJson(qualificationScan.companyIntelligence),
        decisionMakers: parseJson(qualificationScan.decisionMakers),
        migrationComplexity: parseJson(qualificationScan.migrationComplexity),
        features: parseJson(qualificationScan.features),
        integrations: parseJson(qualificationScan.integrations),
        completedAt: qualificationScan.completedAt?.toISOString() ?? null,
      },
      rfpExtraction: null, // Could be extended to include Qualification extraction data
    });
  } catch (error) {
    console.error('[qualification-scan-data] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
