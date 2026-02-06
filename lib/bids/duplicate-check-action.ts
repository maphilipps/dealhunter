'use server';

import { eq, and } from 'drizzle-orm';

import { runDuplicateCheckAgent } from './duplicate-check-agent';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import type { ExtractedRequirements } from '@/lib/extraction/schema';
import { onAgentComplete } from '@/lib/workflow/orchestrator';

/**
 * Run Duplicate Check Agent for a Qualification
 * Called after user confirms extracted requirements
 *
 * DEA-90: Part of automated workflow orchestration
 */
export async function runDuplicateCheck(preQualificationId: string): Promise<{
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
    // 1. Fetch Qualification and verify ownership
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, preQualificationId),
          eq(preQualifications.userId, session.user.id)
        )
      );

    if (!preQualification) {
      return { success: false, error: 'Qualification nicht gefunden' };
    }

    // 2. Check if Qualification has extracted requirements
    if (!preQualification.extractedRequirements) {
      return { success: false, error: 'Qualification muss zuerst extrahiert werden' };
    }

    const extractedReqs: ExtractedRequirements = JSON.parse(
      preQualification.extractedRequirements
    ) as ExtractedRequirements;

    // 3. Run Duplicate Check Agent
    const duplicateResult = await runDuplicateCheckAgent({
      extractedRequirements: extractedReqs,
      accountId: preQualification.accountId || undefined,
      excludeRfpId: preQualificationId,
    });

    // 4. Save duplicate check result to Qualification
    await db
      .update(preQualifications)
      .set({
        duplicateCheckResult: JSON.stringify(duplicateResult),
        status: duplicateResult.hasDuplicates ? 'duplicate_warning' : 'duplicate_checking',
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId));

    // 5. If no duplicates, trigger next agent (Quick Scan)
    let nextAgent: string | undefined;

    if (!duplicateResult.hasDuplicates) {
      const result = await onAgentComplete(preQualificationId, 'DuplicateCheck');
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
