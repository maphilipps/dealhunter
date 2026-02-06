'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import pLimit from 'p-limit';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { generateCompleteSolution, type SolutionInput } from '@/lib/agents/solution-agent';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  pitches,
  pitchdecks,
  pitchdeckDeliverables,
  preQualifications,
  employees,
  ptEstimations,
} from '@/lib/db/schema';
import { calculateInternalDeadlines } from '@/lib/pitchdeck/timeline-calculator';
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
 * 1. Creates a pitchdeck record for the qualification
 * 2. Copies deliverables from Qualification extractedRequirements
 * 3. Sets status to 'draft'
 * 4. Creates audit trail
 *
 * This is called automatically after a BID vote is cast.
 *
 * @param pitchId - The qualification ID to create pitchdeck for
 * @returns Pitchdeck ID if successful
 */
export async function createPitchdeck(pitchId: string): Promise<CreatePitchdeckResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get lead
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

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
      .where(eq(pitchdecks.pitchId, pitchId))
      .limit(1);

    if (existingPitchdeck.length > 0) {
      return {
        success: false,
        error: 'Für diesen Lead wurde bereits ein Pitchdeck erstellt',
      };
    }

    // Get Qualification to extract deliverables
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (!preQualification) {
      return {
        success: false,
        error: 'Qualification nicht gefunden',
      };
    }

    // Create pitchdeck
    const [newPitchdeck] = await db
      .insert(pitchdecks)
      .values({
        pitchId: pitchId,
        status: 'draft',
      })
      .returning();

    // Parse extracted requirements to get deliverables and deadline
    let requiredDeliverables: { name: string; format?: string; mandatory?: boolean }[] = [];
    let rfpDeadline: Date | null = null;

    if (preQualification.extractedRequirements) {
      try {
        const extractedReqs = JSON.parse(preQualification.extractedRequirements) as Record<
          string,
          unknown
        >;
        if (Array.isArray(extractedReqs.requiredDeliverables)) {
          requiredDeliverables = extractedReqs.requiredDeliverables as {
            name: string;
            format?: string;
            mandatory?: boolean;
          }[];
        }

        // Extract Qualification deadline if available
        if (extractedReqs.deadline) {
          if (typeof extractedReqs.deadline === 'string') {
            rfpDeadline = new Date(extractedReqs.deadline);
          } else if (extractedReqs.deadline instanceof Date) {
            rfpDeadline = extractedReqs.deadline;
          }
        }
      } catch (error) {
        console.error('Error parsing Qualification extractedRequirements:', error);
        // Continue without deliverables if parsing fails
      }
    }

    // Calculate internal deadlines if Qualification deadline exists
    let internalDeadlines: Date[] = [];
    if (rfpDeadline && requiredDeliverables.length > 0) {
      try {
        internalDeadlines = calculateInternalDeadlines(rfpDeadline, requiredDeliverables.length);
      } catch (error) {
        console.error('Error calculating internal deadlines:', error);
        // Continue without internal deadlines if calculation fails
      }
    }

    // Create deliverable entries with internal deadlines
    if (requiredDeliverables.length > 0) {
      const deliverableValues = requiredDeliverables.map((deliverable, index) => ({
        pitchdeckId: newPitchdeck.id,
        deliverableName: deliverable.name,
        status: 'open' as const,
        internalDeadline: internalDeadlines[index] || null,
      }));

      await db.insert(pitchdeckDeliverables).values(deliverableValues);
    }

    // Create audit trail
    await createAuditLog({
      action: 'create',
      entityType: 'qualification',
      entityId: pitchId,
      previousValue: null,
      newValue: JSON.stringify({
        pitchdeckId: newPitchdeck.id,
        status: 'draft',
        deliverableCount: requiredDeliverables.length,
      }),
      reason: 'Automatische Pitchdeck-Erstellung nach BID-Entscheidung',
    });

    // Revalidate cache
    revalidatePath(`/pitches/${pitchId}`);
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
 * 1. Gets the pitchdeck and associated lead/Qualification data
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
    const [lead] = await db
      .select()
      .from(pitches)
      .where(eq(pitches.id, pitchdeck.pitchId))
      .limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Get Qualification for extracted requirements
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (!preQualification) {
      return {
        success: false,
        error: 'Qualification nicht gefunden',
      };
    }

    // Get PT-Estimation if available (determines required roles)
    const [ptEstimation] = await db
      .select()
      .from(ptEstimations)
      .where(eq(ptEstimations.pitchId, lead.id))
      .limit(1);

    // Get Qualification Scan results if available
    let qualificationScanResults = null;
    if (lead.qualificationScanId) {
      const { leadScans } = await import('@/lib/db/schema');
      const [qualificationScan] = await db
        .select()
        .from(leadScans)
        .where(eq(leadScans.id, lead.qualificationScanId))
        .limit(1);

      if (qualificationScan) {
        qualificationScanResults = {
          cms: qualificationScan.cms,
          framework: qualificationScan.framework,
          techStack: qualificationScan.techStack ? JSON.parse(qualificationScan.techStack) : [],
          integrations: qualificationScan.integrations
            ? JSON.parse(qualificationScan.integrations)
            : [],
          features: qualificationScan.features ? JSON.parse(qualificationScan.features) : [],
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
    const extractedRequirements = preQualification.extractedRequirements
      ? (JSON.parse(preQualification.extractedRequirements) as Record<string, unknown>)
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
      bidId: lead.preQualificationId, // Use Qualification ID for consistency
      extractedRequirements,
      qualificationScanResults,
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
      entityType: 'qualification',
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
    revalidatePath(`/pitches/${lead.id}/pitchdeck`);
    revalidatePath(`/pitches/${lead.id}`);

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

export interface ConfirmPitchdeckTeamResult {
  success: boolean;
  pitchdeckId?: string;
  error?: string;
}

/**
 * DEA-162 (PA-003): BL Confirms Team Suggestions
 *
 * This function:
 * 1. Validates BL role and business unit assignment
 * 2. Updates pitchdeck status to 'team_confirmed'
 * 3. Records teamConfirmedAt and teamConfirmedByUserId
 * 4. Creates audit trail
 *
 * @param pitchdeckId - The pitchdeck ID to confirm team for
 * @returns Pitchdeck ID if successful
 */
export async function confirmPitchdeckTeam(
  pitchdeckId: string
): Promise<ConfirmPitchdeckTeamResult> {
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
    const [lead] = await db
      .select()
      .from(pitches)
      .where(eq(pitches.id, pitchdeck.pitchId))
      .limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Get current user
    const { users } = await import('@/lib/db/schema');
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return {
        success: false,
        error: 'Benutzer nicht gefunden',
      };
    }

    // Authorization: User must be 'bl' role AND assigned to this business unit, OR admin
    if (currentUser.role !== 'bl' && currentUser.role !== 'admin') {
      return {
        success: false,
        error: 'Nur Business Line Leads können Teams bestätigen',
      };
    }

    // BL must be assigned to the same business unit as the lead
    if (currentUser.role === 'bl' && currentUser.businessUnitId !== lead.businessUnitId) {
      return {
        success: false,
        error: 'Sie können nur Teams für Leads in Ihrer Business Unit bestätigen',
      };
    }

    // Validate pitchdeck status
    if (pitchdeck.status !== 'team_proposed' && pitchdeck.status !== 'draft') {
      return {
        success: false,
        error: `Team kann nur bestätigt werden, wenn Pitchdeck im Status "team_proposed" oder "draft" ist. Aktueller Status: ${pitchdeck.status}`,
      };
    }

    // Update pitchdeck with team confirmation
    const [updatedPitchdeck] = await db
      .update(pitchdecks)
      .set({
        status: 'team_confirmed',
        teamConfirmedAt: new Date(),
        teamConfirmedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(pitchdecks.id, pitchdeckId))
      .returning();

    // Create audit trail
    await createAuditLog({
      action: 'update',
      entityType: 'pre_qualification',
      entityId: lead.preQualificationId,
      previousValue: JSON.stringify({
        pitchdeckStatus: pitchdeck.status,
        teamConfirmed: false,
      }),
      newValue: JSON.stringify({
        pitchdeckStatus: 'team_confirmed',
        teamConfirmedAt: updatedPitchdeck.teamConfirmedAt,
        teamConfirmedBy: session.user.id,
      }),
      reason: 'BL hat Pitchdeck-Team bestätigt',
    });

    // Revalidate cache
    revalidatePath(`/pitches/${lead.id}/pitchdeck`);
    revalidatePath(`/pitches/${lead.id}`);

    return {
      success: true,
      pitchdeckId: updatedPitchdeck.id,
    };
  } catch (error) {
    console.error('Error confirming pitchdeck team:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

export interface UpdateDeliverableStatusResult {
  success: boolean;
  deliverableId?: string;
  error?: string;
}

/**
 * DEA-167 (PA-008): Update Deliverable Status
 *
 * This function:
 * 1. Updates the status of a pitchdeck deliverable
 * 2. Records updatedAt timestamp for audit trail
 * 3. Creates audit log entry
 * 4. Accessible by all team members
 *
 * @param deliverableId - The deliverable ID to update
 * @param status - The new status ('open' | 'in_progress' | 'review' | 'done')
 * @returns Deliverable ID if successful
 */
export async function updateDeliverableStatus(
  deliverableId: string,
  status: 'open' | 'in_progress' | 'review' | 'done'
): Promise<UpdateDeliverableStatusResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get deliverable
    const [deliverable] = await db
      .select()
      .from(pitchdeckDeliverables)
      .where(eq(pitchdeckDeliverables.id, deliverableId))
      .limit(1);

    if (!deliverable) {
      return {
        success: false,
        error: 'Deliverable nicht gefunden',
      };
    }

    // Store previous status for audit trail
    const previousStatus = deliverable.status;

    // Update deliverable status
    const [updatedDeliverable] = await db
      .update(pitchdeckDeliverables)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(pitchdeckDeliverables.id, deliverableId))
      .returning();

    // Get pitchdeck for audit trail and revalidation
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, deliverable.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return {
        success: false,
        error: 'Pitchdeck nicht gefunden',
      };
    }

    // Get lead for audit trail
    const [lead] = await db
      .select()
      .from(pitches)
      .where(eq(pitches.id, pitchdeck.pitchId))
      .limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Create audit trail (who changed what and when)
    await createAuditLog({
      action: 'update',
      entityType: 'pre_qualification',
      entityId: lead.preQualificationId,
      previousValue: JSON.stringify({
        deliverableId,
        deliverableName: deliverable.deliverableName,
        status: previousStatus,
      }),
      newValue: JSON.stringify({
        deliverableId,
        deliverableName: deliverable.deliverableName,
        status,
        updatedBy: session.user.id,
      }),
      reason: `Deliverable Status-Änderung: ${previousStatus} → ${status}`,
    });

    // Revalidate cache
    revalidatePath(`/pitches/${lead.id}/pitchdeck`);
    revalidatePath(`/pitches/${lead.id}`);

    return {
      success: true,
      deliverableId: updatedDeliverable.id,
    };
  } catch (error) {
    console.error('Error updating deliverable status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

export interface GenerateSolutionSketchesResult {
  success: boolean;
  deliverableId?: string;
  error?: string;
}

/**
 * DEA-170 (PA-011), DEA-171 (PA-012), DEA-172 (PA-013), DEA-173 (PA-014):
 * Generate Solution Sketches for Deliverable
 *
 * This function:
 * 1. Generates all solution sketches (outline, draft, talking points, visual ideas)
 * 2. Stores them in the pitchdeck_deliverables table
 * 3. Sets generatedAt timestamp
 * 4. Creates audit trail
 * 5. Accessible by all team members
 *
 * @param deliverableId - The deliverable ID to generate sketches for
 * @returns Deliverable ID if successful
 */
export async function generateSolutionSketches(
  deliverableId: string
): Promise<GenerateSolutionSketchesResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  try {
    // Get deliverable
    const [deliverable] = await db
      .select()
      .from(pitchdeckDeliverables)
      .where(eq(pitchdeckDeliverables.id, deliverableId))
      .limit(1);

    if (!deliverable) {
      return {
        success: false,
        error: 'Deliverable nicht gefunden',
      };
    }

    // Get pitchdeck
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, deliverable.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return {
        success: false,
        error: 'Pitchdeck nicht gefunden',
      };
    }

    // Get lead
    const [lead] = await db
      .select()
      .from(pitches)
      .where(eq(pitches.id, pitchdeck.pitchId))
      .limit(1);

    if (!lead) {
      return {
        success: false,
        error: 'Lead nicht gefunden',
      };
    }

    // Get Qualification for context
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (!preQualification) {
      return {
        success: false,
        error: 'Qualification nicht gefunden',
      };
    }

    // Parse extracted requirements
    let customerName: string | undefined;
    let projectDescription: string | undefined;
    let requirements: string[] = [];

    if (preQualification.extractedRequirements) {
      try {
        const extractedReqs = JSON.parse(preQualification.extractedRequirements) as Record<
          string,
          unknown
        >;
        customerName = extractedReqs.customerName as string | undefined;
        projectDescription = extractedReqs.projectDescription as string | undefined;

        // Extract key requirements
        if (Array.isArray(extractedReqs.keyRequirements)) {
          requirements = extractedReqs.keyRequirements as string[];
        } else if (typeof extractedReqs.requirements === 'string') {
          requirements = [extractedReqs.requirements];
        }
      } catch (error) {
        console.error('Error parsing Qualification extractedRequirements:', error);
      }
    }

    // Prepare input for Solution Agent
    const solutionInput: SolutionInput = {
      deliverableName: deliverable.deliverableName,
      preQualificationId: preQualification.id,
      leadId: lead.id,
      customerName: customerName || lead.customerName,
      projectDescription: projectDescription || lead.projectDescription || undefined,
      requirements,
    };

    console.error(
      `[Generate Solution Sketches] Generating for deliverable: ${deliverable.deliverableName}`
    );

    // Generate all solution sketches
    const solution = await generateCompleteSolution(solutionInput);

    // Convert to JSON strings for storage
    const outlineJson = JSON.stringify(solution.outline);
    const draftText = solution.draft.draft; // Store as plain text/markdown
    const talkingPointsJson = JSON.stringify(solution.talkingPoints);
    const visualIdeasJson = JSON.stringify(solution.visualIdeas);

    // Update deliverable with generated sketches
    const [updatedDeliverable] = await db
      .update(pitchdeckDeliverables)
      .set({
        outline: outlineJson,
        draft: draftText,
        talkingPoints: talkingPointsJson,
        visualIdeas: visualIdeasJson,
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pitchdeckDeliverables.id, deliverableId))
      .returning();

    // Create audit trail
    await createAuditLog({
      action: 'update',
      entityType: 'pre_qualification',
      entityId: lead.preQualificationId,
      previousValue: JSON.stringify({
        deliverableId,
        deliverableName: deliverable.deliverableName,
        hadSketches: !!deliverable.outline,
      }),
      newValue: JSON.stringify({
        deliverableId,
        deliverableName: deliverable.deliverableName,
        generatedAt: updatedDeliverable.generatedAt,
        outlineSections: solution.outline.outline.length,
        draftWords: solution.draft.wordCount,
        talkingPointsTopics: solution.talkingPoints.talkingPoints.length,
        visualIdeas: solution.visualIdeas.visualIdeas.length,
      }),
      reason: 'Lösungs-Skizzen durch Solution Agent generiert',
    });

    // Revalidate cache
    revalidatePath(`/pitches/${lead.id}/pitchdeck`);
    revalidatePath(`/pitches/${lead.id}`);

    console.error(
      `[Generate Solution Sketches] Success for deliverable: ${deliverable.deliverableName}`,
      {
        outlineSections: solution.outline.outline.length,
        draftWords: solution.draft.wordCount,
      }
    );

    return {
      success: true,
      deliverableId: updatedDeliverable.id,
    };
  } catch (error) {
    console.error('Error generating solution sketches:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

export interface GenerateAllSolutionSketchesResult {
  success: boolean;
  results: {
    deliverableId: string;
    deliverableName: string;
    success: boolean;
    error?: string;
  }[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * DEA-185 (PA-030): Generate Solution Sketches for ALL Deliverables in Parallel
 *
 * This function:
 * 1. Fetches all deliverables for a pitchdeck
 * 2. Generates solution sketches in parallel (max 3 concurrent)
 * 3. Uses Promise.allSettled for error isolation
 * 4. Returns detailed results for each deliverable
 *
 * Performance optimization:
 * - Parallel execution speeds up multi-deliverable pitchdecks
 * - Rate limiting (max 3 concurrent) prevents API overload
 * - Error isolation ensures one failure doesn't block others
 *
 * @param pitchdeckId - The pitchdeck ID to generate sketches for all deliverables
 * @returns Detailed results for each deliverable
 */
export async function generateAllSolutionSketches(
  pitchdeckId: string
): Promise<GenerateAllSolutionSketchesResult> {
  // Security: Authentication check
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      results: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
    };
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
        results: [],
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    // Get all deliverables for this pitchdeck
    const deliverables = await db
      .select()
      .from(pitchdeckDeliverables)
      .where(eq(pitchdeckDeliverables.pitchdeckId, pitchdeckId));

    if (deliverables.length === 0) {
      return {
        success: true,
        results: [],
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    console.error(
      `[Generate All Solution Sketches] Processing ${deliverables.length} deliverables in parallel (max 3 concurrent)`
    );

    // Create rate limiter: max 3 concurrent executions
    const limit = pLimit(3);

    // Process all deliverables in parallel with rate limiting
    const results = await Promise.allSettled(
      deliverables.map(deliverable =>
        limit(async () => {
          try {
            console.error(
              `[Parallel Solution Generation] Starting: ${deliverable.deliverableName}`
            );

            const result = await generateSolutionSketches(deliverable.id);

            if (result.success) {
              console.error(
                `[Parallel Solution Generation] ✓ Success: ${deliverable.deliverableName}`
              );
            } else {
              console.error(
                `[Parallel Solution Generation] ✗ Failed: ${deliverable.deliverableName} - ${result.error}`
              );
            }

            return {
              deliverableId: deliverable.id,
              deliverableName: deliverable.deliverableName,
              success: result.success,
              error: result.error,
            };
          } catch (error) {
            console.error(
              `[Parallel Solution Generation] ✗ Exception: ${deliverable.deliverableName}`,
              error
            );
            return {
              deliverableId: deliverable.id,
              deliverableName: deliverable.deliverableName,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      )
    );

    // Extract results from Promise.allSettled
    const processedResults = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // This should rarely happen as we catch errors inside the limit() callback
        return {
          deliverableId: 'unknown',
          deliverableName: 'Unknown',
          success: false,
          error: String(result.reason),
        };
      }
    });

    // Calculate success/failure counts
    const successCount = processedResults.filter(r => r.success).length;
    const failureCount = processedResults.filter(r => !r.success).length;

    console.error(
      `[Generate All Solution Sketches] Completed: ${successCount} success, ${failureCount} failures out of ${deliverables.length}`
    );

    return {
      success: failureCount === 0, // Overall success only if all succeeded
      results: processedResults,
      totalProcessed: deliverables.length,
      successCount,
      failureCount,
    };
  } catch (error) {
    console.error('[Generate All Solution Sketches] Fatal error:', error);
    return {
      success: false,
      results: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
    };
  }
}
