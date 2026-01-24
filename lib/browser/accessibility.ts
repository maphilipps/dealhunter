/**
 * Accessibility Audit via Lighthouse CLI
 * Alternative to @axe-core/playwright
 */

import { execa } from 'execa';
import { access, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import type { AccessibilityResult, AccessibilityViolation } from './types';

// ========================================
// Lighthouse CLI Integration
// ========================================

interface LighthouseAuditItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  details?: {
    items?: Array<{
      node?: { selector?: string };
    }>;
  };
}

interface LighthouseAccessibilityCategory {
  id: string;
  title: string;
  score: number;
  auditRefs: Array<{ id: string; weight: number }>;
}

interface LighthouseResult {
  categories: {
    accessibility: LighthouseAccessibilityCategory;
  };
  audits: Record<string, LighthouseAuditItem>;
}

/**
 * Map Lighthouse score to impact level
 */
function scoreToImpact(score: number | null): 'critical' | 'serious' | 'moderate' | 'minor' {
  if (score === null || score === 0) return 'critical';
  if (score < 0.5) return 'serious';
  if (score < 0.9) return 'moderate';
  return 'minor';
}

/**
 * Map accessibility score to WCAG level
 */
function scoreToLevel(score: number): 'A' | 'AA' | 'AAA' | 'fail' {
  if (score < 50) return 'fail';
  if (score < 70) return 'A';
  if (score < 90) return 'AA';
  return 'AAA';
}

/**
 * Run Lighthouse accessibility audit
 */
export async function runAccessibilityAudit(url: string): Promise<AccessibilityResult> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  const outputPath = join(tmpdir(), `lighthouse-a11y-${Date.now()}.json`);

  try {
    // Run Lighthouse CLI
    const { exitCode, stderr } = await execa(
      'npx',
      [
        'lighthouse',
        fullUrl,
        '--output=json',
        `--output-path=${outputPath}`,
        '--only-categories=accessibility',
        '--chrome-flags=--headless --no-sandbox --disable-setuid-sandbox',
        '--quiet',
      ],
      {
        timeout: 60000,
        reject: false,
      }
    );

    // Check if output file was created
    try {
      await access(outputPath);
    } catch {
      console.error('[Accessibility] Lighthouse did not create output file', { exitCode, stderr });
      return {
        score: 0,
        level: 'fail',
        violations: [
          {
            id: 'lighthouse-no-output',
            title: 'Lighthouse Audit konnte nicht ausgeführt werden',
            description: stderr || 'Output file was not created',
            impact: 'critical',
          },
        ],
        passes: 0,
        incomplete: 0,
      };
    }

    // Read and parse results
    const jsonContent = await readFile(outputPath, 'utf-8');
    const result: LighthouseResult = JSON.parse(jsonContent);

    // Clean up temp file
    await unlink(outputPath).catch(() => {});

    // Extract accessibility data
    const accessibilityCategory = result.categories?.accessibility;
    const score = Math.round((accessibilityCategory?.score || 0) * 100);

    // Extract violations (failed audits)
    const violations: AccessibilityViolation[] = [];
    let passes = 0;
    let incomplete = 0;

    for (const auditRef of accessibilityCategory?.auditRefs || []) {
      const audit = result.audits[auditRef.id];
      if (!audit) continue;

      if (audit.score === 1) {
        passes++;
      } else if (audit.score === null) {
        incomplete++;
      } else if (audit.score !== null && audit.score < 1) {
        violations.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          impact: scoreToImpact(audit.score),
          score: audit.score,
          helpUrl: `https://web.dev/articles/${audit.id}`,
        });
      }
    }

    return {
      score,
      level: scoreToLevel(score),
      violations,
      passes,
      incomplete,
    };
  } catch (error) {
    console.error('[Accessibility] Lighthouse audit failed:', error);

    // Clean up temp file on error
    await unlink(outputPath).catch(() => {});

    // Return default result
    return {
      score: 0,
      level: 'fail',
      violations: [
        {
          id: 'lighthouse-error',
          title: 'Lighthouse Audit Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          impact: 'critical',
        },
      ],
      passes: 0,
      incomplete: 0,
    };
  }
}

/**
 * Quick accessibility check using browser evaluate
 * Runs basic checks without full Lighthouse audit
 */
export async function quickAccessibilityCheck(
  evaluateFn: <T>(script: string) => Promise<T | null>
): Promise<{
  hasAltText: boolean;
  hasHeadings: boolean;
  hasLandmarks: boolean;
  hasLabels: boolean;
  issues: string[];
}> {
  const result = await evaluateFn<{
    imagesWithoutAlt: number;
    totalImages: number;
    h1Count: number;
    headingOrder: boolean;
    hasMain: boolean;
    hasNav: boolean;
    inputsWithoutLabel: number;
    totalInputs: number;
  }>(`
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(img => !img.alt).length;

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const h1Count = document.querySelectorAll('h1').length;

    // Check heading order
    let lastLevel = 0;
    let headingOrder = true;
    headings.forEach(h => {
      const level = parseInt(h.tagName[1]);
      if (level > lastLevel + 1) headingOrder = false;
      lastLevel = level;
    });

    const hasMain = document.querySelector('main, [role="main"]') !== null;
    const hasNav = document.querySelector('nav, [role="navigation"]') !== null;

    const inputs = document.querySelectorAll('input, select, textarea');
    const inputsWithoutLabel = Array.from(inputs).filter(input => {
      const id = input.id;
      if (!id) return true;
      return !document.querySelector('label[for="' + id + '"]');
    }).length;

    return {
      imagesWithoutAlt,
      totalImages: images.length,
      h1Count,
      headingOrder,
      hasMain,
      hasNav,
      inputsWithoutLabel,
      totalInputs: inputs.length
    };
  `);

  if (!result) {
    return {
      hasAltText: false,
      hasHeadings: false,
      hasLandmarks: false,
      hasLabels: false,
      issues: ['Could not evaluate page accessibility'],
    };
  }

  const issues: string[] = [];

  // Check images
  const hasAltText = result.imagesWithoutAlt === 0;
  if (!hasAltText) {
    issues.push(`${result.imagesWithoutAlt}/${result.totalImages} images missing alt text`);
  }

  // Check headings
  const hasHeadings = result.h1Count === 1 && result.headingOrder;
  if (result.h1Count === 0) {
    issues.push('Missing h1 heading');
  } else if (result.h1Count > 1) {
    issues.push(`Multiple h1 headings (${result.h1Count})`);
  }
  if (!result.headingOrder) {
    issues.push('Heading levels skip (e.g., h1 to h3)');
  }

  // Check landmarks
  const hasLandmarks = result.hasMain && result.hasNav;
  if (!result.hasMain) {
    issues.push('Missing main landmark');
  }
  if (!result.hasNav) {
    issues.push('Missing navigation landmark');
  }

  // Check labels
  const hasLabels = result.inputsWithoutLabel === 0;
  if (!hasLabels && result.totalInputs > 0) {
    issues.push(`${result.inputsWithoutLabel}/${result.totalInputs} inputs missing labels`);
  }

  return {
    hasAltText,
    hasHeadings,
    hasLandmarks,
    hasLabels,
    issues,
  };
}
