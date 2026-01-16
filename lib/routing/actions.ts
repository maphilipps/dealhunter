'use server';

import { db } from '@/lib/db';
import { bidOpportunities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Update bid with assigned business line
    await db
      .update(bidOpportunities)
      .set({
        assignedBusinessLineId: businessLineName,
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
