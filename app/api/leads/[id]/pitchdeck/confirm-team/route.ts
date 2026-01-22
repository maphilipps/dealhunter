import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, pitchdecks, users } from '@/lib/db/schema';

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
      return NextResponse.json(
        { error: 'Pitchdeck not found for this lead' },
        { status: 404 }
      );
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

    // 8. Update Pitchdeck with Team Confirmation
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

    // 9. Create Audit Trail in Background (Non-Blocking)
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

    // 10. Return Updated Pitchdeck (Immediate Response)
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
