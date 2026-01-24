'use server';

import { eq, and } from 'drizzle-orm';

import { runDuplicateCheckAgent } from './duplicate-check-agent';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { onAgentComplete } from '@/lib/workflow/orchestrator';

/**
 * Run Duplicate Check Agent for an RFP
 * Called after user confirms extracted requirements
 *
 * DEA-90: Part of automated workflow orchestration
 */
export async function runDuplicateCheck(rfpId: string): Promise<{
  success: boolean;
  hasDuplicates?: boolean;
  error?: string;
  nextAgent?: string;
}> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // 1. Fetch RFP and verify ownership
    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.userId, session.user.id)));

    if (!rfp) {
      return { success: false, error: 'RFP nicht gefunden' };
    }

    // 2. Check if RFP has extracted requirements
    if (!rfp.extractedRequirements) {
      return { success: false, error: 'RFP muss zuerst extrahiert werden' };
    }

    const extractedReqs: ExtractedRequirements = JSON.parse(
      rfp.extractedRequirements
    ) as ExtractedRequirements;

    // 3. Run Duplicate Check Agent
    const duplicateResult = await runDuplicateCheckAgent({
      extractedRequirements: extractedReqs,
      accountId: rfp.accountId || undefined,
      excludeRfpId: rfpId,
    });

    // 4. Save duplicate check result to RFP
    await db
      .update(rfps)
      .set({
        duplicateCheckResult: JSON.stringify(duplicateResult),
        status: duplicateResult.hasDuplicates ? 'duplicate_warning' : 'duplicate_checking',
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId));

    // 5. If no duplicates, trigger next agent (Quick Scan)
    let nextAgent: string | undefined;

    if (!duplicateResult.hasDuplicates) {
      const result = await onAgentComplete(rfpId, 'DuplicateCheck');
      nextAgent = result.nextAgent;
    }

    return {
      success: true,
      hasDuplicates: duplicateResult.hasDuplicates,
      nextAgent,
    };
  } catch (error) {
    console.error('[Duplicate Check Action] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
