import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, pitchdecks, users, employees, rfps } from '@/lib/db/schema';
import { sendTeamNotificationEmails, TeamMemberNotification } from '@/lib/notifications/email';

// ============================================================================
// Zod Schema for Team Confirmation Request
// ============================================================================

const confirmTeamRequestSchema = z.object({
  // Optional: allow BL to modify team before confirmation
  teamMembers: z
    .array(
      z.object({
        employeeId: z.string(),
        role: z.enum(['pm', 'ux', 'frontend', 'backend', 'devops', 'qa']),
      })
    )
    .optional(),
});

const idSchema = z.object({
  id: z.string().min(1).max(50),
});

// ============================================================================
// POST /api/leads/[id]/pitchdeck/confirm-team
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
    const parsedBody = confirmTeamRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    // 4. Get Lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, parsedId.data.id)).limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 5. Get Pitchdeck
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.leadId, parsedId.data.id))
      .limit(1);

    if (!pitchdeck) {
      return NextResponse.json({ error: 'Pitchdeck not found for this lead' }, { status: 404 });
    }

    // 6. Authorization Check - Only BL or Admin can confirm team
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
        { error: 'Forbidden: Only Business Line Leads can confirm team' },
        { status: 403 }
      );
    }

    // BL must be assigned to the same business unit as the lead
    if (currentUser.role === 'bl' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only confirm teams for leads in your Business Unit' },
        { status: 403 }
      );
    }

    // 7. Validate pitchdeck status
    if (pitchdeck.status !== 'team_proposed' && pitchdeck.status !== 'draft') {
      return NextResponse.json(
        {
          error: 'Invalid pitchdeck status',
          message:
            'Team can only be confirmed when pitchdeck is in "team_proposed" or "draft" status',
          currentStatus: pitchdeck.status,
        },
        { status: 400 }
      );
    }

    // 8. Validate Team Completeness
    // Parse team data from pitchdeck (stored in a JSON field like teamSuggestion)
    // For now, we'll allow confirmation if teamMembers are provided in request body
    const teamMembersData = parsedBody.data.teamMembers;

    if (!teamMembersData || teamMembersData.length === 0) {
      return NextResponse.json(
        {
          error: 'Team is incomplete',
          message: 'At least one team member must be assigned before confirmation',
        },
        { status: 400 }
      );
    }

    // 9. Get RFP and Employee data for email notifications
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, lead.rfpId)).limit(1);

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Get employee details for all team members
    const teamMembersWithDetails = await Promise.all(
      teamMembersData.map(async member => {
        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, member.employeeId))
          .limit(1);

        if (!employee) {
          throw new Error(`Employee ${member.employeeId} not found`);
        }

        return {
          employeeId: employee.id,
          name: employee.name,
          email: employee.email,
          role: member.role,
        };
      })
    );

    // 10. Update Pitchdeck with Team Confirmation
    const [updatedPitchdeck] = await db
      .update(pitchdecks)
      .set({
        status: 'team_confirmed',
        teamConfirmedAt: new Date(),
        teamConfirmedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(pitchdecks.id, pitchdeck.id))
      .returning();

    // 11. Send Team Notification Emails in Background (Non-Blocking)
    after(async () => {
      try {
        // Extract customer info from RFP
        let customerName = 'Customer';
        let projectDescription = lead.projectDescription || 'Projekt-Details werden noch ergänzt';

        if (rfp.extractedRequirements) {
          try {
            const requirements = JSON.parse(rfp.extractedRequirements) as Record<string, unknown>;
            customerName = (requirements.customerName as string) || customerName;
            projectDescription = (requirements.projectDescription as string) || projectDescription;
          } catch (e) {
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

        // Prepare team notifications
        const teamNotifications: TeamMemberNotification[] = teamMembersWithDetails.map(member => ({
          employeeId: member.employeeId,
          employeeName: member.name,
          employeeEmail: member.email,
          role: member.role,
          roleLabel: roleLabels[member.role] || member.role,
        }));

        // Send emails with Pitchdeck-specific link
        const pitchdeckUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/leads/${lead.id}/pitchdeck`;

        await sendTeamNotificationEmails({
          bidId: rfp.id, // Keep for consistency, not used when projectUrl is provided
          projectName: `${customerName} - Pitchdeck`,
          customerName,
          projectDescription,
          teamMembers: teamNotifications,
          blLeaderName: currentUser.name,
          projectUrl: pitchdeckUrl, // Override URL to point to Pitchdeck tab
        });

        console.log(
          `✅ Team notification emails sent to ${teamNotifications.length} members for pitchdeck ${pitchdeck.id}`
        );
      } catch (error) {
        console.error('Failed to send team notification emails:', error);
        // Log error but don't fail request - email notification is not critical
      }
    });

    // 12. Create Audit Trail in Background (Non-Blocking)
    after(async () => {
      try {
        await createAuditLog({
          action: 'update',
          entityType: 'rfp',
          entityId: lead.rfpId,
          previousValue: JSON.stringify({
            pitchdeckStatus: pitchdeck.status,
            teamConfirmed: false,
          }),
          newValue: JSON.stringify({
            pitchdeckStatus: 'team_confirmed',
            teamConfirmedAt: updatedPitchdeck.teamConfirmedAt,
            teamConfirmedBy: session.user.id,
          }),
          reason: 'BL confirmed pitchdeck team',
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
        // Log error but don't fail request - audit log is not critical
      }
    });

    // 13. Return Updated Pitchdeck (Immediate Response)
    return NextResponse.json(
      {
        success: true,
        pitchdeck: updatedPitchdeck,
        message: 'Team confirmed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/leads/[id]/pitchdeck/confirm-team error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
