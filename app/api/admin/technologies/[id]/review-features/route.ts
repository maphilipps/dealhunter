import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  reviewFeatureResearch,
  deepReviewFeature,
  type FeatureData,
} from '@/lib/cms-matching/review-agent';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';

const reviewFeaturesRequestSchema = z.object({
  mode: z.enum(['quick', 'deep']).optional(),
  featureNames: z.array(z.string()).optional(),
});

/**
 * POST /api/admin/technologies/[id]/review-features
 * Führt einen Review der recherchierten Features durch
 *
 * Body: { mode?: 'quick' | 'deep', featureNames?: string[] }
 * - quick: Schneller regelbasierter Review (default)
 * - deep: AI-gestützter Deep Review (langsamer, gründlicher)
 * - featureNames: Optional - nur bestimmte Features reviewen
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = reviewFeaturesRequestSchema.safeParse(body);

    const mode = parsed.success && parsed.data.mode ? parsed.data.mode : 'quick';
    const featureNames: string[] | undefined = parsed.success
      ? parsed.data.featureNames
      : undefined;

    // Technologie laden
    const techResult = await db.select().from(technologies).where(eq(technologies.id, id)).limit(1);
    const tech = techResult[0];

    if (!tech) {
      return NextResponse.json({ error: 'Technologie nicht gefunden' }, { status: 404 });
    }

    if (!tech.features) {
      return NextResponse.json({ error: 'Keine Features zum Reviewen vorhanden' }, { status: 400 });
    }

    const features = JSON.parse(tech.features) as Record<string, FeatureData>;

    // Filter auf bestimmte Features wenn angegeben
    const featuresToReview: Record<string, FeatureData> = featureNames
      ? Object.fromEntries(
          Object.entries(features).filter(([name]) =>
            featureNames.some(fn => fn.toLowerCase() === name.toLowerCase())
          )
        )
      : features;

    if (Object.keys(featuresToReview).length === 0) {
      return NextResponse.json({ error: 'Keine passenden Features gefunden' }, { status: 400 });
    }

    let reviewResult;

    if (mode === 'deep') {
      // Deep Review: Jedes Feature einzeln mit AI reviewen
      const deepReviews = await Promise.all(
        Object.entries(featuresToReview).map(async ([name, data]) => {
          const featureData = data as {
            score: number;
            confidence: number;
            notes: string;
            supported?: boolean;
            researchedAt?: string;
            supportType?: string;
            moduleName?: string;
            sourceUrls?: string[];
            reasoning?: string;
          };
          return deepReviewFeature(tech.name, name, featureData);
        })
      );

      reviewResult = {
        technologyName: tech.name,
        reviewedAt: new Date().toISOString(),
        totalFeatures: Object.keys(features).length,
        featuresReviewed: deepReviews.length,
        featuresImproved: deepReviews.filter(r => r.corrections.length > 0).length,
        featuresFlagged: deepReviews.filter(r => r.needsManualReview).length,
        overallConfidence: Math.round(
          deepReviews.reduce((sum, r) => sum + r.confidence, 0) / deepReviews.length
        ),
        summary: `Deep Review: ${deepReviews.length} Features analysiert`,
        features: deepReviews,
        mode: 'deep',
      };
    } else {
      // Quick Review: Regelbasiert
      reviewResult = await reviewFeatureResearch({
        technologyName: tech.name ?? '',
        technologyId: id,
        features: featuresToReview,
      });
      reviewResult = { ...reviewResult, mode: 'quick' };
    }

    // Korrigierte Features in DB speichern
    const updatedFeatures: Record<string, FeatureData> = { ...features };
    for (const reviewed of reviewResult.features) {
      if (reviewed.corrections.length > 0) {
        const original = updatedFeatures[reviewed.featureName];
        if (original) {
          updatedFeatures[reviewed.featureName] = {
            ...original,
            score: reviewed.reviewedScore,
            supportType: reviewed.reviewedSupportType,
            moduleName: reviewed.reviewedModuleName,
            confidence: reviewed.confidence,
            reasoning: `[Reviewed] ${reviewed.reasoning}`,
            reviewedAt: reviewResult.reviewedAt,
            reviewIssues: reviewed.issues,
            reviewCorrections: reviewed.corrections,
          };
        }
      }
    }

    // In DB speichern
    await db
      .update(technologies)
      .set({
        features: JSON.stringify(updatedFeatures),
        lastResearchedAt: new Date(),
      })
      .where(eq(technologies.id, id));

    return NextResponse.json({
      success: true,
      review: reviewResult,
      updatedFeatures,
    });
  } catch (error) {
    console.error('Feature review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Review fehlgeschlagen' },
      { status: 500 }
    );
  }
}
