'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { suggestTeam } from './agent';
import type { TeamSuggestion, TeamAssignment } from './schema';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preQualifications, employees, users } from '@/lib/db/schema';
import { canTransitionTo } from '@/lib/workflow/bl-review-status';

// Validation schemas
const BidIdSchema = z.object({
  bidId: z.string().min(1, 'Bid ID ist erforderlich'),
});

const AssignTeamInputSchema = z.object({
  bidId: z.string().min(1, 'Bid ID ist erforderlich'),
});

export interface SuggestTeamResult {
  success: boolean;
  suggestion?: TeamSuggestion;
  error?: string;
}

export interface AssignTeamResult {
  success: boolean;
  error?: string;
}

/**
 * TEAM-001: Generate AI team suggestion for a bid
 */
export async function suggestTeamForBid(bidId: string): Promise<SuggestTeamResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Validate input
  const parsed = BidIdSchema.safeParse({ bidId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Ungültige Eingabe' };
  }

  try {
    // Get bid
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, parsed.data.bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    // Security: BU ownership validation (IDOR prevention)
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (currentUser?.role === 'bl' && bid.assignedBusinessUnitId !== currentUser.businessUnitId) {
      return { success: false, error: 'Keine Berechtigung für diesen Bid' };
    }

    // Validate transition to team assignment is allowed
    const transitionSuggest = canTransitionTo(bid, 'team_assignment');
    if (!transitionSuggest.allowed) {
      return {
        success: false,
        error: transitionSuggest.reason || 'Übergang zum Team Assignment nicht erlaubt',
      };
    }

    // Validate BL assignment
    if (!bid.assignedBusinessUnitId) {
      return { success: false, error: 'Keine Business Unit zugewiesen' };
    }

    // Get employees from assigned BL
    // Note: In real system, this would query by businessUnitId
    // For now, get all employees as we don't have BL-to-employee mapping yet
    const availableEmployees = await db.select().from(employees).limit(20);

    // Get Qualification Scan results if available
    const qualificationScanResults = null;
    if (bid.qualificationScanId) {
      // In a real system, we'd fetch from leadScans table
      // For now, we'll pass null
    }

    // Generate team suggestion
    const suggestion = await suggestTeam({
      bidId: bid.id,
      extractedRequirements: bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : {},
      qualificationScanResults,
      assignedBusinessLine: bid.assignedBusinessUnitId,
      availableEmployees,
    });

    return {
      success: true,
      suggestion,
    };
  } catch (error) {
    console.error('Team suggestion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * TEAM-003: Assign final team to bid
 */
export async function assignTeam(
  bidId: string,
  teamAssignment: TeamAssignment
): Promise<AssignTeamResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Validate input
  const parsed = AssignTeamInputSchema.safeParse({ bidId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Ungültige Eingabe' };
  }

  try {
    // Get bid
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, parsed.data.bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    // Security: BU ownership validation (IDOR prevention)
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (currentUser?.role === 'bl' && bid.assignedBusinessUnitId !== currentUser.businessUnitId) {
      return { success: false, error: 'Keine Berechtigung für diesen Bid' };
    }

    // Validate transition to team assignment is allowed
    const transitionAssign = canTransitionTo(bid, 'team_assignment');
    if (!transitionAssign.allowed) {
      return {
        success: false,
        error: transitionAssign.reason || 'Übergang zum Team Assignment nicht erlaubt',
      };
    }

    // Validate team has required roles
    const hasProjectManager = teamAssignment.members.some(m => m.role === 'project_manager');
    const hasDevelopers =
      teamAssignment.members.filter(m =>
        [
          'developer',
          'senior_developer',
          'frontend_developer',
          'backend_developer',
          'technical_lead',
        ].includes(m.role)
      ).length >= 2;

    if (!hasProjectManager) {
      return { success: false, error: 'Team muss einen Project Manager enthalten' };
    }

    if (!hasDevelopers) {
      return { success: false, error: 'Team muss mindestens 2 Entwickler enthalten' };
    }

    // Update bid with team assignment
    await db
      .update(preQualifications)
      .set({
        assignedTeam: JSON.stringify(teamAssignment),
        status: 'team_assigned',
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, parsed.data.bidId));

    // Revalidate cache for updated views
    revalidatePath(`/bl-review/${parsed.data.bidId}`);
    revalidatePath('/bl-review');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Team assignment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * Get current team assignment for a bid
 */
export async function getTeamAssignment(bidId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Validate input
  const parsed = BidIdSchema.safeParse({ bidId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Ungültige Eingabe' };
  }

  try {
    const [bid] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, parsed.data.bidId))
      .limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    return {
      success: true,
      assignment: bid.assignedTeam ? JSON.parse(bid.assignedTeam) : null,
    };
  } catch (error) {
    console.error('Get team assignment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
    };
  }
}

/**
 * Get available employees for manual team selection
 */
export async function getAvailableEmployees() {
  try {
    const employeesList = await db.select().from(employees).limit(50);

    return {
      success: true,
      employees: employeesList.map(emp => ({
        ...emp,
        skills: JSON.parse(emp.skills),
        roles: JSON.parse(emp.roles),
      })),
    };
  } catch (error) {
    console.error('Get employees error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
      employees: [],
    };
  }
}
