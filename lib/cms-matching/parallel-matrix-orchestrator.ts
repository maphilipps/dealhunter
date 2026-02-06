/**
 * Parallel Matrix Orchestrator
 *
 * Orchestriert parallele Requirement Research Agents für die Anforderungsmatrix.
 * Startet einen Agent pro Requirement x CMS Kombination.
 *
 * Beispiel: 10 Requirements × 4 CMS = 40 parallele Agents
 */

import { eq } from 'drizzle-orm';

import {
  runRequirementResearchAgent,
  getCachedRequirementResearch,
  type RequirementResearchResult,
  type ResearchEventEmitter,
} from './requirement-research-agent';
import type { RequirementMatch, CMSMatchingResult } from './schema';

import { db } from '@/lib/db';
import { preQualifications, leadScans } from '@/lib/db/schema';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/event-types';

/**
 * Matrix Cell: Ein Requirement × CMS Kombination
 */
export interface MatrixCell {
  requirement: string;
  category: RequirementMatch['category'];
  priority: RequirementMatch['priority'];
  cmsId: string;
  cmsName: string;
  result?: RequirementResearchResult;
  status: 'pending' | 'running' | 'complete' | 'cached' | 'error';
}

/**
 * Gesamte Anforderungsmatrix
 */
export interface RequirementMatrix {
  requirements: Array<{
    name: string;
    category: RequirementMatch['category'];
    priority: RequirementMatch['priority'];
    source: RequirementMatch['source'];
  }>;
  technologies: Array<{
    id: string;
    name: string;
    isBaseline: boolean;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  cells: MatrixCell[];
  metadata: {
    totalCells: number;
    completedCells: number;
    cachedCells: number;
    averageScore: number;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
  };
}

/**
 * Event Emitter für Streaming
 */
export type MatrixEventEmitter = (event: AgentEvent) => void;

/**
 * Concurrency Control für parallele Requests
 */
const CONCURRENT_AGENTS = 10; // Limit to prevent pool exhaustion

/**
 * Führt Funktionen mit begrenzter Parallelität aus
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Create a promise that removes itself from the executing array upon completion
    let promiseToRemove: Promise<void> | null = null;
    const promise = (async () => {
      try {
        results[i] = await fn(item, i);
      } finally {
        // This will be executed when the promise settles (resolves or rejects)
        // We use a functional approach to remove the specific promise instance
        if (promiseToRemove) {
          const index = executing.indexOf(promiseToRemove);
          if (index !== -1) {
            void executing.splice(index, 1);
          }
        }
      }
    })();
    promiseToRemove = promise;
    void promise;

    executing.push(promise);

    if (executing.length >= concurrency) {
      const racePromise = Promise.race(executing);
      await racePromise;
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Parallel Matrix Orchestrator
 *
 * Startet parallele Research Agents für alle Requirement x CMS Kombinationen.
 */
export async function runParallelMatrixResearch(
  requirements: Array<{
    name: string;
    category: RequirementMatch['category'];
    priority: RequirementMatch['priority'];
    source: RequirementMatch['source'];
  }>,
  cmsOptions: Array<{
    id: string;
    name: string;
    isBaseline: boolean;
    strengths?: string[];
    weaknesses?: string[];
  }>,
  emit?: MatrixEventEmitter,
  options?: {
    useCache?: boolean;
    saveToDb?: boolean;
    maxConcurrency?: number;
  }
): Promise<RequirementMatrix> {
  const startTime = Date.now();
  const opts = {
    useCache: true,
    saveToDb: true,
    maxConcurrency: CONCURRENT_AGENTS,
    ...options,
  };

  // Initialize matrix
  const matrix: RequirementMatrix = {
    requirements,
    technologies: cmsOptions,
    cells: [],
    metadata: {
      totalCells: requirements.length * cmsOptions.length,
      completedCells: 0,
      cachedCells: 0,
      averageScore: 0,
      startedAt: new Date().toISOString(),
    },
  };

  emit?.({
    id: `matrix-start-${Date.now()}`,
    type: AgentEventType.AGENT_PROGRESS,
    timestamp: Date.now(),
    data: {
      agent: 'Matrix Orchestrator',
      message: `Starte Anforderungsmatrix: ${requirements.length} Requirements × ${cmsOptions.length} CMS = ${matrix.metadata.totalCells} Kombinationen`,
    },
  });

  // Build all cells (Requirement × CMS combinations)
  const allCells: MatrixCell[] = [];

  for (const req of requirements) {
    for (const cms of cmsOptions) {
      allCells.push({
        requirement: req.name,
        category: req.category,
        priority: req.priority,
        cmsId: cms.id,
        cmsName: cms.name,
        status: 'pending',
      });
    }
  }

  // Check cache first
  if (opts.useCache) {
    emit?.({
      id: `matrix-cache-${Date.now()}`,
      type: AgentEventType.AGENT_PROGRESS,
      timestamp: Date.now(),
      data: {
        agent: 'Matrix Orchestrator',
        message: 'Prüfe Cache für bereits recherchierte Kombinationen...',
      },
    });

    for (const cell of allCells) {
      const cached = await getCachedRequirementResearch(cell.cmsId, cell.requirement);
      if (cached) {
        cell.result = cached;
        cell.status = 'cached';
        matrix.metadata.cachedCells++;
        matrix.metadata.completedCells++;
      }
    }

    if (matrix.metadata.cachedCells > 0) {
      emit?.({
        id: `matrix-cache-hit-${Date.now()}`,
        type: AgentEventType.AGENT_PROGRESS,
        timestamp: Date.now(),
        data: {
          agent: 'Matrix Orchestrator',
          message: `${matrix.metadata.cachedCells} Kombinationen aus Cache geladen`,
        },
      });
    }
  }

  // Filter cells that need research
  const cellsToResearch = allCells.filter(c => c.status === 'pending');

  if (cellsToResearch.length > 0) {
    emit?.({
      id: `matrix-research-start-${Date.now()}`,
      type: AgentEventType.AGENT_PROGRESS,
      timestamp: Date.now(),
      data: {
        agent: 'Matrix Orchestrator',
        message: `Starte ${cellsToResearch.length} parallele Research Agents...`,
      },
    });

    // Run research agents in parallel with concurrency control
    await runWithConcurrency(
      cellsToResearch,
      async (cell, index) => {
        cell.status = 'running';

        // Create cell-specific emitter
        const cellEmit: ResearchEventEmitter = event => {
          if (event.type === 'RESEARCH_PROGRESS' || event.type === 'RESEARCH_COMPLETE') {
            emit?.({
              id: `cell-${cell.cmsId}-${index}-${Date.now()}`,
              type: AgentEventType.AGENT_PROGRESS,
              timestamp: Date.now(),
              data: {
                agent: `${cell.cmsName} Agent`,
                message: `[${cell.requirement}] ${event.data.message}`,
              },
            });
          }
        };

        try {
          const result = await runRequirementResearchAgent(
            {
              requirement: cell.requirement,
              category: cell.category,
              priority: cell.priority,
              cmsId: cell.cmsId,
              cmsName: cell.cmsName,
              saveToDb: opts.saveToDb,
            },
            cellEmit
          );

          cell.result = result;
          cell.status = 'complete';
          matrix.metadata.completedCells++;

          // Progress update
          const progress = Math.round(
            (matrix.metadata.completedCells / matrix.metadata.totalCells) * 100
          );

          emit?.({
            id: `matrix-progress-${Date.now()}`,
            type: AgentEventType.AGENT_PROGRESS,
            timestamp: Date.now(),
            data: {
              agent: 'Matrix Orchestrator',
              message: `Fortschritt: ${matrix.metadata.completedCells}/${matrix.metadata.totalCells} (${progress}%)`,
            },
          });
        } catch (error) {
          cell.status = 'error';
          console.error(
            `[Matrix] Error researching ${cell.requirement} for ${cell.cmsName}:`,
            error
          );
        }
      },
      opts.maxConcurrency
    );
  }

  // Calculate final statistics
  matrix.cells = allCells;

  const completedResults = allCells.filter(c => c.result).map(c => c.result!.score);

  matrix.metadata.averageScore =
    completedResults.length > 0
      ? Math.round(completedResults.reduce((a, b) => a + b, 0) / completedResults.length)
      : 0;

  matrix.metadata.completedAt = new Date().toISOString();
  matrix.metadata.durationMs = Date.now() - startTime;

  emit?.({
    id: `matrix-complete-${Date.now()}`,
    type: AgentEventType.AGENT_COMPLETE,
    timestamp: Date.now(),
    data: {
      agent: 'Matrix Orchestrator',
      message: `Anforderungsmatrix abgeschlossen in ${Math.round(matrix.metadata.durationMs / 1000)}s. Durchschnittlicher Score: ${matrix.metadata.averageScore}/100`,
    },
  });

  return matrix;
}

/**
 * Konvertiert Matrix zu CMSMatchingResult für Kompatibilität
 */
export function matrixToCMSMatchingResult(matrix: RequirementMatrix): CMSMatchingResult {
  // Group results by requirement
  const requirementsWithScores: RequirementMatch[] = matrix.requirements.map(req => {
    const cmsScores: RequirementMatch['cmsScores'] = {};

    for (const tech of matrix.technologies) {
      const cell = matrix.cells.find(c => c.requirement === req.name && c.cmsId === tech.id);

      if (cell?.result) {
        cmsScores[tech.id] = {
          score: cell.result.score,
          confidence: cell.result.confidence,
          notes: cell.result.notes,
          webSearchUsed: cell.result.webSearchUsed,
        };
      } else {
        cmsScores[tech.id] = {
          score: 50,
          confidence: 15,
          notes: 'Keine Recherche-Daten',
          webSearchUsed: false,
        };
      }
    }

    return {
      requirement: req.name,
      category: req.category,
      priority: req.priority,
      source: req.source,
      cmsScores,
    };
  });

  // Calculate overall scores per technology
  const comparedTechnologies = matrix.technologies.map(tech => {
    const techCells = matrix.cells.filter(c => c.cmsId === tech.id && c.result);

    const weightedScores = techCells.map(cell => {
      const weight = cell.priority === 'must-have' ? 2 : cell.priority === 'should-have' ? 1.5 : 1;
      return (cell.result?.score || 50) * weight;
    });

    const totalWeight = techCells.reduce((sum, cell) => {
      return sum + (cell.priority === 'must-have' ? 2 : cell.priority === 'should-have' ? 1.5 : 1);
    }, 0);

    const overallScore =
      totalWeight > 0 ? Math.round(weightedScores.reduce((a, b) => a + b, 0) / totalWeight) : 50;

    // Extract strengths (high scores) and weaknesses (low scores)
    const strengths = techCells
      .filter(c => c.result && c.result.score >= 70)
      .map(c => c.requirement)
      .slice(0, 5);

    const weaknesses = techCells
      .filter(c => c.result && c.result.score < 40)
      .map(c => c.requirement)
      .slice(0, 5);

    const combinedStrengths = Array.from(
      new Set([...(tech.strengths ?? []), ...strengths].filter(Boolean))
    ).slice(0, 6);
    const combinedWeaknesses = Array.from(
      new Set([...(tech.weaknesses ?? []), ...weaknesses].filter(Boolean))
    ).slice(0, 6);

    return {
      id: tech.id,
      name: tech.name,
      category: 'CMS',
      isBaseline: tech.isBaseline,
      overallScore,
      strengths: combinedStrengths,
      weaknesses: combinedWeaknesses,
    };
  });

  // Sort by score
  comparedTechnologies.sort((a, b) => b.overallScore - a.overallScore);

  const primary = comparedTechnologies[0];
  const alternative = comparedTechnologies[1];

  const mustHaveCount = matrix.requirements.filter(r => r.priority === 'must-have').length;

  return {
    requirements: requirementsWithScores,
    comparedTechnologies,
    recommendation: {
      primaryCms: primary?.name || 'Unbekannt',
      reasoning: primary
        ? `${primary.name} erreicht den höchsten Score (${primary.overallScore}%) basierend auf ${matrix.requirements.length} recherchierten Anforderungen.`
        : 'Keine Empfehlung möglich',
      alternativeCms: alternative?.name,
      alternativeReasoning: alternative
        ? `${alternative.name} als Alternative mit ${alternative.overallScore}%.`
        : undefined,
      confidence: primary?.overallScore || 0,
    },
    metadata: {
      matchedAt: matrix.metadata.completedAt || new Date().toISOString(),
      webSearchUsed: true,
      totalRequirements: matrix.requirements.length,
      mustHaveCount,
      averageMatchScore: matrix.metadata.averageScore,
    },
  };
}

/**
 * Speichert die Matrix am Qualification
 */
export async function saveMatrixToRfp(
  preQualificationId: string,
  matrix: RequirementMatrix
): Promise<void> {
  try {
    // Load linked quick scan ID
    const preQualification = await db
      .select({ qualificationScanId: preQualifications.qualificationScanId })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    const qualificationScanId = preQualification[0]?.qualificationScanId;
    if (!qualificationScanId) {
      console.warn(`[Matrix] No qualificationScanId for pre-qualification ${preQualificationId}`);
      return;
    }

    const cmsEvaluation = {
      cmsMatchingMatrix: matrix,
      cmsMatchingResult: matrixToCMSMatchingResult(matrix),
      generatedAt: new Date().toISOString(),
      source: 'cms-matrix',
    };

    // Persist to leadScans as source of truth
    await db
      .update(leadScans)
      .set({
        cmsEvaluation: JSON.stringify(cmsEvaluation),
        cmsEvaluationCompletedAt: new Date(),
      })
      .where(eq(leadScans.id, qualificationScanId));

    console.log(`[Matrix] Saved matrix to Qualification ${preQualificationId}`);
  } catch (error) {
    console.error('[Matrix] Error saving to Qualification:', error);
    throw error;
  }
}
