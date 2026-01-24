/**
 * Accessibility Auditor Agent
 * Uses Lighthouse CLI to audit WCAG 2.1 AA compliance
 * Expected duration: 10-14 minutes
 */

import { AccessibilityAuditSchema, type AccessibilityAudit } from '../schemas';

import { runAccessibilityAudit } from '@/lib/browser';


interface AggregatedViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  count: number;
  description: string;
  helpUrl: string;
}

export async function auditAccessibility(
  websiteUrl: string,
  sampleUrls: string[],
  onProgress?: (message: string) => void
): Promise<AccessibilityAudit> {
  onProgress?.('Starting accessibility audit with Lighthouse...');

  const allViolations: AggregatedViolation[] = [];

  // Audit up to 10 representative pages
  const pagesToAudit = sampleUrls.slice(0, 10);

  for (let i = 0; i < pagesToAudit.length; i++) {
    const url = pagesToAudit[i];
    onProgress?.(`Auditing page ${i + 1}/${pagesToAudit.length}: ${new URL(url).pathname}`);

    try {
      // Run Lighthouse accessibility audit
      const result = await runAccessibilityAudit(url);

      // Convert Lighthouse violations to our format
      for (const violation of result.violations) {
        allViolations.push({
          id: violation.id,
          impact: violation.impact,
          count: 1, // Lighthouse doesn't provide instance count
          description: violation.description,
          helpUrl: violation.helpUrl || `https://web.dev/articles/${violation.id}`,
        });
      }
    } catch (error) {
      console.warn(`Failed to audit page ${url}:`, error);
      // Continue with next page
    }
  }

  onProgress?.(`Audited ${pagesToAudit.length} pages, processing results...`);

  // Aggregate violations by ID and impact
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

  for (const violation of allViolations) {
    const existing = violationMap.get(violation.id);

    if (existing) {
      existing.count += violation.count;
    } else {
      violationMap.set(violation.id, {
        id: violation.id,
        impact: violation.impact,
        count: violation.count,
        description: violation.description,
        helpUrl: violation.helpUrl,
      });
    }
  }

  const violations = Array.from(violationMap.values());

  // Sort by impact severity (critical first)
  const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  violations.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  // Calculate overall score (0-100, where 100 = perfect)
  const criticalCount = violations.filter(v => v.impact === 'critical').length;
  const seriousCount = violations.filter(v => v.impact === 'serious').length;
  const moderateCount = violations.filter(v => v.impact === 'moderate').length;

  // Weighted scoring: critical = -20, serious = -10, moderate = -5
  const overallScore = Math.max(
    0,
    100 - (criticalCount * 20 + seriousCount * 10 + moderateCount * 5)
  );

  onProgress?.(`Accessibility audit complete: ${violations.length} unique violations found`);

  // Validate and return
  return AccessibilityAuditSchema.parse({
    wcagLevel: 'AA',
    overallScore,
    violations,
    pagesAudited: pagesToAudit.length,
    timestamp: new Date().toISOString(),
  });
}
