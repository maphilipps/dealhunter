/**
 * Parallel Matrix Orchestrator
 *
 * Orchestriert parallele Requirement Research Agents für die Anforderungsmatrix.
 * Startet einen Agent pro Requirement x CMS Kombination.
 *
 * Beispiel: 10 Requirements × 4 CMS = 40 parallele Agents
 */

import { and, eq, gt, inArray } from 'drizzle-orm';

import {
  runRequirementResearchAgent,
  getCachedRequirementResearch,
  type RequirementResearchResult,
  type ResearchEventEmitter,
} from './requirement-research-agent';
import type { RequirementMatch, CMSMatchingResult } from './schema';

import { db } from '@/lib/db';
import { cmsFeatureEvaluations, features, preQualifications, leadScans } from '@/lib/db/schema';
import { AgentEventType, type AgentEvent } from '@/lib/streaming/in-process/event-types';
import { runWithConcurrency } from '@/lib/utils/concurrency';

const CMS_FEATURE_CACHE_TTL_DAYS = 30;

function normalizeFeatureKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

  const featureIdByRequirementKey = new Map<string, string>();

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

    const now = new Date();

    // Prefer the dedicated cms_feature_evaluations cache (TTL-based).
    // Falls back to the legacy technology.features JSON cache if needed.
    try {
      const activeFeatureRows = await db
        .select({ id: features.id, name: features.name, slug: features.slug })
        .from(features)
        .where(eq(features.isActive, true));

      const featureIdByName = new Map<string, string>();
      const featureIdBySlug = new Map<string, string>();
      for (const f of activeFeatureRows) {
        featureIdByName.set(normalizeFeatureKey(f.name), f.id);
        featureIdBySlug.set(normalizeFeatureKey(f.slug), f.id);
      }

      for (const req of requirements) {
        const key = normalizeFeatureKey(req.name);
        const featureId = featureIdByName.get(key) ?? featureIdBySlug.get(key);
        if (featureId) featureIdByRequirementKey.set(key, featureId);
      }

      const featureIds = Array.from(new Set(featureIdByRequirementKey.values()));
      const techIds = cmsOptions.map(c => c.id);

      const cachedRows =
        featureIds.length > 0 && techIds.length > 0
          ? await db
              .select({
                featureId: cmsFeatureEvaluations.featureId,
                technologyId: cmsFeatureEvaluations.technologyId,
                score: cmsFeatureEvaluations.score,
                reasoning: cmsFeatureEvaluations.reasoning,
                expiresAt: cmsFeatureEvaluations.expiresAt,
              })
              .from(cmsFeatureEvaluations)
              .where(
                and(
                  inArray(cmsFeatureEvaluations.featureId, featureIds),
                  inArray(cmsFeatureEvaluations.technologyId, techIds),
                  gt(cmsFeatureEvaluations.expiresAt, now)
                )
              )
          : [];

      const cachedByKey = new Map(
        cachedRows.map(r => [`${r.featureId}:${r.technologyId}`, r] as const)
      );

      for (const cell of allCells) {
        const featureId = featureIdByRequirementKey.get(normalizeFeatureKey(cell.requirement));
        if (!featureId) {
          // Legacy fallback
          const legacy = await getCachedRequirementResearch(cell.cmsId, cell.requirement);
          if (legacy) {
            cell.result = legacy;
            cell.status = 'cached';
            matrix.metadata.cachedCells++;
            matrix.metadata.completedCells++;
          }
          continue;
        }

        const cached = cachedByKey.get(`${featureId}:${cell.cmsId}`);
        if (!cached) continue;

        cell.result = {
          requirement: cell.requirement,
          cmsId: cell.cmsId,
          cmsName: cell.cmsName,
          score: cached.score,
          confidence: 60,
          notes: cached.reasoning || 'Cache-Hit',
          supported: cached.score >= 60,
          evidence: [],
          sources: [],
          webSearchUsed: false,
          researchedAt: now.toISOString(),
          researchDurationMs: 0,
        };
        cell.status = 'cached';
        matrix.metadata.cachedCells++;
        matrix.metadata.completedCells++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isTableMissing =
        (msg.includes('relation') && msg.includes('does not exist')) ||
        (msg.includes('features') &&
          (msg.includes('does not exist') || msg.includes('Failed query')));
      if (isTableMissing) {
        console.warn(
          '[Matrix] Feature-Cache nicht verfügbar (features-Tabelle nicht vorhanden). Fahre ohne Cache fort.'
        );
      } else {
        console.warn('[Matrix] Cache lookup failed, continuing without cache:', msg);
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

          // Persist via Feature Library (auto-creates feature + upserts evaluation)
          if (opts.useCache) {
            try {
              const { upsertFeatureEvaluation } = await import('./feature-library');
              await upsertFeatureEvaluation({
                featureName: cell.requirement,
                technologyId: cell.cmsId,
                score: result.score,
                reasoning: result.notes || result.evidence?.join('; ') || null,
                confidence: result.confidence ?? null,
                sourceUrls: result.sources ?? null,
                notes: result.notes ?? null,
                ttlDays: CMS_FEATURE_CACHE_TTL_DAYS,
              });
            } catch (cacheSaveError) {
              console.warn('[Matrix] Feature Library cache save failed:', cacheSaveError);
            }
          }

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
 * License cost context for score adjustment
 */
export interface LicenseCostContext {
  companySize?: string;
  pageCount?: number;
  requirements?: Array<{ name: string; priority: string }>;
}

/**
 * Technology license info loaded from DB
 */
interface TechnologyLicenseInfo {
  id: string;
  annualLicenseCost: number;
  requiresEnterprise: boolean;
}

/**
 * Determines if the project context requires enterprise-grade CMS capabilities.
 */
function detectEnterpriseNeed(ctx?: LicenseCostContext): boolean {
  if (!ctx) return false;

  if (ctx.companySize && ['large', 'enterprise'].includes(ctx.companySize)) return true;
  if (ctx.pageCount && ctx.pageCount > 500) return true;

  const enterpriseKeywords = ['enterprise', 'multi-site', 'multisite', 'multi-mandant', 'konzern'];
  if (ctx.requirements) {
    for (const req of ctx.requirements) {
      if (req.priority !== 'must-have') continue;
      const lower = req.name.toLowerCase();
      if (enterpriseKeywords.some(kw => lower.includes(kw))) return true;
    }
  }

  return false;
}

/**
 * Calculates license cost score adjustment for a technology.
 *
 * - Open-Source (cost=0): +5 bonus
 * - Freemium (cost<=15k): 0
 * - Commercial + enterprise needed: 0 (negated)
 * - Commercial + enterprise NOT needed: -10 to -15 malus
 */
function calculateLicenseCostAdjustment(
  license: TechnologyLicenseInfo,
  needsEnterprise: boolean
): { adjustment: number; note: string } {
  const cost = license.annualLicenseCost;

  if (cost === 0) {
    return { adjustment: 5, note: 'Open-Source: kein Lizenzkostenrisiko (+5)' };
  }

  if (cost <= 15000) {
    return { adjustment: 0, note: `Geringe Lizenzkosten (${cost.toLocaleString('de-DE')} €/Jahr)` };
  }

  // Commercial CMS with significant cost
  if (needsEnterprise && license.requiresEnterprise) {
    return {
      adjustment: 0,
      note: `Enterprise-CMS gerechtfertigt: ${cost.toLocaleString('de-DE')} €/Jahr (Enterprise-Anforderungen erkannt)`,
    };
  }

  // Penalty scales with cost
  const malus = cost >= 40000 ? -15 : -10;
  return {
    adjustment: malus,
    note: `Hohe Lizenzkosten: ${cost.toLocaleString('de-DE')} €/Jahr ohne Enterprise-Bedarf (${malus})`,
  };
}

/**
 * Konvertiert Matrix zu CMSMatchingResult für Kompatibilität
 */
export function matrixToCMSMatchingResult(
  matrix: RequirementMatrix,
  licenseCostContext?: LicenseCostContext,
  technologyLicenseInfos?: TechnologyLicenseInfo[]
): CMSMatchingResult {
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
  const needsEnterprise = detectEnterpriseNeed(licenseCostContext);
  const licenseMap = new Map((technologyLicenseInfos ?? []).map(t => [t.id, t]));

  const comparedTechnologies = matrix.technologies.map(tech => {
    const techCells = matrix.cells.filter(c => c.cmsId === tech.id && c.result);

    const weightedScores = techCells.map(cell => {
      const weight = cell.priority === 'must-have' ? 2 : cell.priority === 'should-have' ? 1.5 : 1;
      return (cell.result?.score || 50) * weight;
    });

    const totalWeight = techCells.reduce((sum, cell) => {
      return sum + (cell.priority === 'must-have' ? 2 : cell.priority === 'should-have' ? 1.5 : 1);
    }, 0);

    let overallScore =
      totalWeight > 0 ? Math.round(weightedScores.reduce((a, b) => a + b, 0) / totalWeight) : 50;

    // Apply license cost adjustment
    let licenseCostAdjustment: number | undefined;
    let licenseCostNote: string | undefined;

    const licenseInfo = licenseMap.get(tech.id);
    if (licenseInfo) {
      const { adjustment, note } = calculateLicenseCostAdjustment(licenseInfo, needsEnterprise);
      if (adjustment !== 0) {
        licenseCostAdjustment = adjustment;
        overallScore = Math.max(0, Math.min(100, overallScore + adjustment));
      }
      licenseCostNote = note;
    }

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
      licenseCostAdjustment,
      licenseCostNote,
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
        ? `${primary.name} erreicht den höchsten Score (${primary.overallScore}%) basierend auf ${matrix.requirements.length} recherchierten Anforderungen.${primary.licenseCostNote ? ` Lizenzkosten: ${primary.licenseCostNote}` : ''}`
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
  matrix: RequirementMatrix,
  licenseCostContext?: LicenseCostContext,
  technologyLicenseInfos?: TechnologyLicenseInfo[]
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
      cmsMatchingResult: matrixToCMSMatchingResult(
        matrix,
        licenseCostContext,
        technologyLicenseInfos
      ),
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
