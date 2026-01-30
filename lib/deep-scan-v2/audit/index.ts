import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { auditResultsV2 } from '@/lib/db/schema';
import { detectTechStack } from './tech-detector';
import { auditPerformance } from './performance-auditor';
import { auditAccessibility } from './a11y-auditor';
import { analyzeComponents } from './component-analyzer';

export { detectTechStack } from './tech-detector';
export { auditPerformance } from './performance-auditor';
export { auditAccessibility } from './a11y-auditor';
export { analyzeComponents } from './component-analyzer';

export interface FullAuditResult {
  auditId: string;
  techStack: Awaited<ReturnType<typeof detectTechStack>>;
  performance: Awaited<ReturnType<typeof auditPerformance>>;
  accessibility: Awaited<ReturnType<typeof auditAccessibility>>;
  componentLibrary: Awaited<ReturnType<typeof analyzeComponents>>;
  performanceScore: number;
  accessibilityScore: number;
  complexityScore: number;
  migrationComplexity: 'low' | 'medium' | 'high' | 'very_high';
}

function deriveMigrationComplexity(
  componentCount: number,
  performanceScore: number
): {
  score: number;
  level: 'low' | 'medium' | 'high' | 'very_high';
} {
  // Components drive complexity; poor performance adds risk
  let score = Math.min(componentCount * 5, 80);
  if (performanceScore < 50) score += 10;
  if (performanceScore < 30) score += 10;
  score = Math.min(score, 100);

  const level = score <= 25 ? 'low' : score <= 50 ? 'medium' : score <= 75 ? 'high' : 'very_high';
  return { score, level };
}

export async function runFullAudit(params: {
  runId: string;
  qualificationId: string;
  websiteUrl: string;
}): Promise<FullAuditResult> {
  const startedAt = new Date();

  // Run all audit modules in parallel for speed
  const [techStack, performance, accessibility, componentLibrary] = await Promise.all([
    detectTechStack(params.websiteUrl),
    auditPerformance(params.websiteUrl),
    auditAccessibility(params.websiteUrl),
    analyzeComponents(params.websiteUrl),
  ]);

  const { score: complexityScore, level: migrationComplexity } = deriveMigrationComplexity(
    componentLibrary.components.length,
    performance.scores.overall
  );

  const auditId = createId();

  await db.insert(auditResultsV2).values({
    id: auditId,
    runId: params.runId,
    qualificationId: params.qualificationId,
    websiteUrl: params.websiteUrl,
    techStack: JSON.stringify(techStack),
    performance: JSON.stringify(performance),
    accessibility: JSON.stringify(accessibility),
    componentLibrary: JSON.stringify(componentLibrary),
    performanceScore: performance.scores.overall,
    accessibilityScore: accessibility.score,
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
    performanceScore: performance.scores.overall,
    accessibilityScore: accessibility.score,
    complexityScore,
    migrationComplexity,
  };
}
