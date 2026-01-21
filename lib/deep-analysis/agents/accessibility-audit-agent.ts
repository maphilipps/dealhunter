/**
 * Accessibility Auditor Agent
 * Uses Playwright + axe-core to audit WCAG 2.1 AA compliance
 * Expected duration: 10-14 minutes
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { AccessibilityAuditSchema, type AccessibilityAudit } from '../schemas';

export async function auditAccessibility(
  websiteUrl: string,
  sampleUrls: string[],
  onProgress?: (message: string) => void
): Promise<AccessibilityAudit> {
  onProgress?.('Launching headless browser for accessibility audit...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Dealhunter-DeepAnalysis/1.0 (Accessibility Audit Bot)',
  });

  const allViolations: any[] = [];

  // Audit up to 10 representative pages
  const pagesToAudit = sampleUrls.slice(0, 10);

  try {
    for (let i = 0; i < pagesToAudit.length; i++) {
      const url = pagesToAudit[i];
      onProgress?.(`Auditing page ${i + 1}/${pagesToAudit.length}: ${new URL(url).pathname}`);

      try {
        const page = await context.newPage();

        // Set timeout for page load
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000, // 30 second timeout
        });

        // Run axe audit with WCAG 2.1 AA tags
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

        allViolations.push(...results.violations);

        await page.close();
      } catch (error) {
        console.warn(`Failed to audit page ${url}:`, error);
        // Continue with next page
      }
    }
  } finally {
    await browser.close();
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
      existing.count += violation.nodes.length;
    } else {
      violationMap.set(violation.id, {
        id: violation.id,
        impact: violation.impact as 'minor' | 'moderate' | 'serious' | 'critical',
        count: violation.nodes.length,
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
