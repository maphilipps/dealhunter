import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { runSummaryAgent } from '@/lib/agents/expert-agents/summary-agent';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';

/**
 * POST /api/qualifications/[id]/rerun-summary
 *
 * Manually reruns summary agent for an already completed qualification
 * Used when summary needs to be regenerated after a fix
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: qualificationId } = await context.params;

  // Ownership verification
  const [qualification] = await db
    .select({ id: preQualifications.id })
    .from(preQualifications)
    .where(
      and(eq(preQualifications.id, qualificationId), eq(preQualifications.userId, session.user.id))
    );
  if (!qualification) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    console.log(`[Summary Rerun] Starting summary agent for ${qualificationId}`);

    const result = await runSummaryAgent({ preQualificationId: qualificationId });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(`[Summary Rerun] Summary agent completed for ${qualificationId}`);

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Summary regenerated successfully',
    });
  } catch (error) {
    console.error('[Summary Rerun] Error:', error);
    return NextResponse.json(
      { error: 'Zusammenfassung konnte nicht erstellt werden' },
      { status: 500 }
    );
  }
}
