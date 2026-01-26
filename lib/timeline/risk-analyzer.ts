import { calculateWorkingDays, addWorkingDays } from './agent';
import type { ProjectTimeline } from './schema';
import type { RiskAnalysis } from './schema';

/**
 * Risk Thresholds (in working days)
 *
 * Based on delta = Pre-Qualification_Deadline - AI_Estimate:
 * - HIGH: delta < -30 days (Pre-Qualification wants it >20% faster than realistic)
 * - MEDIUM: delta between -30 and 0 days (tight but potentially doable)
 * - LOW: delta > 0 days (sufficient buffer)
 */
const RISK_THRESHOLDS = {
  HIGH_THRESHOLD: -30, // More than 30 days short
  MEDIUM_THRESHOLD: 0, // Any negative delta up to 0
} as const;

/**
 * Analyze Timeline Risk
 *
 * Compares Pre-Qualification deadline with AI-generated timeline estimate
 * to determine if the deadline is realistic.
 *
 * @param rfpDeadline - Pre-Qualification deadline (ISO string or Date)
 * @param aiTimeline - AI-generated ProjectTimeline
 * @param projectStartDate - Optional project start date (defaults to today)
 * @returns RiskAnalysis with risk level, delta, and warnings
 */
export function analyzeTimelineRisk(
  rfpDeadline: string | Date | null | undefined,
  aiTimeline: ProjectTimeline,
  projectStartDate?: Date
): RiskAnalysis {
  // Handle missing Pre-Qualification deadline
  if (!rfpDeadline) {
    return {
      risk: 'LOW',
      deltaDays: 0,
      warning: 'Keine Pre-Qualification-Deadline angegeben - keine Risiko-Analyse möglich',
      rfpDeadline: null,
      aiEstimatedCompletion: null,
      isRealistic: true,
    };
  }

  // Parse dates
  const rfpDate = typeof rfpDeadline === 'string' ? new Date(rfpDeadline) : rfpDeadline;
  const startDate = projectStartDate || new Date();

  // Calculate AI estimated completion date
  const aiCompletionDate = addWorkingDays(startDate, aiTimeline.totalDays);

  // Calculate delta in working days (positive = buffer, negative = too tight)
  // If Pre-Qualification is before AI completion, delta is negative (bad)
  // If Pre-Qualification is after AI completion, delta is positive (good)
  let deltaDays: number;
  if (rfpDate < aiCompletionDate) {
    // Pre-Qualification deadline is BEFORE AI estimate → negative delta
    deltaDays = -calculateWorkingDays(rfpDate, aiCompletionDate);
  } else {
    // Pre-Qualification deadline is AFTER AI estimate → positive delta (buffer)
    deltaDays = calculateWorkingDays(aiCompletionDate, rfpDate);
  }

  // Determine risk level
  let risk: 'HIGH' | 'MEDIUM' | 'LOW';
  let warning: string;
  let isRealistic: boolean;

  if (deltaDays < RISK_THRESHOLDS.HIGH_THRESHOLD) {
    // HIGH RISK: Pre-Qualification deadline is >30 working days (6+ weeks) before AI estimate
    risk = 'HIGH';
    isRealistic = false;

    const shortfallWeeks = Math.abs(Math.round(deltaDays / 5));
    const rfpMonths = Math.round(calculateWorkingDays(startDate, rfpDate) / 20);
    const aiMonths = aiTimeline.totalMonths;

    warning = `Unrealistische Timeline! Pre-Qualification fordert ${rfpMonths} Monate, AI schätzt ${aiMonths} Monate. Das Projekt müsste ${shortfallWeeks} Wochen früher fertig sein als realistisch.`;
  } else if (deltaDays < RISK_THRESHOLDS.MEDIUM_THRESHOLD) {
    // MEDIUM RISK: Pre-Qualification deadline is 0-30 days before AI estimate
    risk = 'MEDIUM';
    isRealistic = false;

    const shortfallWeeks = Math.abs(Math.round(deltaDays / 5));
    warning = `Timeline knapp - ${shortfallWeeks} Wochen weniger Buffer als empfohlen. Projekt ist machbar, aber mit erhöhtem Risiko.`;
  } else {
    // LOW RISK: Pre-Qualification deadline is after AI estimate (has buffer)
    risk = 'LOW';
    isRealistic = true;

    const bufferWeeks = Math.round(deltaDays / 5);
    warning = `Pre-Qualification-Deadline realistisch - ${bufferWeeks} Wochen Buffer vorhanden.`;
  }

  return {
    risk,
    deltaDays,
    warning,
    rfpDeadline: rfpDate.toISOString(),
    aiEstimatedCompletion: aiCompletionDate.toISOString(),
    isRealistic,
  };
}

/**
 * Get Risk Badge Variant (for UI components)
 *
 * Maps risk level to ShadCN badge variant
 */
export function getRiskBadgeVariant(risk: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (risk) {
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'success';
  }
}

/**
 * Get Risk Icon (for UI components)
 *
 * Maps risk level to appropriate icon
 */
export function getRiskIcon(risk: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (risk) {
    case 'HIGH':
      return '🔴';
    case 'MEDIUM':
      return '🟡';
    case 'LOW':
      return '🟢';
  }
}

/**
 * Format Timeline Summary
 *
 * Formats PT and duration into human-readable format
 * e.g., "120 PT / 24 Wochen / 6 Monate"
 */
export function formatTimelineSummary(timeline: ProjectTimeline): string {
  return `${timeline.totalDays} Arbeitstage / ${timeline.totalWeeks} Wochen / ${timeline.totalMonths} Monate`;
}
