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
 * 2. Validates that the RFP has decision='bid'
 * 3. Creates a Lead record with data from the RFP
 * 4. Creates an audit trail entry
 *
 * @param input - RFP ID to convert
 * @returns Lead ID if successful
 */
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

    // Validate decision - must be 'bid'
    if (rfp.decision !== 'bid') {
      return {
        success: false,
        error: 'Nur BID-RFPs können zu Leads konvertiert werden',
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
