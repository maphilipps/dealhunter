import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import { runPreQualSectionAgent } from '@/lib/json-render/prequal-section-agent';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preQualificationId, sectionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const allowWebEnrichment = body.allowWebEnrichment === true;

    const preQualification = await db.query.preQualifications.findFirst({
      where: and(
        eq(preQualifications.id, preQualificationId),
        eq(preQualifications.userId, session.user.id)
      ),
    });

    if (!preQualification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await runPreQualSectionAgent({
      preQualificationId,
      sectionId,
      allowWebEnrichment,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Generation failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Visualisierung für ${sectionId} erstellt`,
    });
  } catch (error) {
    console.error('[PreQual Visualize API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
