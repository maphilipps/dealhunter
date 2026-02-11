import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { SECTION_BY_ID } from '@/lib/dashboard/sections';
import { db } from '@/lib/db';
import { dealEmbeddings, preQualifications } from '@/lib/db/schema';
import { runPreQualSectionAgent } from '@/lib/json-render/prequal-section-agent';
import { getPreQualSectionQueryTemplate } from '@/lib/qualifications/section-queries';
import { deletePreQualSectionArtifacts } from '@/lib/qualifications/sections/section-utils';

export const maxDuration = 300;

interface JsonRenderTree {
  root: string | null;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
}

const BodySchema = z.object({
  allowWebEnrichment: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: qualificationId, sectionId } = await context.params;

  // Ownership verification
  const [qualification] = await db
    .select({ id: preQualifications.id })
    .from(preQualifications)
    .where(
      and(eq(preQualifications.id, qualificationId), eq(preQualifications.userId, session.user.id))
    );
  if (!qualification) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Validate sectionId
  const template = getPreQualSectionQueryTemplate(sectionId);
  if (!template || !SECTION_BY_ID.has(sectionId)) {
    return NextResponse.json({ error: 'Unknown section' }, { status: 404 });
  }

  let allowWebEnrichment: boolean | undefined;
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    allowWebEnrichment = parsed.success ? parsed.data.allowWebEnrichment : undefined;
  } catch {
    allowWebEnrichment = undefined;
  }

  if (allowWebEnrichment == null) {
    allowWebEnrichment = sectionId === 'budget' || sectionId === 'references';
  }

  try {
    // Make reruns idempotent and avoid stale outputs.
    await deletePreQualSectionArtifacts({ preQualificationId: qualificationId, sectionId });

    const result = await runPreQualSectionAgent({
      preQualificationId: qualificationId,
      sectionId,
      allowWebEnrichment,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const viz = await db.query.dealEmbeddings.findFirst({
      where: and(
        eq(dealEmbeddings.preQualificationId, qualificationId),
        eq(dealEmbeddings.chunkType, 'visualization'),
        sql`(metadata::jsonb)->>'sectionId' = ${sectionId}`
      ),
    });

    let visualizationTree: JsonRenderTree | null = null;
    if (viz?.content) {
      try {
        visualizationTree = JSON.parse(viz.content) as JsonRenderTree;
      } catch {
        visualizationTree = null;
      }
    }

    return NextResponse.json({
      success: true,
      visualizationTree,
      confidence: viz?.confidence ?? null,
    });
  } catch (error) {
    console.error('[PreQual Section Rerun API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
