/**
 * Technology Research Orchestrator
 *
 * Koordiniert den gesamten Feature-Research-Workflow:
 * 1. Parallele Feature-Recherche (mit Concurrency Control)
 * 2. Automatischer Review der Ergebnisse
 * 3. Aggregation und Speicherung
 *
 * Orchestrator Pattern: Zentrale Steuerung aller Research-Agents
 */

import { db } from '@/lib/db';
import { technologies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { researchSingleRequirement, type FeatureResearchResult } from './agent';
import {
  reviewFeatureResearch,
  deepReviewFeature,
  type FeatureReview,
  type ReviewResult,
} from './review-agent';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

/**
 * Event Emitter für Streaming
 */
export type OrchestratorEventEmitter = (event: AgentEvent) => void;

/**
 * Research Task Status
 */
export interface ResearchTask {
  featureName: string;
  status: 'pending' | 'researching' | 'reviewing' | 'complete' | 'error';
  researchResult?: FeatureResearchResult;
  reviewResult?: FeatureReview;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Orchestrator Result
 */
export interface OrchestratorResult {
  technologyId: string;
  technologyName: string;
  tasks: ResearchTask[];
  review?: ReviewResult;
  metadata: {
    totalFeatures: number;
    successfulResearch: number;
    failedResearch: number;
    featuresImproved: number;
    featuresFlagged: number;
    overallConfidence: number;
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

/**
 * Orchestrator Options
 */
export interface OrchestratorOptions {
  /** Max parallele Research-Agents (default: unbegrenzt) */
  maxConcurrency?: number;
  /** Automatisch Review nach Research (default: true) */
  autoReview?: boolean;
  /** Review-Modus: 'quick' oder 'deep' (default: 'quick') */
  reviewMode?: 'quick' | 'deep';
  /** In DB speichern (default: true) */
  saveToDb?: boolean;
  /** Event Emitter für Streaming */
  emit?: OrchestratorEventEmitter;
}

/**
 * Concurrency Control: Führt Funktionen mit begrenzter Parallelität aus
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const promise = fn(item, i).then(result => {
      results[i] = result;
      completed++;
      onProgress?.(completed, items.length);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let j = executing.length - 1; j >= 0; j--) {
        const p = executing[j];
        const settled = await Promise.race([
          p.then(() => true).catch(() => true),
          Promise.resolve(false),
        ]);
        if (settled) {
          executing.splice(j, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Technology Research Orchestrator
 *
 * Hauptfunktion: Koordiniert Research + Review für mehrere Features
 */
export async function runTechnologyResearchOrchestrator(
  technologyId: string,
  featureNames: string[],
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const opts: Required<OrchestratorOptions> = {
    maxConcurrency: Infinity, // Keine Einschränkung - alle parallel
    autoReview: true,
    reviewMode: 'quick',
    saveToDb: true,
    emit: () => {},
    ...options,
  };

  // Emit helper
  const emit = (
    agent: string,
    message: string,
    type: AgentEventType = AgentEventType.AGENT_PROGRESS
  ) => {
    opts.emit({
      id: `orchestrator-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: Date.now(),
      data: { agent, message },
    });
  };

  // 1. Load Technology
  emit('Orchestrator', `Lade Technologie ${technologyId}...`);

  const [tech] = await db.select().from(technologies).where(eq(technologies.id, technologyId));

  if (!tech) {
    throw new Error(`Technologie ${technologyId} nicht gefunden`);
  }

  emit('Orchestrator', `Starte Research für ${tech.name}: ${featureNames.length} Features`);

  // Initialize tasks
  const tasks: ResearchTask[] = featureNames.map(name => ({
    featureName: name,
    status: 'pending',
  }));

  // 2. Phase 1: Parallel Feature Research
  emit('Orchestrator', `Phase 1: Parallele Feature-Recherche (${tasks.length} Agents)`);

  await runWithConcurrency(
    tasks,
    async (task, index) => {
      task.status = 'researching';
      task.startedAt = new Date().toISOString();

      emit(`Research Agent ${index + 1}`, `Recherchiere "${task.featureName}"...`);

      try {
        const result = await researchSingleRequirement(tech.name, task.featureName, technologyId);

        task.researchResult = result;
        task.status = 'complete';
        task.completedAt = new Date().toISOString();

        const supportInfo =
          result.supportType && result.supportType !== 'unknown'
            ? ` (${result.supportType}${result.moduleName ? ': ' + result.moduleName : ''})`
            : '';
        emit(
          `Research Agent ${index + 1}`,
          `"${task.featureName}" abgeschlossen: ${result.score}%${supportInfo}`,
          AgentEventType.AGENT_COMPLETE
        );
      } catch (error) {
        task.status = 'error';
        task.error = error instanceof Error ? error.message : 'Unbekannter Fehler';
        task.completedAt = new Date().toISOString();

        emit(
          `Research Agent ${index + 1}`,
          `"${task.featureName}" fehlgeschlagen: ${task.error}`,
          AgentEventType.ERROR
        );
      }
    },
    opts.maxConcurrency,
    (completed, total) => {
      emit('Orchestrator', `Research-Fortschritt: ${completed}/${total}`);
    }
  );

  // Count results
  const successfulTasks = tasks.filter(t => t.status === 'complete');
  const failedTasks = tasks.filter(t => t.status === 'error');

  emit(
    'Orchestrator',
    `Phase 1 abgeschlossen: ${successfulTasks.length} erfolgreich, ${failedTasks.length} fehlgeschlagen`
  );

  // 3. Phase 2: Review (optional)
  let reviewResult: ReviewResult | undefined;

  if (opts.autoReview && successfulTasks.length > 0) {
    emit('Orchestrator', `Phase 2: ${opts.reviewMode === 'deep' ? 'Deep' : 'Quick'} Review`);

    // Load current features from DB
    const [updatedTech] = await db
      .select({ features: technologies.features })
      .from(technologies)
      .where(eq(technologies.id, technologyId));

    const currentFeatures = updatedTech?.features ? JSON.parse(updatedTech.features) : {};

    // Filter to only researched features
    const featuresToReview: Record<string, any> = {};
    for (const task of successfulTasks) {
      if (currentFeatures[task.featureName]) {
        featuresToReview[task.featureName] = currentFeatures[task.featureName];
      }
    }

    if (Object.keys(featuresToReview).length > 0) {
      emit('Review Agent', `Prüfe ${Object.keys(featuresToReview).length} Features...`);

      if (opts.reviewMode === 'deep') {
        // Deep Review: Parallel AI-Review für jedes Feature
        const deepReviews = await runWithConcurrency(
          Object.entries(featuresToReview),
          async ([name, data]) => {
            emit('Review Agent', `Deep Review: "${name}"...`);
            const review = await deepReviewFeature(tech.name, name, data);

            // Update task with review result
            const task = tasks.find(t => t.featureName === name);
            if (task) {
              task.reviewResult = review;
            }

            return review;
          },
          opts.maxConcurrency
        );

        reviewResult = {
          technologyName: tech.name,
          reviewedAt: new Date().toISOString(),
          totalFeatures: Object.keys(currentFeatures).length,
          featuresReviewed: deepReviews.length,
          featuresImproved: deepReviews.filter(r => r.corrections.length > 0).length,
          featuresFlagged: deepReviews.filter(r => r.needsManualReview).length,
          overallConfidence: Math.round(
            deepReviews.reduce((sum, r) => sum + r.confidence, 0) / deepReviews.length
          ),
          summary: `Deep Review: ${deepReviews.length} Features analysiert`,
          features: deepReviews,
        };
      } else {
        // Quick Review: Regelbasiert
        reviewResult = await reviewFeatureResearch({
          technologyName: tech.name,
          technologyId,
          features: featuresToReview,
        });

        // Update tasks with review results
        for (const review of reviewResult.features) {
          const task = tasks.find(t => t.featureName === review.featureName);
          if (task) {
            task.reviewResult = review;
          }
        }
      }

      emit(
        'Review Agent',
        `Review abgeschlossen: ${reviewResult.featuresImproved} verbessert, ${reviewResult.featuresFlagged} markiert`,
        AgentEventType.AGENT_COMPLETE
      );

      // 4. Save reviewed features to DB
      if (opts.saveToDb && reviewResult.featuresImproved > 0) {
        emit('Orchestrator', 'Speichere korrigierte Features...');

        const updatedFeatures = { ...currentFeatures };
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
          .where(eq(technologies.id, technologyId));
      }
    }
  }

  // 5. Build final result
  const endTime = Date.now();

  const result: OrchestratorResult = {
    technologyId,
    technologyName: tech.name,
    tasks,
    review: reviewResult,
    metadata: {
      totalFeatures: featureNames.length,
      successfulResearch: successfulTasks.length,
      failedResearch: failedTasks.length,
      featuresImproved: reviewResult?.featuresImproved || 0,
      featuresFlagged: reviewResult?.featuresFlagged || 0,
      overallConfidence: reviewResult?.overallConfidence || 0,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
      durationMs: endTime - startTime,
    },
  };

  emit(
    'Orchestrator',
    `Workflow abgeschlossen in ${Math.round(result.metadata.durationMs / 1000)}s`,
    AgentEventType.AGENT_COMPLETE
  );

  return result;
}

/**
 * Orchestrator für alle Features einer Technologie (Bulk Research)
 */
export async function runFullTechnologyResearch(
  technologyId: string,
  options: OrchestratorOptions & { featureList?: string[] } = {}
): Promise<OrchestratorResult> {
  // Standard-Features wenn keine angegeben
  const defaultFeatures = [
    'Mehrsprachigkeit',
    'E-Commerce',
    'Formulare',
    'Suche',
    'SEO',
    'Media Management',
    'Workflows',
    'Benutzerkonten',
    'API/Headless',
    'Personalisierung',
  ];

  const featureNames = options.featureList || defaultFeatures;

  return runTechnologyResearchOrchestrator(technologyId, featureNames, options);
}
