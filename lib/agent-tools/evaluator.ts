/**
 * Agent Results Evaluator
 *
 * AI-basierte Qualitätsprüfung für Agent-Ergebnisse.
 * Prüft Vollständigkeit, Confidence-Werte und Konsistenz.
 *
 * Verwendung:
 * ```ts
 * const evaluation = await evaluateResults(quickScanResults, quickScanEvaluationSchema);
 * if (evaluation.qualityScore < 80 && evaluation.canImprove) {
 *   results = await optimizeResults(results, evaluation, tools);
 * }
 * ```
 */

import { z } from 'zod';
import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// ========================================
// Types
// ========================================

export interface EvaluationIssue {
  area: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  suggestion: string;
  canAutoFix: boolean;
}

export interface EvaluationResult {
  qualityScore: number;         // 0-100
  confidencesMet: boolean;      // All required fields have confidence >= threshold
  completeness: number;         // 0-100, percentage of required fields filled
  issues: EvaluationIssue[];
  canImprove: boolean;          // Has actionable improvements
  summary: string;
}

export interface EvaluationSchema {
  requiredFields: Array<{
    path: string;
    minConfidence?: number;
    description: string;
  }>;
  optionalFields?: Array<{
    path: string;
    bonusPoints: number;
    description: string;
  }>;
  minQualityScore?: number;
  context?: string;
}

export interface EvaluatorContext {
  emit?: EventEmitter;
  agentName?: string;
}

// ========================================
// Evaluation Schemas
// ========================================

const evaluationResultZodSchema = z.object({
  qualityScore: z.number().min(0).max(100),
  confidencesMet: z.boolean(),
  completeness: z.number().min(0).max(100),
  issues: z.array(z.object({
    area: z.string(),
    severity: z.enum(['critical', 'major', 'minor']),
    description: z.string(),
    suggestion: z.string(),
    canAutoFix: z.boolean(),
  })),
  canImprove: z.boolean(),
  summary: z.string(),
});

type EvaluationResultFromZod = z.infer<typeof evaluationResultZodSchema>;

// ========================================
// Pre-defined Evaluation Schemas
// ========================================

/**
 * Evaluation Schema für QuickScan Results
 */
export const QUICKSCAN_EVALUATION_SCHEMA: EvaluationSchema = {
  requiredFields: [
    { path: 'techStack.cms', minConfidence: 70, description: 'CMS Detection' },
    { path: 'contentVolume.estimatedPageCount', description: 'Page Count' },
    { path: 'features', description: 'Feature Detection' },
    { path: 'blRecommendation.primaryBusinessLine', minConfidence: 60, description: 'BL Recommendation' },
  ],
  optionalFields: [
    { path: 'techStack.cmsVersion', bonusPoints: 5, description: 'CMS Version' },
    { path: 'companyIntelligence', bonusPoints: 10, description: 'Company Intel' },
    { path: 'accessibilityAudit', bonusPoints: 5, description: 'Accessibility Audit' },
    { path: 'seoAudit', bonusPoints: 5, description: 'SEO Audit' },
    { path: 'migrationComplexity', bonusPoints: 10, description: 'Migration Analysis' },
    { path: 'decisionMakers', bonusPoints: 10, description: 'Decision Makers' },
  ],
  minQualityScore: 70,
  context: 'QuickScan Website Analysis',
};

/**
 * Evaluation Schema für CMS Matching
 */
export const CMS_MATCHING_EVALUATION_SCHEMA: EvaluationSchema = {
  requiredFields: [
    { path: 'recommendedCms', minConfidence: 75, description: 'CMS Recommendation' },
    { path: 'featureMatch', minConfidence: 70, description: 'Feature Match Score' },
    { path: 'reasoning', description: 'Reasoning' },
  ],
  optionalFields: [
    { path: 'alternativeCms', bonusPoints: 5, description: 'Alternative CMS Options' },
    { path: 'versionInfo', bonusPoints: 5, description: 'Version Information' },
    { path: 'migrationPath', bonusPoints: 10, description: 'Migration Path Analysis' },
  ],
  minQualityScore: 75,
  context: 'CMS Selection & Matching',
};

/**
 * Evaluation Schema für BIT Evaluation
 */
export const BIT_EVALUATION_SCHEMA: EvaluationSchema = {
  requiredFields: [
    { path: 'decision', description: 'BIT/NO BIT Decision' },
    { path: 'overallScore', minConfidence: 70, description: 'Overall Score' },
    { path: 'reasoning', description: 'Decision Reasoning' },
  ],
  optionalFields: [
    { path: 'capabilityScore', bonusPoints: 5, description: 'Capability Assessment' },
    { path: 'competitionScore', bonusPoints: 5, description: 'Competition Analysis' },
    { path: 'dealQualityScore', bonusPoints: 5, description: 'Deal Quality Score' },
  ],
  minQualityScore: 80,
  context: 'BIT/NO BIT Evaluation',
};

// ========================================
// Helper Functions
// ========================================

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Check if a value is considered "filled"
 */
function isValueFilled(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

/**
 * Calculate basic quality metrics from results
 */
function calculateBasicMetrics(results: Record<string, any>, schema: EvaluationSchema): {
  filledRequired: number;
  totalRequired: number;
  filledOptional: number;
  totalOptional: number;
  confidenceIssues: string[];
} {
  let filledRequired = 0;
  let totalRequired = schema.requiredFields.length;
  const confidenceIssues: string[] = [];

  for (const field of schema.requiredFields) {
    const value = getNestedValue(results, field.path);
    if (isValueFilled(value)) {
      filledRequired++;

      // Check confidence if applicable
      if (field.minConfidence) {
        const confidencePath = field.path.replace(/\.([^.]+)$/, '.confidence') || field.path + 'Confidence';
        const confidence = getNestedValue(results, confidencePath) ||
                          getNestedValue(results, field.path + 'Confidence');

        if (confidence !== undefined && confidence < field.minConfidence) {
          confidenceIssues.push(`${field.description}: ${confidence}% < ${field.minConfidence}%`);
        }
      }
    }
  }

  let filledOptional = 0;
  const totalOptional = schema.optionalFields?.length || 0;

  for (const field of schema.optionalFields || []) {
    const value = getNestedValue(results, field.path);
    if (isValueFilled(value)) {
      filledOptional++;
    }
  }

  return { filledRequired, totalRequired, filledOptional, totalOptional, confidenceIssues };
}

// ========================================
// Main Evaluation Function
// ========================================

/**
 * Evaluate Agent Results
 *
 * Uses AI to analyze results quality and suggest improvements.
 */
export async function evaluateResults(
  results: Record<string, any>,
  schema: EvaluationSchema,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Evaluator',
      message: 'Prüfe Ergebnisqualität...',
    },
  });

  // Calculate basic metrics
  const metrics = calculateBasicMetrics(results, schema);
  const completeness = Math.round((metrics.filledRequired / metrics.totalRequired) * 100);

  // Calculate base score
  let baseScore = completeness;

  // Add bonus points for optional fields
  if (metrics.totalOptional > 0) {
    const optionalBonus = schema.optionalFields?.reduce((sum, field) => {
      const value = getNestedValue(results, field.path);
      return sum + (isValueFilled(value) ? field.bonusPoints : 0);
    }, 0) || 0;
    baseScore = Math.min(100, baseScore + optionalBonus);
  }

  // Deduct points for confidence issues
  const confidencePenalty = metrics.confidenceIssues.length * 5;
  baseScore = Math.max(0, baseScore - confidencePenalty);

  // Use AI for deeper analysis
  try {
    const aiEvaluation: EvaluationResultFromZod = await generateStructuredOutput({
      schema: evaluationResultZodSchema,
      system: `Du bist ein Qualitätsprüfer für AI Agent Ergebnisse.
Analysiere die Ergebnisse auf:
1. Vollständigkeit - Sind alle wichtigen Informationen vorhanden?
2. Plausibilität - Sind die Ergebnisse logisch konsistent?
3. Confidence - Sind die Confidence-Werte akzeptabel (>70%)?
4. Verbesserungspotenzial - Was kann verbessert werden?

Kontext: ${schema.context || 'Agent Results Evaluation'}

Wichtig: Sei konstruktiv. Wenn etwas fehlt, schlage vor, wie man es finden könnte.`,
      prompt: `Bewerte diese Ergebnisse:

${JSON.stringify(results, null, 2)}

Vorläufige Metriken:
- Vollständigkeit: ${completeness}%
- Basis-Score: ${baseScore}
- Confidence-Probleme: ${metrics.confidenceIssues.join(', ') || 'Keine'}

Erforderliche Felder: ${schema.requiredFields.map(f => f.description).join(', ')}
Optionale Felder: ${schema.optionalFields?.map(f => f.description).join(', ') || 'Keine'}

Gib eine strukturierte Bewertung mit konkreten Verbesserungsvorschlägen.`,
    });

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Evaluator',
        message: `Score: ${aiEvaluation.qualityScore}/100 - ${aiEvaluation.issues.length} Verbesserungen möglich`,
        confidence: aiEvaluation.qualityScore,
      },
    });

    return aiEvaluation;
  } catch (error) {
    // Fallback to basic evaluation if AI fails
    console.warn('[Evaluator] AI evaluation failed, using basic metrics:', error);

    const issues: EvaluationIssue[] = [];

    // Add issues for missing required fields
    for (const field of schema.requiredFields) {
      const value = getNestedValue(results, field.path);
      if (!isValueFilled(value)) {
        issues.push({
          area: field.path.split('.')[0],
          severity: 'critical',
          description: `${field.description} fehlt`,
          suggestion: `Versuche ${field.description} über Web Search oder zusätzliches Crawling zu ermitteln`,
          canAutoFix: true,
        });
      }
    }

    // Add issues for low confidence
    for (const issue of metrics.confidenceIssues) {
      issues.push({
        area: 'confidence',
        severity: 'major',
        description: issue,
        suggestion: 'Verifiziere die Daten über zusätzliche Quellen',
        canAutoFix: true,
      });
    }

    const result: EvaluationResult = {
      qualityScore: baseScore,
      confidencesMet: metrics.confidenceIssues.length === 0,
      completeness,
      issues,
      canImprove: issues.some(i => i.canAutoFix),
      summary: `Basis-Evaluation: ${baseScore}% Qualität, ${issues.length} Verbesserungen möglich`,
    };

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Evaluator',
        message: `Score: ${baseScore}/100 (Fallback)`,
        confidence: baseScore,
      },
    });

    return result;
  }
}

/**
 * Quick evaluation without AI (faster, less accurate)
 */
export function quickEvaluate(
  results: Record<string, any>,
  schema: EvaluationSchema
): { score: number; issues: string[]; canImprove: boolean } {
  const metrics = calculateBasicMetrics(results, schema);
  const completeness = Math.round((metrics.filledRequired / metrics.totalRequired) * 100);

  const issues: string[] = [];

  // Check required fields
  for (const field of schema.requiredFields) {
    const value = getNestedValue(results, field.path);
    if (!isValueFilled(value)) {
      issues.push(`Missing: ${field.description}`);
    }
  }

  // Add confidence issues
  issues.push(...metrics.confidenceIssues);

  return {
    score: completeness,
    issues,
    canImprove: issues.length > 0,
  };
}

// ========================================
// Specialized Evaluators
// ========================================

/**
 * Evaluate QuickScan Results
 */
export async function evaluateQuickScanResults(
  results: Record<string, any>,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  return evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA, {
    ...ctx,
    agentName: ctx.agentName || 'QuickScan Evaluator',
  });
}

/**
 * Evaluate CMS Matching Results
 */
export async function evaluateCMSMatchingResults(
  results: Record<string, any>,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  return evaluateResults(results, CMS_MATCHING_EVALUATION_SCHEMA, {
    ...ctx,
    agentName: ctx.agentName || 'CMS Matching Evaluator',
  });
}

/**
 * Evaluate BIT Evaluation Results
 */
export async function evaluateBITResults(
  results: Record<string, any>,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  return evaluateResults(results, BIT_EVALUATION_SCHEMA, {
    ...ctx,
    agentName: ctx.agentName || 'BIT Evaluator',
  });
}
