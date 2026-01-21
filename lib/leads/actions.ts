'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rfps, leads, businessUnits } from '@/lib/db/schema';

export interface ConvertRfpToLeadInput {
  rfpId: string;
}

export interface ConvertRfpToLeadResult {
  success: boolean;
  leadId?: string;
  error?: string;
}

/**
 * DEA-38: Converts an RFP to a Lead when status is set to 'routed'
 *
 * This function:
 * 1. Validates that the RFP exists and has status 'routed'
 * 2. Creates a Lead record with data from the RFP
 * 3. Creates an audit trail entry
 *
 * Note: BL (Bereichsleiter) will decide BID/NO-BID in Lead Dashboard (Phase 2)
 *
 * @param input - RFP ID to convert
 * @returns Lead ID if successful
 */
/**
 * DEA-100: Get all leads filtered by current user's business unit
 *
 * This function:
 * 1. Checks user authentication and business unit assignment
 * 2. Filters leads to only show those assigned to user's BU
 * 3. Returns leads sorted by created date (newest first)
 *
 * @returns Array of leads for the user's business unit
 */
export async function getLeads() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert', leads: [] };
  }

  try {
    // Get user's business unit
    const { users } = await import('@/lib/db/schema');
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

    if (!user) {
      return { success: false, error: 'Benutzer nicht gefunden', leads: [] };
    }

    // Admin can see all leads, BL sees only their BU leads, BD sees none (they work with RFPs)
    const { desc } = await import('drizzle-orm');
    let userLeads;

    if (session.user.role === 'admin') {
      // Admin sees all leads
      userLeads = await db.select().from(leads).orderBy(desc(leads.createdAt));
    } else if (session.user.role === 'bl' && user.businessUnitId) {
      // BL sees only their BU leads
      userLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.businessUnitId, user.businessUnitId))
        .orderBy(desc(leads.createdAt));
    } else {
      // BD role should work with RFPs, not leads
      return { success: true, leads: [] };
    }

    return { success: true, leads: userLeads };
  } catch (error) {
    console.error('Get leads error:', error);
    return { success: false, error: 'Fehler beim Laden der Leads', leads: [] };
  }
}

export async function convertRfpToLead(
  input: ConvertRfpToLeadInput
): Promise<ConvertRfpToLeadResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    const { rfpId } = input;

    // Validate input
    if (!rfpId) {
      return {
        success: false,
        error: 'RFP ID ist erforderlich',
      };
    }

    // Get RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return {
        success: false,
        error: 'RFP nicht gefunden',
      };
    }

    // Validate status - must be 'routed'
    if (rfp.status !== 'routed') {
      return {
        success: false,
        error: 'RFP muss Status "routed" haben',
      };
    }

    // Validate business unit assignment
    if (!rfp.assignedBusinessUnitId) {
      return {
        success: false,
        error: 'RFP muss einer Business Unit zugewiesen sein',
      };
    }

    // Check if business unit exists
    const [businessUnit] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, rfp.assignedBusinessUnitId))
      .limit(1);

    if (!businessUnit) {
      return {
        success: false,
        error: 'Zugewiesene Business Unit nicht gefunden',
      };
    }

    // Parse extracted requirements for lead data
    const extractedReqs = rfp.extractedRequirements
      ? (JSON.parse(rfp.extractedRequirements) as Record<string, unknown>)
      : {};

    // Parse Quick Scan data for decision makers (DEA-92)
    let quickScanData: Record<string, unknown> | null = null;
    let decisionMakers: unknown[] | null = null;

    if (rfp.quickScanId) {
      // Load Quick Scan data if quickScanId is set
      const { quickScans } = await import('@/lib/db/schema');
      const [quickScan] = await db
        .select()
        .from(quickScans)
        .where(eq(quickScans.id, rfp.quickScanId))
        .limit(1);

      if (quickScan?.decisionMakers) {
        quickScanData = quickScan as unknown as Record<string, unknown>;
        decisionMakers = JSON.parse(quickScan.decisionMakers as string) as unknown[];
      }
    }

    // Check if lead already exists for this RFP
    const existingLead = await db.select().from(leads).where(eq(leads.rfpId, rfpId)).limit(1);

    if (existingLead.length > 0) {
      return {
        success: false,
        error: 'Für dieses RFP wurde bereits ein Lead erstellt',
      };
    }

    // Create Lead
    const [newLead] = await db
      .insert(leads)
      .values({
        rfpId: rfp.id,
        status: 'routed',
        customerName: (extractedReqs.customerName as string | undefined) || 'Unbekannter Kunde',
        websiteUrl: rfp.websiteUrl || (extractedReqs.websiteUrl as string | undefined) || null,
        industry: (extractedReqs.industry as string | undefined) || null,
        projectDescription: (extractedReqs.projectDescription as string | undefined) || null,
        budget: (extractedReqs.budget as string | undefined) || null,
        requirements: extractedReqs.requirements
          ? JSON.stringify(extractedReqs.requirements)
          : null,
        businessUnitId: rfp.assignedBusinessUnitId,
        quickScanId: rfp.quickScanId || null,
        decisionMakers: decisionMakers ? JSON.stringify(decisionMakers) : null,
        routedAt: new Date(),
      })
      .returning();

    // Create audit trail
    await createAuditLog({
      action: 'create',
      entityType: 'rfp',
      entityId: rfpId,
      previousValue: null,
      newValue: JSON.stringify({
        leadId: newLead.id,
        status: 'routed',
        businessUnitId: rfp.assignedBusinessUnitId,
      }),
      reason: 'Automatische Lead-Erstellung bei RFP-Status "routed"',
    });

    // Revalidate cache
    revalidatePath(`/rfps/${rfpId}`);
    revalidatePath('/rfps');
    revalidatePath('/leads');

    return {
      success: true,
      leadId: newLead.id,
    };
  } catch (error) {
    console.error('Error converting RFP to Lead:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}
