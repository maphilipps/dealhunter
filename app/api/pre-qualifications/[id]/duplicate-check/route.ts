import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { runDuplicateCheckAgent } from '@/lib/bids/duplicate-check-agent';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { onAgentComplete } from '@/lib/workflow/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/pre-qualifications/[id]/duplicate-check
 *
 * Run Duplicate Check Agent for an Pre-Qualification
 * Called automatically by workflow orchestrator or manually by user
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // 2. Fetch Pre-Qualification and verify ownership
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, id), eq(preQualifications.userId, session.user.id)));

    if (!preQualification) {
      return NextResponse.json({ error: 'Pre-Qualification not found' }, { status: 404 });
    }

    // 3. Check if Pre-Qualification has extracted requirements (needed for duplicate check)
    if (!preQualification.extractedRequirements) {
      return NextResponse.json({ error: 'Pre-Qualification must be extracted first' }, { status: 400 });
    }

    const extractedReqs = JSON.parse(preQualification.extractedRequirements) as ExtractedRequirements;

    // 4. Run Duplicate Check Agent
    const duplicateResult = await runDuplicateCheckAgent({
      extractedRequirements: extractedReqs,
      accountId: preQualification.accountId || undefined,
      excludeRfpId: id,
    });

    // 5. Save duplicate check result to Pre-Qualification
    await db
      .update(preQualifications)
      .set({
        duplicateCheckResult: JSON.stringify(duplicateResult),
        status: duplicateResult.hasDuplicates ? 'duplicate_warning' : 'duplicate_checking',
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, id));

    // 6. If no duplicates, trigger next agent (Extract)
    if (!duplicateResult.hasDuplicates) {
      await onAgentComplete(id, 'DuplicateCheck');
    }

    return NextResponse.json({
      success: true,
      result: duplicateResult,
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
