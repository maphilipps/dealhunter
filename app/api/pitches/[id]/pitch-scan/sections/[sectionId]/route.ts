import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, dealEmbeddings } from '@/lib/db/schema';
import {
  PITCH_SCAN_SECTION_LABELS,
  type PitchScanSectionId,
  getSectionLabel,
} from '@/lib/pitch-scan/section-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

/**
 * GET /api/pitches/[id]/pitch-scan/sections/[sectionId]
 *
 * Returns the json-render content for a specific audit scan section.
 */
export async function GET(_request: NextRequest, context: RouteParams): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId, sectionId } = await context.params;

    // Validate sectionId
    if (!(sectionId in PITCH_SCAN_SECTION_LABELS)) {
      return NextResponse.json({ error: 'Unbekannte Section ID' }, { status: 400 });
    }

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
    if (!currentUser) {
      return NextResponse.json({ error: 'User nicht gefunden' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.businessUnitId !== pitch.businessUnitId) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    // Fetch section data from deal_embeddings
    const results = await db
      .select({
        id: dealEmbeddings.id,
        content: dealEmbeddings.content,
        metadata: dealEmbeddings.metadata,
        confidence: dealEmbeddings.confidence,
        createdAt: dealEmbeddings.createdAt,
      })
      .from(dealEmbeddings)
      .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, sectionId)));

    if (results.length === 0) {
      return NextResponse.json({ error: 'Section-Daten nicht gefunden' }, { status: 404 });
    }

    const section = results[0];
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(section.content);
    } catch {
      parsedContent = section.content;
    }

    let parsedMetadata: unknown;
    try {
      parsedMetadata = section.metadata ? JSON.parse(section.metadata) : null;
    } catch {
      parsedMetadata = section.metadata;
    }

    return NextResponse.json({
      success: true,
      section: {
        sectionId,
        label: getSectionLabel(sectionId),
        content: parsedContent,
        metadata: parsedMetadata,
        confidence: section.confidence,
        createdAt: section.createdAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/pitches/:id/pitch-scan/sections/:sectionId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/pitches/[id]/pitch-scan/sections/[sectionId]
 *
 * Regenerates a single section by re-running its phase agent.
 */
export async function POST(_request: NextRequest, context: RouteParams): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pitchId, sectionId } = await context.params;

    // Validate sectionId
    if (!(sectionId in PITCH_SCAN_SECTION_LABELS)) {
      return NextResponse.json({ error: 'Unbekannte Section ID' }, { status: 400 });
    }

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

    // Load all existing section results as previous context
    const allSections = await db
      .select({ agentName: dealEmbeddings.agentName, content: dealEmbeddings.content })
      .from(dealEmbeddings)
      .where(
        and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.chunkType, 'pitch_scan_section'))
      );

    const previousResults: Record<string, unknown> = {};
    for (const s of allSections) {
      try {
        previousResults[s.agentName] = JSON.parse(s.content);
      } catch {
        previousResults[s.agentName] = s.content;
      }
    }

    // Dynamically import and run the specific phase agent
    const { PHASE_AGENT_REGISTRY } = await import('@/lib/pitch-scan/phases');
    const agentFn = PHASE_AGENT_REGISTRY[sectionId as keyof typeof PHASE_AGENT_REGISTRY];

    const { createAgentEventStream, createSSEResponse } =
      await import('@/lib/streaming/event-emitter');

    const stream = createAgentEventStream(async emit => {
      const result = await agentFn(
        {
          runId: '',
          pitchId,
          websiteUrl: pitch.websiteUrl ?? '',
          previousResults,
          targetCmsIds: [],
        },
        emit
      );

      // Store updated result
      await db
        .delete(dealEmbeddings)
        .where(and(eq(dealEmbeddings.pitchId, pitchId), eq(dealEmbeddings.agentName, sectionId)));

      const contentStr =
        typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

      await db.insert(dealEmbeddings).values({
        pitchId,
        preQualificationId: null,
        agentName: sectionId,
        chunkType: 'pitch_scan_section',
        chunkIndex: 0,
        chunkCategory: 'elaboration',
        content: contentStr,
        confidence: result.confidence,
        metadata: JSON.stringify({
          sectionId,
          sources: result.sources ?? [],
          visualizationTree: result.content,
          regeneratedAt: new Date().toISOString(),
        }),
      });
    });

    return createSSEResponse(stream);
  } catch (error) {
    console.error('[POST /api/pitches/:id/pitch-scan/sections/:sectionId] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
