import crypto from 'crypto';

import { and, eq, ne } from 'drizzle-orm';
import { NextResponse, after } from 'next/server';

import { createAuditLog } from '@/lib/admin/audit-actions';
import { db } from '@/lib/db';
import { qualifications, pitchdecks, preQualifications } from '@/lib/db/schema';

// ============================================================================
// GET /api/cron/check-pitchdeck-deadlines
// DEA-169 (PA-010): Auto-Submit Pitchdecks bei Pre-Qualification-Deadline
// ============================================================================

/**
 * Vercel Cron Job that automatically submits pitchdecks when Pre-Qualification deadline is reached.
 * Runs daily at 9:00 AM on weekdays (configured in vercel.json).
 *
 * Security: Uses timing-safe CRON_SECRET validation to prevent timing attacks.
 */
export async function GET(request: Request) {
  // 1. Validate CRON_SECRET with timing-safe comparison
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error('[Cron] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (
    tokenBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  console.error('[Cron] check-pitchdeck-deadlines started');

  try {
    const now = new Date();
    const results: {
      pitchdeckId: string;
      leadId: string;
      rfpDeadline: Date;
      previousStatus: string;
    }[] = [];

    // 2. Find all pitchdecks that are not yet submitted
    const activePitchdecks = await db
      .select({
        pitchdeck: pitchdecks,
        lead: qualifications,
        preQualification: preQualifications,
      })
      .from(pitchdecks)
      .innerJoin(qualifications, eq(pitchdecks.qualificationId, qualifications.id))
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
      .where(
        and(
          ne(pitchdecks.status, 'submitted'),
          ne(pitchdecks.status, 'draft') // Don't auto-submit drafts
        )
      );

    // 3. Check each pitchdeck's Pre-Qualification deadline
    for (const { pitchdeck, lead, preQualification } of activePitchdecks) {
      // Extract Pre-Qualification deadline from extractedRequirements
      let rfpDeadline: Date | null = null;

      if (preQualification.extractedRequirements) {
        try {
          const requirements = JSON.parse(preQualification.extractedRequirements) as {
            deadline?: string;
          };
          if (requirements.deadline) {
            rfpDeadline = new Date(requirements.deadline);
          }
        } catch {
          console.error(`[Cron] Failed to parse extractedRequirements for Pre-Qualification ${preQualification.id}`);
          continue;
        }
      }

      // Skip if no deadline or deadline not yet reached
      if (!rfpDeadline || rfpDeadline > now) {
        continue;
      }

      // 4. Auto-submit the pitchdeck
      const previousStatus = pitchdeck.status;

      await db
        .update(pitchdecks)
        .set({
          status: 'submitted',
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(pitchdecks.id, pitchdeck.id));

      results.push({
        pitchdeckId: pitchdeck.id,
        leadId: lead.id,
        rfpDeadline,
        previousStatus,
      });

      console.error(
        `[Cron] Auto-submitted pitchdeck ${pitchdeck.id} for lead ${lead.id} (deadline: ${rfpDeadline.toISOString()})`
      );
    }

    // 5. Create Audit Trail in Background (Non-Blocking)
    if (results.length > 0) {
      after(async () => {
        for (const result of results) {
          try {
            await createAuditLog({
              action: 'update',
              entityType: 'pitchdeck',
              entityId: result.pitchdeckId,
              previousValue: JSON.stringify({
                status: result.previousStatus,
              }),
              newValue: JSON.stringify({
                status: 'submitted',
                autoSubmittedAt: now.toISOString(),
                reason: 'Pre-Qualification deadline reached',
                rfpDeadline: result.rfpDeadline.toISOString(),
              }),
              reason: 'Auto-Submit: Pre-Qualification-Deadline erreicht',
            });
          } catch (error) {
            console.error(
              `[Cron] Failed to create audit log for pitchdeck ${result.pitchdeckId}:`,
              error
            );
          }
        }
      });
    }

    // 6. Return summary
    return NextResponse.json({
      success: true,
      processed: results.length,
      timestamp: now.toISOString(),
      details: results.map(r => ({
        pitchdeckId: r.pitchdeckId,
        leadId: r.leadId,
        rfpDeadline: r.rfpDeadline.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Cron] check-pitchdeck-deadlines error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
