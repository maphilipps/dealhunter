import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getAllBUMatches } from '@/lib/business-units/matching';
import { db } from '@/lib/db';
import { leadScans, preQualifications } from '@/lib/db/schema';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Ownership verification
    const [qualification] = await db
      .select({ id: preQualifications.id })
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));
    if (!qualification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get lead scan for this bid
    const qualificationScanResults = await db
      .select()
      .from(leadScans)
      .where(eq(leadScans.preQualificationId, id))
      .limit(1);

    if (qualificationScanResults.length === 0) {
      return NextResponse.json({ error: 'Qualification nicht gefunden' }, { status: 404 });
    }

    const qualificationScan = qualificationScanResults[0];

    if (qualificationScan.status !== 'completed') {
      return NextResponse.json(
        { error: 'Qualification noch nicht abgeschlossen' },
        { status: 400 }
      );
    }

    // Calculate BU matches
    const matches = await getAllBUMatches(qualificationScan);

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('Error calculating BU matches:', error);
    return NextResponse.json({ error: 'Fehler beim Berechnen der BU Matches' }, { status: 500 });
  }
}
