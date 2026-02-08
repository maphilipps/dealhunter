import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import {
  deepReviewFeature,
  reviewFeatureResearch,
  type FeatureData,
} from '../../cms-matching/review-agent';
import { db } from '../../db';
import { backgroundJobs, technologies } from '../../db/schema';
import type { TechnologyReviewJobData, TechnologyReviewJobResult } from '../queues';

/**
 * Process a technology review job
 *
 * Runs quick or deep review of technology features in the background.
 * Deep review uses AI + web search per feature, which can take several minutes.
 */
export async function processTechnologyReviewJob(
  job: Job<TechnologyReviewJobData, TechnologyReviewJobResult, string>
): Promise<TechnologyReviewJobResult> {
  const { technologyId, mode, featureNames, dbJobId } = job.data;

  console.log(
    `[TechnologyReview] Starting ${mode} review job ${job.id} for technology ${technologyId}`
  );

  try {
    // Update job status to running
    await db
      .update(backgroundJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
        progress: 0,
        currentStep: `${mode === 'deep' ? 'Deep' : 'Quick'} Review wird gestartet...`,
      })
      .where(eq(backgroundJobs.id, dbJobId));

    // Load technology + features
    const techResult = await db
      .select()
      .from(technologies)
      .where(eq(technologies.id, technologyId))
      .limit(1);
    const tech = techResult[0];

    if (!tech) {
      throw new Error('Technology not found');
    }

    if (!tech.features) {
      throw new Error('No features to review');
    }

    const features = JSON.parse(tech.features) as Record<string, FeatureData>;

    // Filter features if specific names provided
    const featuresToReview: Record<string, FeatureData> = featureNames
      ? Object.fromEntries(
          Object.entries(features).filter(([name]) =>
            featureNames.some(fn => fn.toLowerCase() === name.toLowerCase())
          )
        )
      : features;

    const featureCount = Object.keys(featuresToReview).length;

    if (featureCount === 0) {
      throw new Error('No matching features found');
    }

    let reviewResult;

    if (mode === 'deep') {
      // Deep Review: Each feature individually with AI + web search
      const entries = Object.entries(featuresToReview);
      const deepReviews = [];
      let completed = 0;

      for (const [name, data] of entries) {
        await db
          .update(backgroundJobs)
          .set({
            currentStep: `Deep Review: ${name} (${completed + 1}/${featureCount})`,
          })
          .where(eq(backgroundJobs.id, dbJobId));

        const result = await deepReviewFeature(tech.name, name, data);
        deepReviews.push(result);

        completed++;
        const progress = Math.round((completed / featureCount) * 100);

        await db.update(backgroundJobs).set({ progress }).where(eq(backgroundJobs.id, dbJobId));
        await job.updateProgress(progress);
      }

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
        mode: 'deep' as const,
      };
    } else {
      // Quick Review: Rule-based
      reviewResult = await reviewFeatureResearch({
        technologyName: tech.name ?? '',
        technologyId,
        features: featuresToReview,
      });
      reviewResult = { ...reviewResult, mode: 'quick' as const };

      await job.updateProgress(100);
    }

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

    // Save to DB
    await db
      .update(technologies)
      .set({
        features: JSON.stringify(updatedFeatures),
        lastResearchedAt: new Date(),
      })
      .where(eq(technologies.id, technologyId));

    const result: TechnologyReviewJobResult = {
      success: true,
      featuresReviewed: reviewResult.featuresReviewed,
      featuresImproved: reviewResult.featuresImproved,
      featuresFlagged: reviewResult.featuresFlagged,
      overallConfidence: reviewResult.overallConfidence,
    };

    // Update job as completed
    await db
      .update(backgroundJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
        currentStep: 'Abgeschlossen',
        result: JSON.stringify(result),
      })
      .where(eq(backgroundJobs.id, dbJobId));

    console.log(
      `[TechnologyReview] Job ${job.id} completed: ${result.featuresReviewed} reviewed, ${result.featuresImproved} improved`
    );

    return result;
  } catch (error) {
    console.error(`[TechnologyReview] Job ${job.id} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update job as failed
    await db
      .update(backgroundJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      })
      .where(eq(backgroundJobs.id, dbJobId));

    return {
      success: false,
      featuresReviewed: 0,
      featuresImproved: 0,
      featuresFlagged: 0,
      overallConfidence: 0,
      error: errorMessage,
    };
  }
}
