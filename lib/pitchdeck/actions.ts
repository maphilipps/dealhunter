'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  leads,
  pitchdecks,
  pitchdeckDeliverables,
  rfps,
  employees,
  ptEstimations,
} from '@/lib/db/schema';
import { suggestTeam } from '@/lib/team/agent';
import type { TeamSuggestion } from '@/lib/team/schema';

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

export interface SuggestPitchdeckTeamResult {
  success: boolean;
  suggestion?: TeamSuggestion;
  error?: string;
}

/**
 * DEA-161 (PA-002): Generate Team Suggestions for Pitchdeck
 *
 * This function:
 * 1. Gets the pitchdeck and associated lead/RFP data
 * 2. Retrieves PT-Estimation to determine required roles
 * 3. Queries available employees from the lead's business unit
 * 4. Uses AI Staffing Agent to generate team suggestions
 * 5. Returns ranked team suggestions based on skills and availability
 *
 * @param pitchdeckId - The pitchdeck ID to generate team suggestions for
 * @returns Team suggestion with ranked employees per role
 */
export async function suggestPitchdeckTeam(
  pitchdeckId: string
): Promise<SuggestPitchdeckTeamResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get pitchdeck
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return {
        success: false,
        error: 'Pitchdeck nicht gefunden',
      };
    }

    // Get lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, pitchdeck.leadId)).limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Get RFP for extracted requirements
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, lead.rfpId)).limit(1);

    if (!rfp) {
      return {
        success: false,
        error: 'RFP nicht gefunden',
      };
    }

    // Get PT-Estimation if available (determines required roles)
    const [ptEstimation] = await db
      .select()
      .from(ptEstimations)
      .where(eq(ptEstimations.leadId, lead.id))
      .limit(1);

    // Get Quick Scan results if available
    let quickScanResults = null;
    if (lead.quickScanId) {
      const { quickScans } = await import('@/lib/db/schema');
      const [quickScan] = await db
        .select()
        .from(quickScans)
        .where(eq(quickScans.id, lead.quickScanId))
        .limit(1);

      if (quickScan) {
        quickScanResults = {
          cms: quickScan.cms,
          framework: quickScan.framework,
          techStack: quickScan.techStack ? JSON.parse(quickScan.techStack) : [],
          integrations: quickScan.integrations ? JSON.parse(quickScan.integrations) : [],
          features: quickScan.features ? JSON.parse(quickScan.features) : [],
        };
      }
    }

    // Get available employees from the lead's business unit
    // Prioritize: available > on_project > unavailable
    const availableEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.businessUnitId, lead.businessUnitId))
      .limit(50);

    // Parse extracted requirements
    const extractedRequirements = rfp.extractedRequirements
      ? (JSON.parse(rfp.extractedRequirements) as Record<string, unknown>)
      : {};

    // Add PT-Estimation roles context if available
    if (ptEstimation?.disciplines) {
      try {
        const disciplines = JSON.parse(ptEstimation.disciplines) as Record<string, unknown>;
        extractedRequirements.ptDisciplines = disciplines;
      } catch (error) {
        console.error('Error parsing PT disciplines:', error);
      }
    }

    // Generate team suggestion using existing AI agent
    const suggestion = await suggestTeam({
      bidId: lead.rfpId, // Use RFP ID for consistency
      extractedRequirements,
      quickScanResults,
      assignedBusinessLine: lead.businessUnitId,
      availableEmployees,
    });

    // Update pitchdeck status to 'team_proposed'
    await db
      .update(pitchdecks)
      .set({
        status: 'team_proposed',
        updatedAt: new Date(),
      })
      .where(eq(pitchdecks.id, pitchdeckId));

    // Create audit trail
    await createAuditLog({
      action: 'update',
      entityType: 'rfp',
      entityId: lead.id,
      previousValue: JSON.stringify({ status: pitchdeck.status }),
      newValue: JSON.stringify({
        status: 'team_proposed',
        teamMemberCount: suggestion.members.length,
        overallConfidence: suggestion.overallConfidence,
      }),
      reason: 'Team-Vorschläge durch Staffing Agent generiert',
    });

    // Revalidate cache
    revalidatePath(`/leads/${lead.id}/pitchdeck`);
    revalidatePath(`/leads/${lead.id}`);

    return {
      success: true,
      suggestion,
    };
  } catch (error) {
    console.error('Error generating pitchdeck team suggestions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}
