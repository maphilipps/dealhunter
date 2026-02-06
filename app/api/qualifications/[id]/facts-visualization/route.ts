import { eq, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, leadScans } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { generateFactsVisualizationWithAI } from '@/lib/json-render/visualization-agent';

export const runtime = 'nodejs';

/**
 * GET /api/qualifications/[id]/facts-visualization
 * Generate Facts Tab visualization from LeadScan and ExtractedData
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: bidId } = await context.params;

  try {
    // Get bid and verify ownership
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, bidId), eq(preQualifications.userId, session.user.id)));

    if (!bid) {
      return new Response(JSON.stringify({ error: 'Bid not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!bid.qualificationScanId) {
      return new Response(JSON.stringify({ error: 'No QualificationScan found', tree: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get quick scan
    const [qualificationScan] = await db
      .select()
      .from(leadScans)
      .where(eq(leadScans.id, bid.qualificationScanId));

    if (!qualificationScan) {
      return new Response(JSON.stringify({ error: 'QualificationScan not found', tree: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get extracted data from preQualification
    let extractedData: ExtractedRequirements | null = null;
    if (bid.extractedRequirements) {
      try {
        extractedData = JSON.parse(bid.extractedRequirements) as ExtractedRequirements;
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Generate visualization tree with AI (full creative freedom)
    const tree = await generateFactsVisualizationWithAI(qualificationScan, extractedData);

    return new Response(JSON.stringify({ tree }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Facts visualization error:', error);
    return new Response(
      JSON.stringify({
        error: 'Facts visualization generation failed',
        tree: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
