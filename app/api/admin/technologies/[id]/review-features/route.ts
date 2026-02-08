import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  reviewFeatureResearch,
  deepReviewFeature,
  type FeatureData,
  type FeatureReview,
} from '@/lib/cms-matching/review-agent';
import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
import {
  createAgentEventStream,
  createSSEResponse,
} from '@/lib/streaming/in-process/event-emitter';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';

export const runtime = 'nodejs';

const reviewFeaturesRequestSchema = z.object({
  mode: z.enum(['quick', 'deep']).optional(),
  featureNames: z.array(z.string()).optional(),
});

/**
 * POST /api/admin/technologies/[id]/review-features
 *
 * - quick: Synchronous rule-based review → JSON response
 * - deep: AI + web search per feature → SSE stream with per-feature progress
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = reviewFeaturesRequestSchema.safeParse(body);

  const mode = parsed.success && parsed.data.mode ? parsed.data.mode : 'quick';
  const featureNames: string[] | undefined = parsed.success ? parsed.data.featureNames : undefined;

  // Load technology
  const techResult = await db.select().from(technologies).where(eq(technologies.id, id)).limit(1);
  const tech = techResult[0];

  if (!tech) {
    return NextResponse.json({ error: 'Technologie nicht gefunden' }, { status: 404 });
  }

  if (!tech.features) {
    return NextResponse.json({ error: 'Keine Features zum Reviewen vorhanden' }, { status: 400 });
  }

  const features = JSON.parse(tech.features) as Record<string, FeatureData>;

  // Filter features if specified
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

  // ──────────────────────────────────────────────────────────────────
  // Deep Review: SSE stream with per-feature progress
  // ──────────────────────────────────────────────────────────────────
  if (mode === 'deep') {
    const stream = createAgentEventStream(async emit => {
      const entries = Object.entries(featuresToReview);
      const total = entries.length;

      emit({
        type: AgentEventType.START,
        data: {
          agent: 'deep-review',
          message: `Deep Review: ${total} Features werden analysiert...`,
        },
      });

      const deepReviews: FeatureReview[] = [];
      let completed = 0;

      for (const [name, data] of entries) {
        emit({
          type: AgentEventType.AGENT_PROGRESS,
          data: {
            agent: 'deep-review',
            message: `Analysiere: ${name} (${completed + 1}/${total})`,
            metadata: { feature: name, completed, total },
          },
        });

        try {
          const result = await deepReviewFeature(tech.name, name, data);
          deepReviews.push(result);

          const improved = result.corrections.length > 0;
          emit({
            type: AgentEventType.AGENT_PROGRESS,
            data: {
              agent: 'deep-review',
              message: improved
                ? `${name}: Score ${result.originalScore}% → ${result.reviewedScore}% (${result.corrections.length} Korrekturen)`
                : `${name}: ${result.reviewedScore}% — keine Korrekturen`,
              metadata: {
                feature: name,
                completed: completed + 1,
                total,
                improved,
                score: result.reviewedScore,
                confidence: result.confidence,
              },
            },
          });
        } catch (error) {
          console.error(`[DeepReview] Feature "${name}" failed:`, error);
          emit({
            type: AgentEventType.AGENT_PROGRESS,
            data: {
              agent: 'deep-review',
              message: `${name}: Fehler — ${error instanceof Error ? error.message : 'Unbekannt'}`,
              metadata: { feature: name, completed: completed + 1, total, error: true },
            },
          });
        }

        completed++;
      }

      // Save corrected features to DB
      const updatedFeatures: Record<string, FeatureData> = { ...features };
      const reviewedAt = new Date().toISOString();

      for (const reviewed of deepReviews) {
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
              reviewedAt,
              reviewIssues: reviewed.issues,
              reviewCorrections: reviewed.corrections,
            };
          }
        }
      }

      await db
        .update(technologies)
        .set({
          features: JSON.stringify(updatedFeatures),
          lastResearchedAt: new Date(),
        })
        .where(eq(technologies.id, id));

      // Emit final result
      const featuresImproved = deepReviews.filter(r => r.corrections.length > 0).length;
      const featuresFlagged = deepReviews.filter(r => r.needsManualReview).length;
      const overallConfidence =
        deepReviews.length > 0
          ? Math.round(deepReviews.reduce((sum, r) => sum + r.confidence, 0) / deepReviews.length)
          : 0;

      emit({
        type: AgentEventType.AGENT_COMPLETE,
        data: {
          agent: 'deep-review',
          message: `Deep Review abgeschlossen: ${deepReviews.length} analysiert, ${featuresImproved} verbessert`,
          result: {
            featuresReviewed: deepReviews.length,
            featuresImproved,
            featuresFlagged,
            overallConfidence,
            updatedFeatures,
          },
        },
      });
    });

    return createSSEResponse(stream);
  }

  // ──────────────────────────────────────────────────────────────────
  // Quick Review: Synchronous → JSON response
  // ──────────────────────────────────────────────────────────────────
  try {
    let reviewResult = await reviewFeatureResearch({
      technologyName: tech.name ?? '',
      technologyId: id,
      features: featuresToReview,
    });
    (reviewResult as Record<string, unknown>).mode = 'quick';

    // Save corrected features to DB
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
