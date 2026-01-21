'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { rfps, auditTrails } from '@/lib/db/schema';

interface RouteRfpParams {
  rfpId: string;
  businessLineId: string;
  reason?: string;
  userId: string;
  overrideRecommendation: boolean;
}

interface RouteRfpResult {
  success: boolean;
  error?: string;
}

/**
 * Route RFP to Business Line
 *
 * Updates RFP status to 'routed' and assigns business line.
 * Creates audit trail for tracking.
 */
export async function routeRfpToBusinessLine(params: RouteRfpParams): Promise<RouteRfpResult> {
  try {
    const { rfpId, businessLineId, reason, userId, overrideRecommendation } = params;

    // Get current RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP nicht gefunden' };
    }

    // Check ownership
    if (rfp.userId !== userId) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Check status - should be in bit_pending (waiting for BL routing)
    // Note: BID/NO-BID decision is now made by BL AFTER routing, not by BD before routing
    if (rfp.status !== 'bit_pending') {
      return {
        success: false,
        error: `RFP Status ungültig: ${rfp.status}. Erwartet: bit_pending (BL-Routing bereit)`,
      };
    }

    // Update RFP
    await db
      .update(rfps)
      .set({
        assignedBusinessUnitId: businessLineId,
        assignedBLNotifiedAt: new Date(),
        status: 'routed',
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId));

    // Create audit trail
    await db.insert(auditTrails).values({
      userId,
      action: 'bl_override',
      entityType: 'rfp',
      entityId: rfpId,
      previousValue: rfp.assignedBusinessUnitId || null,
      newValue: businessLineId,
      reason:
        reason ||
        (overrideRecommendation
          ? 'Manual override of AI recommendation'
          : 'Accepted AI recommendation'),
    });

    // Revalidate paths
    revalidatePath(`/rfps/${rfpId}`);
    revalidatePath('/rfps');

    return { success: true };
  } catch (error) {
    console.error('Error routing RFP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
