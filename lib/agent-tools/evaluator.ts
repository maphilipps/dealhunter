/**
 * Agent Results Evaluator
 *
 * AI-basierte Qualitätsprüfung für Agent-Ergebnisse.
 * Prüft Vollständigkeit, Confidence-Werte und Konsistenz.
 *
 * Verwendung:
 * ```ts
 * const evaluation = await evaluateResults(qualificationScanResults, quickScanEvaluationSchema);
 * if (evaluation.qualityScore < 80 && evaluation.canImprove) {
 *   results = await optimizeResults(results, evaluation, tools);
 * }
 * ```
 */

import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';

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
  qualityScore: number; // 0-100
  confidencesMet: boolean; // All required fields have confidence >= threshold
  completeness: number; // 0-100, percentage of required fields filled
  issues: EvaluationIssue[];
  canImprove: boolean; // Has actionable improvements
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
  issues: z.array(
    z.object({
      area: z.string(),
      severity: z.enum(['critical', 'major', 'minor']),
      description: z.string(),
      suggestion: z.string(),
      canAutoFix: z.boolean(),
    })
  ),
  canImprove: z.boolean(),
  summary: z.string(),
});

type EvaluationResultFromZod = z.infer<typeof evaluationResultZodSchema>;

// ========================================
// Pre-defined Evaluation Schemas
// ========================================

/**
 * Evaluation Schema für QualificationScan Results
 */
export const QUICKSCAN_EVALUATION_SCHEMA: EvaluationSchema = {
  requiredFields: [
    { path: 'techStack.cms', minConfidence: 70, description: 'CMS Detection' },
    { path: 'contentVolume.estimatedPageCount', description: 'Page Count' },
    { path: 'features', description: 'Feature Detection' },
    {
      path: 'blRecommendation.primaryBusinessLine',
      minConfidence: 60,
      description: 'BL Recommendation',
    },
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
  context: 'Qualification Scan Website Analysis',
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
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce((current: unknown, key) => (current as Record<string, unknown>)?.[key], obj);
}

/**
 * Check if a value is considered "filled"
 */
function isValueFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

// ========================================
// Primitive Functions (stateless, no side effects)
// ========================================

export interface FieldValidation {
  path: string;
  description: string;
  filled: boolean;
  confidence: number | null;
  meetsThreshold: boolean;
  requiredConfidence: number | undefined;
}

/**
 * Validate each field against data — returns per-field filled/confidence status.
 * Pure data: no event emission, no scoring logic.
 */
export function validateFields(
  data: Record<string, unknown>,
  requiredFields: EvaluationSchema['requiredFields']
): FieldValidation[] {
  return requiredFields.map(field => {
    const value = getNestedValue(data, field.path);
    const filled = isValueFilled(value);

    let confidence: number | null = null;
    let meetsThreshold = true;

    if (field.minConfidence && filled) {
      const confidencePath =
        field.path.replace(/\.([^.]+)$/, '.confidence') || field.path + 'Confidence';
      const rawConfidence =
        getNestedValue(data, confidencePath) || getNestedValue(data, field.path + 'Confidence');

      if (typeof rawConfidence === 'number') {
        confidence = rawConfidence;
        meetsThreshold = rawConfidence >= field.minConfidence;
      }
    }

    return {
      path: field.path,
      description: field.description,
      filled,
      confidence,
      meetsThreshold,
      requiredConfidence: field.minConfidence,
    };
  });
}

export interface ConfidenceCount {
  met: number;
  total: number;
  issues: string[];
}

/**
 * Count how many fields with confidence requirements meet their threshold.
 * Pure math: no event emission, no scoring.
 */
export function countConfidencesMet(
  data: Record<string, unknown>,
  schema: EvaluationSchema
): ConfidenceCount {
  const validations = validateFields(data, schema.requiredFields);
  const fieldsWithConfidence = validations.filter(v => v.requiredConfidence !== undefined);

  const met = fieldsWithConfidence.filter(v => v.meetsThreshold).length;
  const total = fieldsWithConfidence.length;
  const issues = fieldsWithConfidence
    .filter(v => !v.meetsThreshold && v.confidence !== null)
    .map(v => `${v.description}: ${v.confidence}% < ${v.requiredConfidence}%`);

  return { met, total, issues };
}

export interface CompletenessResult {
  completeness: number;
  filledRequired: number;
  totalRequired: number;
  filledOptional: number;
  totalOptional: number;
}

/**
 * Calculate completeness percentage from filled required/optional fields.
 * Pure math: no event emission, no AI.
 */
export function calculateCompleteness(
  data: Record<string, unknown>,
  schema: EvaluationSchema
): CompletenessResult {
  const validations = validateFields(data, schema.requiredFields);
  const filledRequired = validations.filter(v => v.filled).length;
  const totalRequired = validations.length;

  let filledOptional = 0;
  const totalOptional = schema.optionalFields?.length || 0;
  for (const field of schema.optionalFields || []) {
    if (isValueFilled(getNestedValue(data, field.path))) {
      filledOptional++;
    }
  }

  const completeness = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 100;

  return { completeness, filledRequired, totalRequired, filledOptional, totalOptional };
}

// ========================================
// Legacy helper (composes primitives)
// ========================================

/**
 * @deprecated Use validateFields + countConfidencesMet + calculateCompleteness instead
 */
function calculateBasicMetrics(
  results: Record<string, unknown>,
  schema: EvaluationSchema
): {
  filledRequired: number;
  totalRequired: number;
  filledOptional: number;
  totalOptional: number;
  confidenceIssues: string[];
} {
  const completenessResult = calculateCompleteness(results, schema);
  const confidenceResult = countConfidencesMet(results, schema);

  return {
    filledRequired: completenessResult.filledRequired,
    totalRequired: completenessResult.totalRequired,
    filledOptional: completenessResult.filledOptional,
    totalOptional: completenessResult.totalOptional,
    confidenceIssues: confidenceResult.issues,
  };
}

// ========================================
// Main Evaluation Function
// ========================================

/**
 * Evaluate Agent Results
 *
 * Uses AI to analyze results quality and suggest improvements.
 * @deprecated Use validateFields + countConfidencesMet + calculateCompleteness primitives
 * and let the agent handle quality judgment via LLM.
 */
export async function evaluateResults(
  results: Record<string, unknown>,
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
    const optionalBonus =
      schema.optionalFields?.reduce((sum, field) => {
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
      system: `Du bist ein Qualitätsprüfer für AI Agent Ergebnisse bei adesso SE.

## Deine Rolle
Analysiere Agent-Outputs auf Qualität und identifiziere Verbesserungspotenzial.
Deine Bewertung hilft, die Zuverlässigkeit der automatisierten Analyse sicherzustellen.

## Prüfkriterien

| Kriterium | Gewicht | Beschreibung |
|-----------|---------|--------------|
| Vollständigkeit | 40% | Sind alle Pflichtfelder ausgefüllt? |
| Plausibilität | 30% | Sind die Ergebnisse logisch konsistent? |
| Confidence | 20% | Sind die Confidence-Werte ≥70%? |
| Actionability | 10% | Sind die Ergebnisse handlungsrelevant? |

## Severity-Klassifikation

| Level | Wann verwenden |
|-------|----------------|
| critical | Fehlende Pflichtdaten, Inkonsistenzen |
| major | Niedrige Confidence, unvollständige Analyse |
| minor | Fehlende optionale Daten, Optimierungspotenzial |

## Kontext
${schema.context || 'Agent Results Evaluation'}

## Ausgabe
- Sei konstruktiv und lösungsorientiert
- Schlage konkrete Verbesserungen vor
- Alle Texte auf Deutsch`,
      prompt: `Bewerte diese Agent-Ergebnisse:

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

## Vorläufige Metriken
- Vollständigkeit: ${completeness}%
- Basis-Score: ${baseScore}
- Confidence-Probleme: ${metrics.confidenceIssues.join(', ') || 'Keine'}

## Schema-Definition
- Pflichtfelder: ${schema.requiredFields.map(f => f.description).join(', ')}
- Optionale Felder: ${schema.optionalFields?.map(f => f.description).join(', ') || 'Keine'}

Erstelle eine strukturierte Bewertung mit konkreten Verbesserungsvorschlägen.`,
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
 * @deprecated Use validateFields + calculateCompleteness primitives instead.
 */
export function quickEvaluate(
  results: Record<string, unknown>,
  schema: EvaluationSchema
): { score: number; issues: string[]; canImprove: boolean } {
  const fieldValidations = validateFields(results, schema.requiredFields);
  const { completeness } = calculateCompleteness(results, schema);
  const confidenceResult = countConfidencesMet(results, schema);

  const issues: string[] = [];

  // Missing required fields
  for (const v of fieldValidations) {
    if (!v.filled) {
      issues.push(`Missing: ${v.description}`);
    }
  }

  // Confidence issues
  issues.push(...confidenceResult.issues);

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
 * Evaluate QualificationScan Results
 * @deprecated Use primitives directly (validateFields, calculateCompleteness, countConfidencesMet)
 */
export async function evaluateQualificationScanResults(
  results: Record<string, unknown>,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  return evaluateResults(results, QUICKSCAN_EVALUATION_SCHEMA, {
    ...ctx,
    agentName: ctx.agentName || 'Qualification Scan Evaluator',
  });
}

/**
 * Evaluate CMS Matching Results
 * @deprecated Use primitives directly (validateFields, calculateCompleteness, countConfidencesMet)
 */
export async function evaluateCMSMatchingResults(
  results: Record<string, unknown>,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  return evaluateResults(results, CMS_MATCHING_EVALUATION_SCHEMA, {
    ...ctx,
    agentName: ctx.agentName || 'CMS Matching Evaluator',
  });
}

/**
 * Evaluate BIT Evaluation Results
 * @deprecated Use primitives directly (validateFields, calculateCompleteness, countConfidencesMet)
 */
export async function evaluateBITResults(
  results: Record<string, unknown>,
  ctx: EvaluatorContext = {}
): Promise<EvaluationResult> {
  return evaluateResults(results, BIT_EVALUATION_SCHEMA, {
    ...ctx,
    agentName: ctx.agentName || 'BIT Evaluator',
  });
}
