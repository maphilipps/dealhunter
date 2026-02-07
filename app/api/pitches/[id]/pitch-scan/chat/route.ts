import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { aiHubOpenAI, modelNames } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { pitches, users, dealEmbeddings, pitchConversations, auditScanRuns } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const chatSchema = z.object({
  message: z.string().min(1),
  sectionId: z.string().optional(),
});

/**
 * POST /api/pitches/[id]/pitch-scan/chat
 *
 * Follow-up prompting on audit scan results.
 * Streams AI response based on completed sections as context.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId } = await context.params;

    // Verify pitch access
    const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
    if (!pitch) {
      return NextResponse.json({ error: 'Pitch nicht gefunden' }, { status: 404 });
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.businessUnitId !== pitch.businessUnitId)
    ) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Nachricht', details: parsed.error },
        { status: 400 }
      );
    }

    const { message, sectionId } = parsed.data;

    // Load all completed section results as context
    const sections = await db
      .select({
        agentName: dealEmbeddings.agentName,
        content: dealEmbeddings.content,
        confidence: dealEmbeddings.confidence,
      })
      .from(dealEmbeddings)
      .where(
        and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.chunkType, 'pitch_scan_section'))
      );

    // Build context from completed sections
    const sectionContext = sections
      .map(s => {
        const content = s.content.length > 3000 ? s.content.slice(0, 3000) + '...' : s.content;
        return `## ${s.agentName} (Confidence: ${s.confidence}%)\n${content}`;
      })
      .join('\n\n');

    // Get latest run for conversation tracking
    const [latestRun] = await db
      .select({ id: auditScanRuns.id })
      .from(auditScanRuns)
      .where(eq(auditScanRuns.pitchId, pitchId))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(1);

    const runId = latestRun?.id ?? '';

    // Store user message
    if (runId) {
      const existingMessages = await db
        .select({ sequenceNumber: pitchConversations.sequenceNumber })
        .from(pitchConversations)
        .where(eq(pitchConversations.runId, runId))
        .orderBy(desc(pitchConversations.sequenceNumber))
        .limit(1);

      const nextSeq = (existingMessages[0]?.sequenceNumber ?? 0) + 1;

      await db.insert(pitchConversations).values({
        runId,
        pitchId,
        role: 'user',
        content: message,
        messageType: 'question',
        sequenceNumber: nextSeq,
      });
    }

    // Stream AI response
    const result = streamText({
      model: aiHubOpenAI(modelNames.quality),
      system: `Du bist ein CMS-Migrations-Berater. Du hast Zugriff auf die Ergebnisse eines Website-Scans.
Beantworte Fragen basierend auf den Scan-Ergebnissen. Antworte auf Deutsch.
${sectionId ? `Der Nutzer bezieht sich speziell auf die Section: ${sectionId}` : ''}

SCAN-ERGEBNISSE:
${sectionContext}`,
      prompt: message,
    });

    // Store assistant response after streaming completes (fire-and-forget)
    void (async () => {
      try {
        const fullText = await result.text;
        if (runId) {
          const existingMessages = await db
            .select({ sequenceNumber: pitchConversations.sequenceNumber })
            .from(pitchConversations)
            .where(eq(pitchConversations.runId, runId))
            .orderBy(desc(pitchConversations.sequenceNumber))
            .limit(1);

          const nextSeq = (existingMessages[0]?.sequenceNumber ?? 0) + 1;

          await db.insert(pitchConversations).values({
            runId,
            pitchId,
            role: 'assistant',
            content: fullText,
            messageType: 'answer',
            sequenceNumber: nextSeq,
          });
        }
      } catch (err) {
        console.error('[Scan Chat] Failed to store assistant response:', err);
      }
    })();

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[POST /api/pitches/:id/pitch-scan/chat] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
