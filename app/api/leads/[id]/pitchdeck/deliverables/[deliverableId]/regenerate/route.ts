import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { generateCompleteSolution, type SolutionInput } from '@/lib/agents/solution-agent';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, pitchdeckDeliverables, pitchdecks, rfps } from '@/lib/db/schema';

// ============================================================================
// POST /api/leads/[id]/pitchdeck/deliverables/[deliverableId]/regenerate
// DEA-159 (PA-024): Regenerate solution sketches for a single deliverable
// ============================================================================

interface RouteParams {
  params: Promise<{
    id: string;
    deliverableId: string;
  }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  // 1. Authentication Check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Get and validate params
    const { id: leadId, deliverableId } = await params;

    if (!leadId || !deliverableId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 3. Get deliverable
    const [deliverable] = await db
      .select()
      .from(pitchdeckDeliverables)
      .where(eq(pitchdeckDeliverables.id, deliverableId))
      .limit(1);

    if (!deliverable) {
      return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });
    }

    // 4. Get pitchdeck and verify it belongs to this lead
    const [pitchdeck] = await db
      .select()
      .from(pitchdecks)
      .where(eq(pitchdecks.id, deliverable.pitchdeckId))
      .limit(1);

    if (!pitchdeck) {
      return NextResponse.json({ error: 'Pitchdeck not found' }, { status: 404 });
    }

    if (pitchdeck.leadId !== leadId) {
      return NextResponse.json(
        { error: 'Deliverable does not belong to this lead' },
        { status: 400 }
      );
    }

    // 5. Get lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 6. Get RFP for context
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, lead.rfpId)).limit(1);

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // 7. Parse extracted requirements for context
    let customerName: string | undefined;
    let projectDescription: string | undefined;
    let requirements: string[] = [];

    if (rfp.extractedRequirements) {
      try {
        const extractedReqs = JSON.parse(rfp.extractedRequirements) as Record<string, unknown>;
        customerName = extractedReqs.customerName as string | undefined;
        projectDescription = extractedReqs.projectDescription as string | undefined;

        if (Array.isArray(extractedReqs.keyRequirements)) {
          requirements = extractedReqs.keyRequirements as string[];
        } else if (typeof extractedReqs.requirements === 'string') {
          requirements = [extractedReqs.requirements];
        }
      } catch {
        console.error('Error parsing RFP extractedRequirements');
      }
    }

    // 8. Prepare input for Solution Agent
    const solutionInput: SolutionInput = {
      deliverableName: deliverable.deliverableName,
      rfpId: rfp.id,
      leadId: lead.id,
      customerName: customerName || lead.customerName,
      projectDescription: projectDescription || lead.projectDescription || undefined,
      requirements,
    };

    console.error(
      `[Regenerate API] Starting regeneration for deliverable: ${deliverable.deliverableName}`
    );

    // 9. Generate complete solution (outline, draft, talkingPoints, visualIdeas)
    const solution = await generateCompleteSolution(solutionInput);

    // 10. Convert to JSON strings for storage
    const outlineJson = JSON.stringify(solution.outline);
    const draftText = solution.draft.draft;
    const talkingPointsJson = JSON.stringify(solution.talkingPoints);
    const visualIdeasJson = JSON.stringify(solution.visualIdeas);

    // 11. Update deliverable with regenerated sketches
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

    // 12. Create Audit Trail in Background (Non-Blocking)
    after(async () => {
      try {
        await createAuditLog({
          action: 'update',
          entityType: 'rfp',
          entityId: lead.rfpId,
          previousValue: JSON.stringify({
            deliverableId,
            deliverableName: deliverable.deliverableName,
            previousGeneratedAt: deliverable.generatedAt,
          }),
          newValue: JSON.stringify({
            deliverableId,
            deliverableName: deliverable.deliverableName,
            regeneratedAt: updatedDeliverable.generatedAt,
            regeneratedBy: session.user.id,
            outlineSections: solution.outline.outline.length,
            draftWords: solution.draft.wordCount,
            talkingPointsTopics: solution.talkingPoints.talkingPoints.length,
            visualIdeas: solution.visualIdeas.visualIdeas.length,
          }),
          reason: 'Lösungs-Skizzen regeneriert via API',
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }
    });

    console.error(`[Regenerate API] Success for deliverable: ${deliverable.deliverableName}`, {
      outlineSections: solution.outline.outline.length,
      draftWords: solution.draft.wordCount,
    });

    // 13. Return updated deliverable
    return NextResponse.json(
      {
        success: true,
        deliverable: {
          id: updatedDeliverable.id,
          deliverableName: updatedDeliverable.deliverableName,
          generatedAt: updatedDeliverable.generatedAt,
          outline: solution.outline,
          draft: solution.draft,
          talkingPoints: solution.talkingPoints,
          visualIdeas: solution.visualIdeas,
        },
        message: 'Solution sketches regenerated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/leads/[id]/pitchdeck/deliverables/[deliverableId]/regenerate error:',
      error
    );
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
