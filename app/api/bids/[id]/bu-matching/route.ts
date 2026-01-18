import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quickScans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAllBUMatches } from '@/lib/business-units/matching';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get quick scan for this bid
    const quickScanResults = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.bidOpportunityId, id))
      .limit(1);

    if (quickScanResults.length === 0) {
      return NextResponse.json(
        { error: 'Quick Scan nicht gefunden' },
        { status: 404 }
      );
    }

    const quickScan = quickScanResults[0];

    if (quickScan.status !== 'completed') {
      return NextResponse.json(
        { error: 'Quick Scan noch nicht abgeschlossen' },
        { status: 400 }
      );
    }

    // Calculate BU matches
    const matches = await getAllBUMatches(quickScan);

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('Error calculating BU matches:', error);
    return NextResponse.json(
      { error: 'Fehler beim Berechnen der BU Matches' },
      { status: 500 }
    );
  }
}
