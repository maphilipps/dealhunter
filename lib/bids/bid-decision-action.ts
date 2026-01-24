'use server';

import { eq, and } from 'drizzle-orm';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications } from '@/lib/db/schema';
import { handleBidDecision } from '@/lib/workflow/orchestrator';

/**
 * Manual BID/NO-BID Decision Action (DEA-90)
 *
 * Called when BD Manager makes a manual BID or NO-BID decision.
 * Triggers Timeline Agent if BID, archives if NO-BID.
 */
export async function makeBidDecision(
  rfpId: string,
  decision: 'bid' | 'no_bid'
): Promise<{
  success: boolean;
  decision?: 'bid' | 'no_bid';
  nextAgent?: string;
  error?: string;
}> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // 1. Fetch RFP and verify ownership
    const [rfp] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, rfpId), eq(preQualifications.userId, session.user.id)));

    if (!rfp) {
      return { success: false, error: 'RFP nicht gefunden' };
    }

    // 2. Verify RFP is in correct status (bit_pending)
    if (rfp.status !== 'bit_pending') {
      return {
        success: false,
        error: `RFP muss im Status "BID/NO-BID Entscheidung erforderlich" sein (aktuell: ${rfp.status})`,
      };
    }

    console.error(
      `[BID Decision Action] User ${session.user.id} decided "${decision}" for RFP ${rfpId}`
    );

    // 3. Use orchestrator to handle the decision
    // This will either trigger Timeline Agent (BID) or archive (NO-BID)
    const result = await handleBidDecision(rfpId, decision);

    // 4. Create audit log
    await createAuditLog({
      action: 'bid_override', // Using existing enum value
      entityType: 'pre_qualification',
      entityId: rfpId,
      previousValue: 'pending',
      newValue: decision,
      reason: `Manual ${decision.toUpperCase()} decision by BD Manager`,
    });

    return {
      success: true,
      decision,
      nextAgent: result.nextAgent,
    };
  } catch (error) {
    console.error('[BID Decision Action] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
