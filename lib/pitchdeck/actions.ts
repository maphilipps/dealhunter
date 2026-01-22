'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, pitchdecks, pitchdeckDeliverables, rfps } from '@/lib/db/schema';

export interface CreatePitchdeckResult {
  success: boolean;
  pitchdeckId?: string;
  error?: string;
}

/**
 * DEA-160 (PA-001): Create Pitchdeck after BID Decision
 *
 * This function:
 * 1. Creates a pitchdeck record for the lead
 * 2. Copies deliverables from RFP extractedRequirements
 * 3. Sets status to 'draft'
 * 4. Creates audit trail
 *
 * This is called automatically after a BID vote is cast.
 *
 * @param leadId - The lead ID to create pitchdeck for
 * @returns Pitchdeck ID if successful
 */
export async function createPitchdeck(leadId: string): Promise<CreatePitchdeckResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Verify lead has BID vote
    if (lead.blVote !== 'BID') {
      return {
        success: false,
        error: 'Pitchdeck kann nur für Leads mit BID-Entscheidung erstellt werden',
      };
    }

    // Check if pitchdeck already exists
    const existingPitchdeck = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.leadId, leadId))
      .limit(1);

    if (existingPitchdeck.length > 0) {
      return {
        success: false,
        error: 'Für diesen Lead wurde bereits ein Pitchdeck erstellt',
      };
    }

    // Get RFP to extract deliverables
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, lead.rfpId)).limit(1);

    if (!rfp) {
      return {
        success: false,
        error: 'RFP nicht gefunden',
      };
    }

    // Create pitchdeck
    const [newPitchdeck] = await db
      .insert(pitchdecks)
      .values({
        leadId,
        status: 'draft',
      })
      .returning();

    // Parse extracted requirements to get deliverables
    let requiredDeliverables: { name: string; format?: string; mandatory?: boolean }[] = [];

    if (rfp.extractedRequirements) {
      try {
        const extractedReqs = JSON.parse(rfp.extractedRequirements) as Record<string, unknown>;
        if (Array.isArray(extractedReqs.requiredDeliverables)) {
          requiredDeliverables = extractedReqs.requiredDeliverables as {
            name: string;
            format?: string;
            mandatory?: boolean;
          }[];
        }
      } catch (error) {
        console.error('Error parsing RFP extractedRequirements:', error);
        // Continue without deliverables if parsing fails
      }
    }

    // Create deliverable entries
    if (requiredDeliverables.length > 0) {
      const deliverableValues = requiredDeliverables.map(deliverable => ({
        pitchdeckId: newPitchdeck.id,
        deliverableName: deliverable.name,
        status: 'open' as const,
      }));

      await db.insert(pitchdeckDeliverables).values(deliverableValues);
    }

    // Create audit trail
    await createAuditLog({
      action: 'create',
      entityType: 'rfp',
      entityId: leadId,
      previousValue: null,
      newValue: JSON.stringify({
        pitchdeckId: newPitchdeck.id,
        status: 'draft',
        deliverableCount: requiredDeliverables.length,
      }),
      reason: 'Automatische Pitchdeck-Erstellung nach BID-Entscheidung',
    });

    // Revalidate cache
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/leads');

    return {
      success: true,
      pitchdeckId: newPitchdeck.id,
    };
  } catch (error) {
    console.error('Error creating pitchdeck:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}
