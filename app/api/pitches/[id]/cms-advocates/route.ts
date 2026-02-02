/**
 * CMS Advocates API
 *
 * GET /api/pitches/[id]/cms-advocates
 *
 * Retrieves existing CMS advocate analysis results from RAG.
 * If no data exists, returns a structure indicating no analysis has been run.
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { synthesizeCMSComparison } from '@/lib/agents/cms-comparison-synthesizer-agent';
import { db } from '@/lib/db';
import { pitches } from '@/lib/db/schema';
import { queryRagForLead } from '@/lib/rag/lead-retrieval-service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;

  try {
    // 1. Verify lead exists
    const lead = await db.select().from(pitches).where(eq(pitches.id, leadId)).limit(1);

    if (!lead.length) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 2. Query RAG for CMS advocate data
    const ragResults = await queryRagForLead({
      pitchId: leadId,
      question:
        'CMS Advocate Vergleich Empfehlung Fit-Score Drupal Magnolia Ibexa FirstSpirit Sulu',
      agentNameFilter: 'cms_advocate_orchestrator',
      maxResults: 5,
    });

    // 3. No data - return empty state
    if (ragResults.length === 0) {
      return NextResponse.json({
        status: 'no_data',
        data: null,
        message: 'Keine CMS-Advocate-Analyse vorhanden. Bitte Analyse starten.',
      });
    }

    // 4. Synthesize RAG data into structured format
    const ragDataText = ragResults.map(r => r.content).join('\n\n');

    const synthesizedData = await synthesizeCMSComparison({
      leadId,
      ragData: ragDataText,
      customerProfile: {
        industry: lead[0].industry || undefined,
        companySize: undefined, // Could be extracted from RAG
        budget: lead[0].budget || undefined,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: synthesizedData,
    });
  } catch (error) {
    console.error('[CMS Advocates API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch CMS data' },
      { status: 500 }
    );
  }
}
