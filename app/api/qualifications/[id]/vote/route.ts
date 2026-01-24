import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { qualifications, businessUnits, users } from '@/lib/db/schema';

// ============================================================================
// Zod Schema for Vote Request
// ============================================================================

const voteRequestSchema = z.object({
  vote: z.enum(['BID', 'NO-BID']),
  confidence: z
    .number()
    .int()
    .min(0, 'Confidence must be at least 0')
    .max(100, 'Confidence must be at most 100'),
  reasoning: z.string().min(10, 'Reasoning must be at least 10 characters'),
});

const idSchema = z.object({
  id: z.string().min(1).max(50),
});

// ============================================================================
// POST /api/qualifications/[id]/vote
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
    const parsedBody = voteRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const { vote, confidence, reasoning } = parsedBody.data;

    // 4. Get Lead
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, parsedId.data.id))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 5. Authorization Check - Only assigned BL can vote
    // Get the Business Unit to check if user is the BL Leader
    const [businessUnit] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, lead.businessUnitId))
      .limit(1);

    if (!businessUnit) {
      return NextResponse.json({ error: 'Business Unit not found' }, { status: 404 });
    }

    // Check if current user is BL for this business unit
    // BL users have businessUnitId set to their assigned BU
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Authorization: User must be 'bl' role AND assigned to this business unit
    if (currentUser.role !== 'bl' && currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only Business Line Leads can vote on leads' },
        { status: 403 }
      );
    }

    // BL must be assigned to the same business unit as the lead
    if (currentUser.role === 'bl' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only vote on leads assigned to your Business Unit' },
        { status: 403 }
      );
    }

    // 6. Check if vote already exists (prevent double voting)
    if (lead.blVote) {
      return NextResponse.json(
        {
          error: 'Vote already exists',
          message: 'This lead has already been voted on',
          existingVote: {
            vote: lead.blVote,
            votedAt: lead.blVotedAt,
            votedBy: lead.blVotedByUserId,
          },
        },
        { status: 409 }
      );
    }

    // 7. Update Lead with Vote
    const [updatedLead] = await db
      .update(qualifications)
      .set({
        blVote: vote,
        blVotedAt: new Date(),
        blVotedByUserId: session.user.id,
        blReasoning: reasoning,
        blConfidenceScore: confidence,
        updatedAt: new Date(),
      })
      .where(eq(qualifications.id, parsedId.data.id))
      .returning();

    // 8. Create Audit Trail in Background (Non-Blocking)
    after(async () => {
      try {
        await createAuditLog({
          action: 'update',
          entityType: 'pre_qualification',
          entityId: lead.preQualificationId,
          previousValue: JSON.stringify({
            blVote: null,
            status: lead.status,
          }),
          newValue: JSON.stringify({
            blVote: vote,
            blVotedAt: updatedLead.blVotedAt,
            blVotedBy: session.user.id,
            blReasoning: reasoning,
            blConfidenceScore: confidence,
          }),
          reason: `BL Vote: ${vote} (Confidence: ${confidence}%)`,
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
        // Log error but don't fail request - audit log is not critical
      }
    });

    // 9. Return Updated Lead (Immediate Response)
    return NextResponse.json(
      {
        success: true,
        lead: updatedLead,
        message: `Vote "${vote}" recorded successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/qualifications/[id]/vote error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
