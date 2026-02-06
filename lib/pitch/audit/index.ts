import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { pitchScanResults } from '@/lib/db/schema';
import type { TechStackResult } from './tech-detector';
import type { PerformanceResult } from './performance-auditor';
import type { AccessibilityResult } from './a11y-auditor';
import type { ComponentAnalysis } from '../types';
import { detectTechStack } from './tech-detector';
import { auditPerformance } from './performance-auditor';
import { auditAccessibility } from './a11y-auditor';
import { analyzeComponents } from './component-analyzer';
import { fetchHtml } from './fetch-html';
import { scoreComplexity, type ComplexityResult } from './complexity-scorer';

export { detectTechStack } from './tech-detector';
export { auditPerformance } from './performance-auditor';
export { auditAccessibility } from './a11y-auditor';
export { analyzeComponents } from './component-analyzer';
export { fetchHtml } from './fetch-html';
export { scoreComplexity } from './complexity-scorer';
export type { ComplexityResult } from './complexity-scorer';

export interface FullAuditResult {
  auditId: string;
  techStack: TechStackResult | null;
  performance: PerformanceResult | null;
  accessibility: AccessibilityResult | null;
  componentLibrary: ComponentAnalysis | null;
  performanceScore: number;
  accessibilityScore: number;
  complexityScore: number;
  migrationComplexity: 'low' | 'medium' | 'high' | 'very_high';
  complexityReasoning?: string;
  complexityFactors?: ComplexityResult['factors'];
  failedModules: string[];
}

export async function runFullAudit(params: {
  runId: string;
  pitchId: string;
  websiteUrl: string;
}): Promise<FullAuditResult> {
  const startedAt = new Date();

  // Fetch HTML once, pass to all modules
  const page = await fetchHtml(params.websiteUrl);

  // Run all audit modules in parallel; use allSettled for graceful partial failure
  const [techResult, perfResult, a11yResult, compResult] = await Promise.allSettled([
    detectTechStack(params.websiteUrl, page),
    auditPerformance(params.websiteUrl, page),
    auditAccessibility(params.websiteUrl, page),
    analyzeComponents(params.websiteUrl, page),
  ]);

  const techStack = techResult.status === 'fulfilled' ? techResult.value : null;
  const performance = perfResult.status === 'fulfilled' ? perfResult.value : null;
  const accessibility = a11yResult.status === 'fulfilled' ? a11yResult.value : null;
  const componentLibrary = compResult.status === 'fulfilled' ? compResult.value : null;

  const failedModules: string[] = [];
  if (techResult.status === 'rejected') {
    failedModules.push('tech-detection');
    console.error('[Audit] Tech detection failed:', techResult.reason);
  }
  if (perfResult.status === 'rejected') {
    failedModules.push('performance');
    console.error('[Audit] Performance audit failed:', perfResult.reason);
  }
  if (a11yResult.status === 'rejected') {
    failedModules.push('accessibility');
    console.error('[Audit] Accessibility audit failed:', a11yResult.reason);
  }
  if (compResult.status === 'rejected') {
    failedModules.push('component-analysis');
    console.error('[Audit] Component analysis failed:', compResult.reason);
  }

  const performanceScore = performance?.scores.overall ?? 0;
  const accessibilityScore = accessibility?.score ?? 0;

  // Use LLM-based complexity scoring with fallback
  const complexityResult = await scoreComplexity({
    componentCount: componentLibrary?.components.length ?? 0,
    performanceScore,
    accessibilityScore,
    techStack: techStack as Record<string, unknown> | null,
  });

  const complexityScore = complexityResult.score;
  const migrationComplexity = complexityResult.complexity;

  const auditId = createId();

  await db.insert(pitchScanResults).values({
    id: auditId,
    runId: params.runId,
    pitchId: params.pitchId,
    websiteUrl: params.websiteUrl,
    techStack: techStack ? JSON.stringify(techStack) : null,
    performance: performance ? JSON.stringify(performance) : null,
    accessibility: accessibility ? JSON.stringify(accessibility) : null,
    componentLibrary: componentLibrary ? JSON.stringify(componentLibrary) : null,
    performanceScore,
    accessibilityScore,
    complexityScore,
    migrationComplexity,
    startedAt,
    completedAt: new Date(),
  });

  return {
    auditId,
    techStack,
    performance,
    accessibility,
    componentLibrary,
    performanceScore,
    accessibilityScore,
    complexityScore,
    migrationComplexity,
    complexityReasoning: complexityResult.reasoning,
    complexityFactors: complexityResult.factors,
    failedModules,
  };
}
