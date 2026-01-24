/**
 * Accessibility Audit Agent
 *
 * Performs WCAG 2.1 AA compliance checks using Lighthouse CLI.
 * Analyzes sample pages from a website and provides:
 * - Accessibility score (0-100)
 * - WCAG violations categorized by impact
 * - Fix hours estimation
 * - Integration with websiteAudits table
 */

import { eq } from 'drizzle-orm';


import { db } from '../db';
import { websiteAudits } from '../db/schema';

import { runAccessibilityAudit } from '@/lib/browser';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccessibilityViolation {
  id: string; // e.g., 'color-contrast'
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  count: number;
  description: string;
  helpUrl: string;
}

export interface AccessibilityAuditResult {
  success: boolean;

  // WCAG Compliance
  wcagLevel: 'A' | 'AA' | 'AAA';
  accessibilityScore: number; // 0-100 (100 = perfect)

  // Violations
  violations: AccessibilityViolation[];
  issueCount: number;

  // Fix Estimation
  estimatedFixHours: number;

  // Metadata
  pagesAudited: number;
  analyzedAt: string;
  error?: string;
}

export interface AnalyzeAccessibilityInput {
  leadId: string;
  websiteUrl: string;
  sampleUrls: string[]; // From Full-Scan Agent
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run accessibility audit on sample pages
 *
 * Uses Lighthouse CLI to scan for WCAG 2.1 AA violations.
 * Results are automatically saved to websiteAudits table.
 *
 * @param input - Lead ID and sample URLs from Full-Scan Agent
 * @returns Accessibility audit results
 */
export async function analyzeAccessibility(
  input: AnalyzeAccessibilityInput
): Promise<AccessibilityAuditResult> {
  console.error(`[Accessibility Audit Agent] Starting analysis for ${input.websiteUrl}`);
  console.error(`[Accessibility Audit Agent] Sample URLs: ${input.sampleUrls.length} pages`);

  try {
    // Validate input
    if (!input.sampleUrls || input.sampleUrls.length === 0) {
      const errorResult: AccessibilityAuditResult = {
        success: false,
        wcagLevel: 'AA',
        accessibilityScore: 0,
        violations: [],
        issueCount: 0,
        estimatedFixHours: 0,
        pagesAudited: 0,
        analyzedAt: new Date().toISOString(),
        error: 'No sample URLs provided',
      };

      // Save error state to DB
      await saveToDatabase(input.leadId, errorResult, input.websiteUrl);
      return errorResult;
    }

    // Audit up to 10 representative pages using Lighthouse
    console.error('[Accessibility Audit Agent] Starting Lighthouse audits...');
    const pagesToAudit = input.sampleUrls.slice(0, 10);

    // Aggregate violations across all pages
    const violationMap = new Map<
      string,
      {
        id: string;
        impact: 'minor' | 'moderate' | 'serious' | 'critical';
        count: number;
        description: string;
        helpUrl: string;
      }
    >();

    for (let i = 0; i < pagesToAudit.length; i++) {
      const url = pagesToAudit[i];
      console.error(
        `[Accessibility Audit Agent] Auditing page ${i + 1}/${pagesToAudit.length}: ${url}`
      );

      try {
        // Run Lighthouse accessibility audit
        const result = await runAccessibilityAudit(url);

        // Aggregate violations
        for (const violation of result.violations) {
          const existing = violationMap.get(violation.id);

          if (existing) {
            existing.count += 1;
          } else {
            violationMap.set(violation.id, {
              id: violation.id,
              impact: violation.impact,
              count: 1,
              description: violation.description,
              helpUrl: violation.helpUrl || `https://web.dev/articles/${violation.id}`,
            });
          }
        }
      } catch (error) {
        console.warn(`[Accessibility Audit Agent] Failed to audit page ${url}:`, error);
        // Continue with next page
      }
    }

    console.error(`[Accessibility Audit Agent] Lighthouse audits complete. Processing results...`);

    const violations = Array.from(violationMap.values());

    // Sort by impact severity (critical first)
    const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    violations.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    // Calculate overall score (0-100, where 100 = perfect)
    const criticalCount = violations.filter(v => v.impact === 'critical').length;
    const seriousCount = violations.filter(v => v.impact === 'serious').length;
    const moderateCount = violations.filter(v => v.impact === 'moderate').length;
    const minorCount = violations.filter(v => v.impact === 'minor').length;

    // Weighted scoring: critical = -20, serious = -10, moderate = -5, minor = -2
    const accessibilityScore = Math.max(
      0,
      100 - (criticalCount * 20 + seriousCount * 10 + moderateCount * 5 + minorCount * 2)
    );

    // Calculate total issue count (instances across all violations)
    const issueCount = violations.reduce((sum, v) => sum + v.count, 0);

    // Estimate fix hours
    const estimatedFixHours = calculateFixHours(violations);

    console.error(
      `[Accessibility Audit Agent] Analysis complete: ${violations.length} unique violations, ${issueCount} total issues, score: ${accessibilityScore}/100`
    );

    const result: AccessibilityAuditResult = {
      success: true,
      wcagLevel: 'AA',
      accessibilityScore,
      violations,
      issueCount,
      estimatedFixHours,
      pagesAudited: pagesToAudit.length,
      analyzedAt: new Date().toISOString(),
    };

    // Save to database
    await saveToDatabase(input.leadId, result, input.websiteUrl);

    return result;
  } catch (error) {
    console.error('[Accessibility Audit Agent] Error:', error);

    const errorResult: AccessibilityAuditResult = {
      success: false,
      wcagLevel: 'AA',
      accessibilityScore: 0,
      violations: [],
      issueCount: 0,
      estimatedFixHours: 0,
      pagesAudited: 0,
      analyzedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    // Save error state to DB
    await saveToDatabase(input.leadId, errorResult, input.websiteUrl);
    return errorResult;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate estimated fix hours based on violations
 *
 * Uses industry-standard estimates:
 * - Critical: 4 hours per unique violation type
 * - Serious: 2 hours per unique violation type
 * - Moderate: 1 hour per unique violation type
 * - Minor: 0.5 hours per unique violation type
 *
 * Adds 20% buffer for testing and QA.
 */
function calculateFixHours(violations: AccessibilityViolation[]): number {
  const hoursPerImpact = {
    critical: 4,
    serious: 2,
    moderate: 1,
    minor: 0.5,
  };

  const baseHours = violations.reduce((sum, violation) => {
    return sum + hoursPerImpact[violation.impact];
  }, 0);

  // Add 20% buffer for testing/QA
  const totalHours = Math.ceil(baseHours * 1.2);

  return totalHours;
}

/**
 * Save accessibility audit results to websiteAudits table
 *
 * Updates existing audit record or creates new one if needed.
 */
async function saveToDatabase(
  leadId: string,
  result: AccessibilityAuditResult,
  websiteUrl: string
): Promise<void> {
  try {
    // Check if audit record exists
    const [existingAudit] = await db
      .select()
      .from(websiteAudits)
      .where(eq(websiteAudits.leadId, leadId))
      .limit(1);

    const auditData = {
      accessibilityScore: result.accessibilityScore,
      wcagLevel: result.wcagLevel,
      a11yViolations: JSON.stringify(result.violations),
      a11yIssueCount: result.issueCount,
      estimatedFixHours: result.estimatedFixHours,
      status: result.success ? ('completed' as const) : ('failed' as const),
      completedAt: result.success ? new Date() : null,
    };

    if (existingAudit) {
      // Update existing
      await db.update(websiteAudits).set(auditData).where(eq(websiteAudits.id, existingAudit.id));
      console.error(
        `[Accessibility Audit Agent] Updated websiteAudits record: ${existingAudit.id}`
      );
    } else {
      // Create new
      await db.insert(websiteAudits).values({
        leadId,
        websiteUrl,
        ...auditData,
        startedAt: new Date(),
      });
      console.error(
        `[Accessibility Audit Agent] Created new websiteAudits record for lead ${leadId}`
      );
    }
  } catch (error) {
    console.error('[Accessibility Audit Agent] Failed to save to database:', error);
    // Don't throw - we still want to return results even if DB save fails
  }
}
