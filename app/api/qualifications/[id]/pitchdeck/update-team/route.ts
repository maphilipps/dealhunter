import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  qualifications,
  pitchdecks,
  pitchdeckTeamMembers,
  users,
  employees,
  preQualifications,
} from '@/lib/db/schema';
import { sendTeamNotificationEmails, TeamMemberNotification } from '@/lib/notifications/email';

// ============================================================================
// Zod Schema for Team Update Request
// ============================================================================

const updateTeamRequestSchema = z.object({
  teamMembers: z.array(
    z.object({
      employeeId: z.string(),
      role: z.enum(['pm', 'ux', 'frontend', 'backend', 'devops', 'qa']),
    })
  ),
});

const idSchema = z.object({
  id: z.string().min(1).max(50),
});

// ============================================================================
// POST /api/qualifications/[id]/pitchdeck/update-team
// ============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 1. Authentication Check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Validate Lead ID
    const { id } = await params;
    const parsedId = idSchema.safeParse({ id });

    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid lead ID', details: parsedId.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Parse Request Body
    const body = (await request.json()) as unknown;
    const parsedBody = updateTeamRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    // 4. Get Lead
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, parsedId.data.id))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 5. Get Pitchdeck
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.qualificationId, parsedId.data.id))
      .limit(1);

    if (!pitchdeck) {
      return NextResponse.json({ error: 'Pitchdeck not found for this lead' }, { status: 404 });
    }

    // 6. Authorization Check - Only BL or Admin can update team
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Authorization: User must be 'bl' role AND assigned to this business unit, OR admin
    if (currentUser.role !== 'bl' && currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only Business Line Leads can update team' },
        { status: 403 }
      );
    }

    // BL must be assigned to the same business unit as the lead
    if (currentUser.role === 'bl' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update teams for leads in your Business Unit' },
        { status: 403 }
      );
    }

    // 7. Validate pitchdeck status - team must be confirmed before updates
    if (pitchdeck.status !== 'team_confirmed' && pitchdeck.status !== 'in_progress') {
      return NextResponse.json(
        {
          error: 'Invalid pitchdeck status',
          message:
            'Team can only be updated after confirmation (status: team_confirmed or in_progress)',
          currentStatus: pitchdeck.status,
        },
        { status: 400 }
      );
    }

    // 8. Get current team members
    const currentTeamMembers = await db
      .select()
      .from(pitchdeckTeamMembers)
      .where(eq(pitchdeckTeamMembers.pitchdeckId, pitchdeck.id));

    // 9. Calculate team changes
    const currentEmployeeIds = new Set(currentTeamMembers.map(m => m.employeeId));
    const newEmployeeIds = new Set(parsedBody.data.teamMembers.map(m => m.employeeId));

    const addedEmployeeIds = [...newEmployeeIds].filter(id => !currentEmployeeIds.has(id));
    const removedEmployeeIds = [...currentEmployeeIds].filter(id => !newEmployeeIds.has(id));

    // 10. Get RFP and Employee data for email notifications
    const [rfp] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, lead.preQualificationId))
      .limit(1);

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Get employee details for new team members (for emails)
    const addedTeamMembersWithDetails = await Promise.all(
      addedEmployeeIds.map(async employeeId => {
        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1);

        if (!employee) {
          throw new Error(`Employee ${employeeId} not found`);
        }

        const memberData = parsedBody.data.teamMembers.find(m => m.employeeId === employeeId);
        if (!memberData) {
          throw new Error(`Role not found for employee ${employeeId}`);
        }

        return {
          employeeId: employee.id,
          name: employee.name,
          email: employee.email,
          role: memberData.role,
        };
      })
    );

    // Get removed employee details (for optional notifications)
    void Promise.all(
      removedEmployeeIds.map(async employeeId => {
        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1);

        if (!employee) {
          return null; // Employee might have been deleted
        }

        return {
          employeeId: employee.id,
          name: employee.name,
          email: employee.email,
        };
      })
    );

    // 11. Update Team Members in Database
    // Remove old team members
    if (removedEmployeeIds.length > 0) {
      await db.delete(pitchdeckTeamMembers).where(
        and(
          eq(pitchdeckTeamMembers.pitchdeckId, pitchdeck.id),
          // @ts-expect-error - Drizzle inArray type issue with string arrays
          eq(
            pitchdeckTeamMembers.employeeId,
            removedEmployeeIds.length === 1 ? removedEmployeeIds[0] : undefined
          )
        )
      );

      // Workaround: delete one by one if multiple
      if (removedEmployeeIds.length > 1) {
        for (const employeeId of removedEmployeeIds) {
          await db
            .delete(pitchdeckTeamMembers)
            .where(
              and(
                eq(pitchdeckTeamMembers.pitchdeckId, pitchdeck.id),
                eq(pitchdeckTeamMembers.employeeId, employeeId)
              )
            );
        }
      }
    }

    // Add new team members
    if (addedEmployeeIds.length > 0) {
      const teamMembersToInsert = parsedBody.data.teamMembers
        .filter(m => addedEmployeeIds.includes(m.employeeId))
        .map(member => ({
          pitchdeckId: pitchdeck.id,
          employeeId: member.employeeId,
          role: member.role,
        }));

      await db.insert(pitchdeckTeamMembers).values(teamMembersToInsert);
    }

    // Update roles for existing members (if role changed)
    const unchangedEmployeeIds = [...currentEmployeeIds].filter(id => newEmployeeIds.has(id));
    for (const employeeId of unchangedEmployeeIds) {
      const currentMember = currentTeamMembers.find(m => m.employeeId === employeeId);
      const newMember = parsedBody.data.teamMembers.find(m => m.employeeId === employeeId);

      if (currentMember && newMember && currentMember.role !== newMember.role) {
        await db
          .update(pitchdeckTeamMembers)
          .set({ role: newMember.role })
          .where(
            and(
              eq(pitchdeckTeamMembers.pitchdeckId, pitchdeck.id),
              eq(pitchdeckTeamMembers.employeeId, employeeId)
            )
          );
      }
    }

    // 12. Update Pitchdeck timestamp
    await db
      .update(pitchdecks)
      .set({ updatedAt: new Date() })
      .where(eq(pitchdecks.id, pitchdeck.id));

    // 13. Send Team Notification Emails to NEW members in Background (Non-Blocking)
    if (addedTeamMembersWithDetails.length > 0) {
      after(async () => {
        try {
          // Extract customer info from RFP
          let customerName = 'Customer';
          let projectDescription = lead.projectDescription || 'Projekt-Details werden noch ergänzt';

          if (rfp.extractedRequirements) {
            try {
              const requirements = JSON.parse(rfp.extractedRequirements) as Record<string, unknown>;
              customerName = (requirements.customerName as string) || customerName;
              projectDescription =
                (requirements.projectDescription as string) || projectDescription;
            } catch {
              console.error('Could not parse RFP extractedRequirements');
            }
          }

          // Map role enums to readable labels
          const roleLabels: Record<string, string> = {
            pm: 'Project Manager',
            ux: 'UX Designer',
            frontend: 'Frontend Developer',
            backend: 'Backend Developer',
            devops: 'DevOps Engineer',
            qa: 'QA Engineer',
          };

          // Prepare team notifications for new members
          const teamNotifications: TeamMemberNotification[] = addedTeamMembersWithDetails.map(
            member => ({
              employeeId: member.employeeId,
              employeeName: member.name,
              employeeEmail: member.email,
              role: member.role,
              roleLabel: roleLabels[member.role] || member.role,
            })
          );

          // Send emails with Pitchdeck-specific link
          const pitchdeckUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/qualifications/${lead.id}/pitchdeck`;

          await sendTeamNotificationEmails({
            bidId: rfp.id,
            projectName: `${customerName} - Pitchdeck`,
            customerName,
            projectDescription,
            teamMembers: teamNotifications,
            blLeaderName: currentUser.name,
            projectUrl: pitchdeckUrl,
          });

          console.error(
            `✅ Team notification emails sent to ${teamNotifications.length} new members for pitchdeck ${pitchdeck.id}`
          );
        } catch (error) {
          console.error('Failed to send team notification emails:', error);
          // Log error but don't fail request - email notification is not critical
        }
      });
    }

    // 14. Create Audit Trail in Background (Non-Blocking)
    after(async () => {
      try {
        await createAuditLog({
          action: 'team_change',
          entityType: 'pre_qualification',
          entityId: lead.preQualificationId,
          previousValue: JSON.stringify({
            teamMembers: currentTeamMembers.map(m => ({
              employeeId: m.employeeId,
              role: m.role,
            })),
          }),
          newValue: JSON.stringify({
            teamMembers: parsedBody.data.teamMembers,
            addedMembers: addedEmployeeIds,
            removedMembers: removedEmployeeIds,
          }),
          reason: `Team updated by ${currentUser.name}`,
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
        // Log error but don't fail request - audit log is not critical
      }
    });

    // 15. Return Updated Team (Immediate Response)
    const updatedTeamMembers = await db
      .select()
      .from(pitchdeckTeamMembers)
      .where(eq(pitchdeckTeamMembers.pitchdeckId, pitchdeck.id));

    return NextResponse.json(
      {
        success: true,
        teamMembers: updatedTeamMembers,
        changes: {
          added: addedEmployeeIds.length,
          removed: removedEmployeeIds.length,
          modified: unchangedEmployeeIds.filter(id => {
            const currentMember = currentTeamMembers.find(m => m.employeeId === id);
            const newMember = parsedBody.data.teamMembers.find(m => m.employeeId === id);
            return currentMember && newMember && currentMember.role !== newMember.role;
          }).length,
        },
        message: 'Team updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/qualifications/[id]/pitchdeck/update-team error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
