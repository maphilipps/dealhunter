import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { researchSingleRequirement } from '@/lib/cms-matching/agent';

/**
 * POST /api/admin/technologies/[id]/research-feature
 * Recherchiert ein oder mehrere Features via AI/Web-Search (parallel)
 *
 * Body: { featureNames: string[] } oder { featureName: string } (legacy)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    // Unterstütze beide Formate: featureNames (Array) oder featureName (String)
    let featureNames: string[] = [];
    if (body.featureNames && Array.isArray(body.featureNames)) {
      featureNames = body.featureNames.map((n: string) => n.trim()).filter(Boolean);
    } else if (body.featureName && typeof body.featureName === 'string') {
      featureNames = [body.featureName.trim()];
    }

    if (featureNames.length === 0) {
      return NextResponse.json(
        { error: 'featureNames oder featureName ist erforderlich' },
        { status: 400 }
      );
    }

    // Technologie laden
    const [tech] = await db
      .select()
      .from(technologies)
      .where(eq(technologies.id, id));

    if (!tech) {
      return NextResponse.json({ error: 'Technologie nicht gefunden' }, { status: 404 });
    }

    // Features parallel recherchieren
    const results = await Promise.all(
      featureNames.map(async (featureName) => {
        try {
          const result = await researchSingleRequirement(tech.name, featureName, id);
          return {
            name: featureName,
            success: true,
            ...result,
          };
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
      allFeatures: updatedTech?.features ? JSON.parse(updatedTech.features) : {},
    });
  } catch (error) {
    console.error('Feature research error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recherche fehlgeschlagen' },
      { status: 500 }
    );
  }
}
