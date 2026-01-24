/**
 * API Route: Calc-Sheet Generator
 *
 * GET /api/qualifications/[id]/calc-sheet
 * Generates or retrieves calc-sheet data for a lead.
 * Uses RAG data if available, otherwise generates via AI.
 */

import { NextRequest, NextResponse } from 'next/server';

import { generateCalcSheet } from '@/lib/agents/calc-sheet-generator-agent';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadId } = await params;

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    console.error(`[Calc-Sheet API] Generating calc-sheet for lead: ${leadId}`);

    const result = await generateCalcSheet({ leadId });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Calc-Sheet API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate calc-sheet' },
      { status: 500 }
    );
  }
}
