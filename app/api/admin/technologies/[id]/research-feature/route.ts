import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { researchSingleRequirement } from '@/lib/cms-matching/agent';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';

const researchFeatureRequestSchema = z.object({
  featureNames: z.array(z.string()).optional(),
  featureName: z.string().optional(),
});

/**
 * POST /api/admin/technologies/[id]/research-feature
 * Recherchiert ein oder mehrere Features via AI/Web-Search (parallel)
 *
 * Body: { featureNames: string[] } oder { featureName: string } (legacy)
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body: unknown = await request.json();
    const parsed = researchFeatureRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Unterstütze beide Formate: featureNames (Array) oder featureName (String)
    let featureNames: string[] = [];
    if (parsed.data.featureNames && parsed.data.featureNames.length > 0) {
      featureNames = parsed.data.featureNames.map(n => n.trim()).filter(Boolean);
    } else if (parsed.data.featureName) {
      featureNames = [parsed.data.featureName.trim()];
    }

    if (featureNames.length === 0) {
      return NextResponse.json(
        { error: 'featureNames oder featureName ist erforderlich' },
        { status: 400 }
      );
    }

    // Technologie laden
    const techResult = await db.select().from(technologies).where(eq(technologies.id, id)).limit(1);
    const tech = techResult[0];

    if (!tech) {
      return NextResponse.json({ error: 'Technologie nicht gefunden' }, { status: 404 });
    }

    // Features parallel recherchieren
    const results = await Promise.all(
      featureNames.map(async featureName => {
        try {
          const result = await researchSingleRequirement(tech.name ?? '', featureName, id);
          const resultData: Record<string, unknown> = {
            name: featureName,
            success: true,
          };
          for (const [key, value] of Object.entries(result)) {
            resultData[key] = value;
          }
          return resultData;
        } catch (error) {
          return {
            name: featureName,
            success: false,
            error: error instanceof Error ? error.message : 'Recherche fehlgeschlagen',
          };
        }
      })
    );

    // Aktualisierte Features laden
    const [updatedTech] = await db
      .select({ features: technologies.features })
      .from(technologies)
      .where(eq(technologies.id, id));

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: featureNames.length,
        successful: successCount,
        failed: failedCount,
      },
      allFeatures: updatedTech?.features
        ? (JSON.parse(updatedTech.features) as Record<string, unknown>)
        : {},
    });
  } catch (error) {
    console.error('Feature research error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recherche fehlgeschlagen' },
      { status: 500 }
    );
  }
}
