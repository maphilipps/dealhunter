import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { runSummaryAgent } from '@/lib/agents/expert-agents/summary-agent';

/**
 * POST /api/pre-qualifications/[id]/rerun-summary
 *
 * Manually reruns summary agent for an already completed pre-qualification
 * Used when summary needs to be regenerated after a fix
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: preQualificationId } = await context.params;

  try {
    console.log(`[Summary Rerun] Starting summary agent for ${preQualificationId}`);

    const result = await runSummaryAgent({ preQualificationId });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(`[Summary Rerun] Summary agent completed for ${preQualificationId}`);

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Summary regenerated successfully',
    });
  } catch (error) {
    console.error('[Summary Rerun] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
