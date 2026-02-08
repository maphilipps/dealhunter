import { eq, and, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pitches, users, dealEmbeddings, auditScanRuns } from '@/lib/db/schema';
import { PITCH_SCAN_SECTION_LABELS, getSectionLabel } from '@/lib/pitch-scan/section-ids';
import type { PitchScanCheckpoint } from '@/lib/pitch-scan/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

function isSafeSectionId(sectionId: string): boolean {
  if (sectionId.length === 0 || sectionId.length > 80) return false;
  if (sectionId.includes('/') || sectionId.includes('\\')) return false;
  // Keep it conservative: ids are expected to be kebab-case.
  return /^[a-z0-9-]+$/.test(sectionId);
}

function safeParseCheckpoint(snapshotData: string | null): PitchScanCheckpoint | null {
  if (!snapshotData) return null;
  try {
    return JSON.parse(snapshotData) as PitchScanCheckpoint;
  } catch {
    return null;
  }
}

function isSectionAllowedByPlan(
  checkpoint: PitchScanCheckpoint | null,
  sectionId: string
): boolean {
  if (!checkpoint?.plan) return false;
  if (sectionId === 'ps-overview') return true;
  const enabled = new Set(checkpoint.plan.enabledPhases.map(p => p.id));
  if (enabled.has(sectionId)) return true;
  const custom = new Set((checkpoint.plan.customPhases ?? []).map(p => p.id));
  return custom.has(sectionId);
}

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

    if (!isSafeSectionId(sectionId)) {
      return NextResponse.json({ error: 'Ungueltige Section ID' }, { status: 400 });
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

    // Validate sectionId against plan when available. If no plan exists, only allow built-in sections.
    const [latestRun] = await db
      .select({ snapshotData: auditScanRuns.snapshotData })
      .from(auditScanRuns)
      .where(eq(auditScanRuns.pitchId, pitchId))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(1);

    const checkpoint = safeParseCheckpoint(latestRun?.snapshotData ?? null);
    const allowedByPlan = isSectionAllowedByPlan(checkpoint, sectionId);
    const allowedBuiltIn = sectionId in PITCH_SCAN_SECTION_LABELS;
    if (!allowedByPlan && !allowedBuiltIn) {
      return NextResponse.json({ error: 'Unbekannte Section ID' }, { status: 400 });
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

    const label =
      parsedMetadata &&
      typeof parsedMetadata === 'object' &&
      'label' in (parsedMetadata as Record<string, unknown>) &&
      typeof (parsedMetadata as Record<string, unknown>).label === 'string'
        ? ((parsedMetadata as Record<string, unknown>).label as string)
        : getSectionLabel(sectionId);

    return NextResponse.json({
      success: true,
      section: {
        sectionId,
        label,
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
      await import('@/lib/streaming/in-process/event-emitter');

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
