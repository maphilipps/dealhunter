'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { matchBusinessLine } from './routing-agent';
import { type RouteBusinessUnitInput } from './schemas';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, businessUnits } from '@/lib/db/schema';
import { sendBLAssignmentEmail } from '@/lib/notifications/email';

export interface AssignBusinessUnitInput {
  bidId: string;
  businessLineName: string;
  overrideReason?: string; // Required if overriding AI recommendation
}

export interface AssignBusinessUnitResult {
  success: boolean;
  error?: string;
  warning?: string;
  leadId?: string;
}

/**
 * ROUTE-001, ROUTE-002: Assigns bid opportunity to business line
 * - Uses AI recommendation by default
 * - Allows override with reason (ROUTE-002)
 * - Updates status to 'routed'
 */
export async function assignBusinessUnit(
  input: AssignBusinessUnitInput
): Promise<AssignBusinessUnitResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const { bidId, businessLineName, overrideReason } = input;

    // Validate input
    if (!bidId || !businessLineName) {
      return {
        success: false,
        error: 'Bid ID and Business Unit sind erforderlich',
      };
    }

    // Get bid
    const bids = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (bids.length === 0) {
      return {
        success: false,
        error: 'Bid nicht gefunden',
      };
    }

    const bid = bids[0];

    // Validate status - must be a routing-ready state
    const routingReadyStates = ['decision_made', 'bit_pending', 'bid_voted', 'questions_ready'];
    if (!routingReadyStates.includes(bid.status)) {
      return {
        success: false,
        error: `Bid muss in einem routing-bereiten Status sein (${routingReadyStates.join(', ')}). Aktuell: ${bid.status}`,
      };
    }

    // Validate BIT decision (only if status indicates a decision was made)
    if ((bid.status === 'decision_made' || bid.status === 'bid_voted') && bid.decision !== 'bid') {
      return {
        success: false,
        error: 'Nur BIT-Opportunities können geroutet werden',
      };
    }

    // Get business line details for email notification
    const bls = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.name, businessLineName))
      .limit(1);

    if (bls.length === 0) {
      return {
        success: false,
        error: 'Business Unit nicht gefunden',
      };
    }

    const businessLine = bls[0];

    // Parse extracted requirements for email
    const extractedReqs = bid.extractedRequirements
      ? (JSON.parse(bid.extractedRequirements) as Record<string, unknown>)
      : {};
    const customerName = (extractedReqs.customerName as string | undefined) || 'Unbekannter Kunde';
    const projectDescription =
      (extractedReqs.projectDescription as string | undefined) || 'Keine Beschreibung verfügbar';

    // DEA-25: Create audit log if this is an override
    const aiRecommendation = bid.quickScanResults
      ? (JSON.parse(bid.quickScanResults) as Record<string, unknown>).recommendedBusinessUnit
      : null;

    if (overrideReason) {
      await createAuditLog({
        action: 'bl_override',
        entityType: 'rfp',
        entityId: bidId,
        previousValue: (aiRecommendation as string | null) ?? undefined,
        newValue: businessLineName,
        reason: overrideReason,
      });
    }

    // Update bid with assigned business line
    const notifiedAt = new Date();
    await db
      .update(rfps)
      .set({
        assignedBusinessUnitId: businessLine.id,
        assignedBLNotifiedAt: notifiedAt,
        status: 'routed',
        updatedAt: new Date(),
        // Store override reason in metadata if provided
        ...(overrideReason && {
          metadata: JSON.stringify({
            ...(bid.metadata ? JSON.parse(bid.metadata) : {}),
            blOverride: {
              reason: overrideReason,
              overriddenAt: new Date().toISOString(),
            },
          }),
        }),
      })
      .where(eq(rfps.id, bidId));

    // DEA-38: Auto-convert to Lead when status becomes 'routed'
    const { convertRfpToLead } = await import('@/lib/leads/actions');
    const leadResult = await convertRfpToLead({ rfpId: bidId });

    let leadId: string | undefined;
    if (leadResult.success) {
      leadId = leadResult.leadId;
    } else {
      console.error('Lead conversion failed:', leadResult.error);
      // Don't fail the entire operation - the routing was successful
    }

    // Revalidate cache for updated views
    revalidatePath(`/bl-review/${bidId}`);
    revalidatePath('/bl-review');
    revalidatePath('/leads');
    if (leadId) {
      revalidatePath(`/leads/${leadId}`);
    }

    // ROUTE-003: Send email notification to BL leader
    const emailResult = await sendBLAssignmentEmail({
      blLeaderName: businessLine.leaderName,
      blLeaderEmail: businessLine.leaderEmail,
      businessLineName: businessLine.name,
      customerName,
      projectDescription,
      bidId,
    });

    if (!emailResult.success) {
      console.error('Failed to send BL assignment email:', emailResult.error);
      // Don't fail the entire operation if email fails
      // The assignment was successful, just log the email error
    }

    return {
      success: true,
      leadId,
      warning: emailResult.success
        ? undefined
        : 'Zuweisung erfolgreich, aber E-Mail-Benachrichtigung fehlgeschlagen',
    };
  } catch (error) {
    console.error('Error assigning business line:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * Get list of available business units
 */
export async function getAvailableBusinessUnits(): Promise<string[]> {
  const units = await db
    .select({ name: businessUnits.name })
    .from(businessUnits)
    .orderBy(businessUnits.name);

  return units.map(u => u.name);
}

/**
 * DEA-5: Get AI-powered Business Line recommendation
 *
 * Analyzes bid requirements and recommends the best-matching business line
 * with confidence score and reasoning.
 *
 * @param bidId - ID of the bid opportunity
 * @returns AI recommendation with confidence score
 */
export async function getBusinessLineRecommendation(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get bid with extracted requirements
    const bids = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

    if (bids.length === 0) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    const bid = bids[0];

    // Parse extracted requirements
    const extractedReqs = bid.extractedRequirements
      ? (JSON.parse(bid.extractedRequirements) as Record<string, unknown>)
      : {};

    // Parse quick scan results if available
    const quickScan = bid.quickScanResults
      ? (JSON.parse(bid.quickScanResults) as Record<string, unknown>)
      : {};

    // Build input for routing agent
    const routingInput: RouteBusinessUnitInput = {
      customerName: extractedReqs.customerName as string | undefined,
      projectDescription: extractedReqs.projectDescription as string | undefined,
      requirements: extractedReqs.requirements as string | undefined,
      websiteUrl: bid.websiteUrl || (extractedReqs.websiteUrl as string | undefined) || undefined,
      industry: extractedReqs.industry as string | undefined,
      technologies:
        ((quickScan.techStack as Record<string, unknown> | undefined)?.detected as
          | string[]
          | undefined) ||
        (extractedReqs.technologies as string[] | undefined) ||
        [],
    };

    // Call AI routing agent
    const result = await matchBusinessLine(routingInput);

    if (!result.success || !result.result) {
      return {
        success: false,
        error: result.error || 'Routing-Empfehlung konnte nicht erstellt werden',
      };
    }

    return {
      success: true,
      recommendation: result.result,
    };
  } catch (error) {
    console.error('Error getting business line recommendation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}
