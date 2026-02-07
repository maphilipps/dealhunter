import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  consumeStream,
  type UIMessage,
} from 'ai';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getModel } from '@/lib/ai/model-config';
import { auth } from '@/lib/auth';
import { addPitchJob } from '@/lib/bullmq/queues';
import { db } from '@/lib/db';
import { backgroundJobs, auditScanRuns, pitches, technologies, users } from '@/lib/db/schema';
import { INTERVIEW_SYSTEM_PROMPT } from '@/lib/pitch/constants';
import { interviewResultsSchema } from '@/lib/pitch/types';

// Next.js Route Segment Config for streaming
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/pitches/[id]/chat
 *
 * AI SDK streaming chat endpoint for the pitch interview phase.
 * Conducts a short interview to gather project context, then
 * kicks off the pitch pipeline via BullMQ.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const { id: pitchId } = await context.params;

    // Verify pitch exists
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Authorization: verify user has access to this pitch's business unit
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== lead.businessUnitId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only access leads in your Business Unit' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { messages } = body as { messages?: UIMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    // Resolve available CMS technologies for the user's business unit
    const availableCms = await db
      .select({ id: technologies.id, name: technologies.name })
      .from(technologies)
      .where(eq(technologies.businessUnitId, lead.businessUnitId));

    const cmsContext =
      availableCms.length > 0
        ? `\n\nVerfügbare CMS-Technologien: ${availableCms.map(c => c.name).join(', ')}`
        : '';

    const result = streamText({
      model: getModel('quality'),
      system: INTERVIEW_SYSTEM_PROMPT + cmsContext,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
      tools: {
        startPipeline: tool({
          description:
            'Starte die Pitch-Pipeline nachdem das Interview abgeschlossen ist. ' +
            'Fasse die Interview-Ergebnisse zusammen und starte die Analyse.',
          inputSchema: interviewResultsSchema,
          execute: async interviewResults => {
            try {
              const runId = createId();
              const jobId = createId();

              // Resolve target CMS IDs from available technologies
              const targetCmsIds = availableCms.map(c => c.id);

              // Create pitch run record
              await db.insert(auditScanRuns).values({
                id: runId,
                pitchId,
                userId,
                status: 'pending',
                targetCmsIds: JSON.stringify(targetCmsIds),
              });

              // Create background job record
              await db.insert(backgroundJobs).values({
                id: jobId,
                jobType: 'pitch',
                status: 'pending',
                userId,
                pitchId,
                progress: 0,
                currentStep: 'Interview abgeschlossen, Pipeline wird gestartet...',
              });

              // Enqueue BullMQ job
              await addPitchJob({
                runId,
                pitchId,
                websiteUrl: lead.websiteUrl ?? '',
                userId,
                targetCmsIds,
                interviewResults,
              });

              return { started: true, runId };
            } catch (error) {
              console.error('[startPipeline] Tool execution failed:', error);
              return {
                started: false,
                error: 'Pipeline konnte nicht gestartet werden. Bitte versuche es erneut.',
              };
            }
          },
        }),
      },
      stopWhen: stepCountIs(10),
    });

    return result.toUIMessageStreamResponse({
      onFinish: async ({ isAborted }) => {
        if (isAborted) {
          console.log('[POST /api/pitches/:id/chat] Stream aborted by client');
        }
      },
      onError: error => {
        console.error('[POST /api/pitches/:id/chat] Stream error:', error);
        return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
      },
      consumeSseStream: consumeStream,
    });
  } catch (error) {
    console.error('[POST /api/pitches/:id/chat] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
