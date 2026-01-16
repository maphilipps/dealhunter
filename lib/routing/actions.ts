'use server';

import { db } from '@/lib/db';
import { bidOpportunities, businessLines } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendBLAssignmentEmail } from '@/lib/notifications/email';

export interface AssignBusinessLineInput {
  bidId: string;
  businessLineName: string;
  overrideReason?: string; // Required if overriding AI recommendation
}

export interface AssignBusinessLineResult {
  success: boolean;
  error?: string;
}

/**
 * ROUTE-001, ROUTE-002: Assigns bid opportunity to business line
 * - Uses AI recommendation by default
 * - Allows override with reason (ROUTE-002)
 * - Updates status to 'routed'
 */
export async function assignBusinessLine(
  input: AssignBusinessLineInput
): Promise<AssignBusinessLineResult> {
  try {
    const { bidId, businessLineName, overrideReason } = input;

    // Validate input
    if (!bidId || !businessLineName) {
      return {
        success: false,
        error: 'Bid ID and Business Line sind erforderlich',
      };
    }

    // Get bid
    const bids = await db
      .select()
      .from(bidOpportunities)
      .where(eq(bidOpportunities.id, bidId))
      .limit(1);

    if (bids.length === 0) {
      return {
        success: false,
        error: 'Bid nicht gefunden',
      };
    }

    const bid = bids[0];

    // Validate status - must be bit_decided
    if (bid.status !== 'bit_decided') {
      return {
        success: false,
        error: 'Bid muss in Status "bit_decided" sein',
      };
    }

    // Validate BIT decision
    if (bid.bitDecision !== 'bit') {
      return {
        success: false,
        error: 'Nur BIT-Opportunities können geroutet werden',
      };
    }

    // Get business line details for email notification
    const bls = await db
      .select()
      .from(businessLines)
      .where(eq(businessLines.name, businessLineName))
      .limit(1);

    if (bls.length === 0) {
      return {
        success: false,
        error: 'Business Line nicht gefunden',
      };
    }

    const businessLine = bls[0];

    // Parse extracted requirements for email
    const extractedReqs = bid.extractedRequirements
      ? JSON.parse(bid.extractedRequirements)
      : {};
    const customerName = extractedReqs.customerName || 'Unbekannter Kunde';
    const projectDescription = extractedReqs.projectDescription || 'Keine Beschreibung verfügbar';

    // Update bid with assigned business line
    const notifiedAt = new Date();
    await db
      .update(bidOpportunities)
      .set({
        assignedBusinessLineId: businessLineName,
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
      .where(eq(bidOpportunities.id, bidId));

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
 * Get list of available business lines
 */
export async function getAvailableBusinessLines(): Promise<string[]> {
  // These are the business lines known to the Quick Scan agent
  // In a production system, these would come from the database
  return [
    'Banking & Insurance',
    'Automotive',
    'Energy & Utilities',
    'Retail & E-Commerce',
    'Healthcare',
    'Public Sector',
    'Manufacturing',
    'Technology & Innovation',
  ];
}
