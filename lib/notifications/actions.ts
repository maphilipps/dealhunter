'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { bidOpportunities, businessUnits, employees } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendTeamNotificationEmails, type TeamMemberNotification, type TeamNotificationResult } from './email';
import type { ProjectPlan } from '@/lib/project-planning/schema';

export interface SendTeamNotificationsResult {
  success: boolean;
  error?: string;
  results?: TeamNotificationResult[];
}

const roleLabels: Record<string, string> = {
  project_manager: 'Projektleitung',
  technical_lead: 'Technical Lead',
  senior_developer: 'Senior Developer',
  developer: 'Developer',
  frontend_developer: 'Frontend Developer',
  backend_developer: 'Backend Developer',
  ux_designer: 'UX Designer',
  qa_engineer: 'QA Engineer',
  devops_engineer: 'DevOps Engineer',
  business_analyst: 'Business Analyst',
};

/**
 * Sendet Benachrichtigungen an alle Team-Mitglieder
 */
export async function sendTeamNotifications(bidId: string): Promise<SendTeamNotificationsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  // Get bid with all needed data
  const [bid] = await db
    .select()
    .from(bidOpportunities)
    .where(eq(bidOpportunities.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  if (bid.userId !== session.user.id) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  if (!bid.assignedTeam) {
    return { success: false, error: 'Kein Team zugewiesen' };
  }

  // Parse team data
  let teamData: { members: Array<{ employeeId: string; role: string }> };
  try {
    teamData = JSON.parse(bid.assignedTeam);
  } catch {
    return { success: false, error: 'Team-Daten ungültig' };
  }

  // Get employee details for each team member
  const teamMembers: TeamMemberNotification[] = [];

  for (const member of teamData.members) {
    if (member.employeeId === 'new_hire') {
      continue; // Skip placeholders
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, member.employeeId))
      .limit(1);

    if (employee) {
      teamMembers.push({
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        role: member.role,
        roleLabel: roleLabels[member.role] || member.role,
      });
    }
  }

  if (teamMembers.length === 0) {
    return { success: false, error: 'Keine Team-Mitglieder zum Benachrichtigen' };
  }

  // Get project info
  let projectName = 'Projekt';
  let customerName = 'Kunde';
  let projectDescription = '';

  if (bid.extractedRequirements) {
    try {
      const extracted = JSON.parse(bid.extractedRequirements);
      projectName = extracted.projectName || extracted.customerName || 'Projekt';
      customerName = extracted.customerName || 'Kunde';
      projectDescription = extracted.projectDescription || '';
    } catch {
      // Use defaults
    }
  }

  // Get BL leader name
  let blLeaderName = 'BL Lead';
  if (bid.assignedBusinessUnitId) {
    const [bl] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, bid.assignedBusinessUnitId))
      .limit(1);

    if (bl) {
      blLeaderName = bl.leaderName;
    }
  }

  // Get project plan summary if available
  let projectPlanSummary: { totalWeeks: number; totalHours: number; startPhase: string } | undefined;
  if (bid.projectPlanningResult) {
    try {
      const plan: ProjectPlan = JSON.parse(bid.projectPlanningResult);
      projectPlanSummary = {
        totalWeeks: plan.totalWeeks,
        totalHours: plan.totalHours,
        startPhase: plan.phases[0]?.name || 'Discovery',
      };
    } catch {
      // Continue without plan summary
    }
  }

  // Send notifications
  const { success, results } = await sendTeamNotificationEmails({
    bidId,
    projectName,
    customerName,
    projectDescription,
    teamMembers,
    projectPlanSummary,
    blLeaderName,
  });

  // Save notification results to bid
  await db
    .update(bidOpportunities)
    .set({
      teamNotifications: JSON.stringify(results),
      teamNotifiedAt: new Date(),
      status: success ? 'notified' : bid.status,
      updatedAt: new Date(),
    })
    .where(eq(bidOpportunities.id, bidId));

  return { success, results };
}

/**
 * Holt den Benachrichtigungs-Status für einen Bid
 */
export async function getNotificationStatus(bidId: string): Promise<{
  success: boolean;
  error?: string;
  results?: TeamNotificationResult[];
  notifiedAt?: Date;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const [bid] = await db
    .select({
      userId: bidOpportunities.userId,
      teamNotifications: bidOpportunities.teamNotifications,
      teamNotifiedAt: bidOpportunities.teamNotifiedAt,
    })
    .from(bidOpportunities)
    .where(eq(bidOpportunities.id, bidId))
    .limit(1);

  if (!bid) {
    return { success: false, error: 'Bid nicht gefunden' };
  }

  if (bid.userId !== session.user.id) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  if (!bid.teamNotifications) {
    return { success: false, error: 'Noch keine Benachrichtigungen versendet' };
  }

  try {
    const results = JSON.parse(bid.teamNotifications) as TeamNotificationResult[];
    return {
      success: true,
      results,
      notifiedAt: bid.teamNotifiedAt || undefined,
    };
  } catch {
    return { success: false, error: 'Benachrichtigungs-Daten ungültig' };
  }
}
