'use server';

import { db } from '@/lib/db';
import { bidOpportunities, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { suggestTeam } from './agent';
import { auth } from '@/lib/auth';
import type { TeamSuggestion, TeamAssignment } from './schema';

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

  try {
    // Get bid
    const [bid] = await db.select().from(bidOpportunities).where(eq(bidOpportunities.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    // Validate status - must be routed
    if (bid.status !== 'routed') {
      return { success: false, error: 'Bid muss in Status "routed" sein' };
    }

    // Validate BL assignment
    if (!bid.assignedBusinessLineId) {
      return { success: false, error: 'Keine Business Line zugewiesen' };
    }

    // Get employees from assigned BL
    // Note: In real system, this would query by businessLineId
    // For now, get all employees as we don't have BL-to-employee mapping yet
    const availableEmployees = await db.select().from(employees).limit(20);

    // Get Quick Scan results if available
    let quickScanResults = null;
    if (bid.quickScanId) {
      // In a real system, we'd fetch from quickScans table
      // For now, we'll pass null
    }

    // Generate team suggestion
    const suggestion = await suggestTeam({
      bidId: bid.id,
      extractedRequirements: bid.extractedRequirements
        ? JSON.parse(bid.extractedRequirements)
        : {},
      quickScanResults,
      assignedBusinessLine: bid.assignedBusinessLineId,
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

  try {
    // Get bid
    const [bid] = await db.select().from(bidOpportunities).where(eq(bidOpportunities.id, bidId)).limit(1);

    if (!bid) {
      return { success: false, error: 'Bid nicht gefunden' };
    }

    // Validate status
    if (bid.status !== 'routed') {
      return { success: false, error: 'Bid muss in Status "routed" sein' };
    }

    // Validate team has required roles
    const hasProjectManager = teamAssignment.members.some((m) => m.role === 'project_manager');
    const hasDevelopers = teamAssignment.members.filter((m) =>
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
      .update(bidOpportunities)
      .set({
        assignedTeam: JSON.stringify(teamAssignment),
        status: 'team_assigned',
        updatedAt: new Date(),
      })
      .where(eq(bidOpportunities.id, bidId));

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

  try {
    const [bid] = await db.select().from(bidOpportunities).where(eq(bidOpportunities.id, bidId)).limit(1);

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
      employees: employeesList.map((emp) => ({
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
