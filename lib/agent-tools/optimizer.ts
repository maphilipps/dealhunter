/**
 * Agent Results Optimizer
 *
 * Decomposed into pure primitives:
 * - Pattern matching: matchCMSPatterns, extractEmployeeCount, extractIndustry, detectFeatures
 * - Data gathering: use IntelligentTools directly (webSearch, githubRepo, crawlSite, etc.)
 * - Orchestration: agent's job — decide what tools to call and how to interpret results
 *
 * @deprecated The orchestration functions (optimizeResults, optimizeArea, etc.) are deprecated.
 * Use the primitives directly and let the agent orchestrate.
 */

import type { EvaluationResult, EvaluationIssue } from './evaluator';
import type { IntelligentTools, SearchResult } from './intelligent-tools';

import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/in-process/event-types';

// ========================================
// Types
// ========================================

export interface OptimizerContext {
  emit?: EventEmitter;
  agentName?: string;
  maxIterations?: number;
  targetScore?: number;
}

export interface OptimizationResult<T> {
  optimized: T;
  iterations: number;
  improvements: string[];
  finalScore: number;
}

// ========================================
// Primitive Types
// ========================================

export interface CMSMatch {
  name: string;
  matchedPattern: string;
}

export interface EmployeeExtraction {
  raw: string;
  source: 'pattern-match';
}

export interface FeatureDetection {
  feature: string;
  detected: boolean;
}

// ========================================
// Pattern-Matching Primitives (pure, no I/O, no side effects)
// ========================================

const CMS_PATTERNS = [
  { name: 'WordPress', patterns: ['wordpress', 'wp-content', 'wp-includes'] },
  { name: 'Drupal', patterns: ['drupal', '/sites/default/', '/modules/'] },
  { name: 'TYPO3', patterns: ['typo3', 'typo3conf', 'typo3temp'] },
  { name: 'Joomla', patterns: ['joomla', '/components/', '/modules/'] },
  { name: 'Shopify', patterns: ['shopify', 'cdn.shopify.com'] },
  { name: 'Magento', patterns: ['magento', 'mage', '/skin/'] },
] as const;

/**
 * Match CMS patterns against text content.
 * Pure function — no I/O, no event emission.
 * Agent calls webSearch/crawlSite to get text, then passes it here.
 */
export function matchCMSPatterns(text: string): CMSMatch | null {
  const lower = text.toLowerCase();
  for (const cms of CMS_PATTERNS) {
    const matched = cms.patterns.find(p => lower.includes(p));
    if (matched) {
      return { name: cms.name, matchedPattern: matched };
    }
  }
  return null;
}

const EMPLOYEE_PATTERNS = [
  /(\d{1,3}(?:,\d{3})*(?:\s*-\s*\d{1,3}(?:,\d{3})*)?)\s*(?:employees|mitarbeiter)/i,
  /(\d+)\+?\s*(?:employees|mitarbeiter)/i,
];

/**
 * Extract employee count from text.
 * Pure function — no I/O, no event emission.
 * Agent calls webSearch to get text, then passes it here.
 */
export function extractEmployeeCount(text: string): EmployeeExtraction | null {
  for (const pattern of EMPLOYEE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { raw: match[1], source: 'pattern-match' };
    }
  }
  return null;
}

const KNOWN_INDUSTRIES = [
  'IT',
  'Finance',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Education',
  'Media',
] as const;

/**
 * Extract industry from text by matching against known industries.
 * Pure function — no I/O, no event emission.
 * Agent calls webSearch to get text, then passes it here.
 */
export function extractIndustry(text: string): string | null {
  const lower = text.toLowerCase();
  for (const industry of KNOWN_INDUSTRIES) {
    if (lower.includes(industry.toLowerCase())) {
      return industry;
    }
  }
  return null;
}

const FEATURE_PATTERNS: Record<string, RegExp[]> = {
  ecommerce: [/warenkorb|cart|shop|produkt|kaufen|bestellen|checkout/i],
  userAccounts: [/login|anmelden|registrieren|mein konto|account|passwort/i],
  search: [/suche|search|durchsuchen/i],
  multiLanguage: [/lang=|hreflang|\/de\/|\/en\/|\/fr\/|sprache|language/i],
  blog: [/blog|news|aktuell|artikel|beitrag/i],
  forms: [/kontakt|contact|formular|form|anfrage/i],
  api: [/api|endpoint|rest|graphql/i],
};

/**
 * Detect website features from text content.
 * Pure function — no I/O, no event emission.
 * Agent calls crawlSite to get page text, then passes it here.
 */
export function detectFeatures(text: string): FeatureDetection[] {
  return Object.entries(FEATURE_PATTERNS).map(([feature, patterns]) => ({
    feature,
    detected: patterns.some(p => p.test(text)),
  }));
}

/**
 * Parse confidence field name from an issue description.
 * Pure function — extracts the field prefix before the first colon.
 */
export function parseConfidenceField(description: string): string | null {
  const match = description.match(/^([^:]+):/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Concatenate search result snippets into a single text block.
 * Utility for feeding search results into pattern-matching primitives.
 */
export function flattenSearchResults(results: SearchResult[], includeTitle = true): string {
  return results.map(r => (includeTitle ? `${r.title} ${r.snippet}` : r.snippet)).join(' ');
}

// ============================================================================
// DEPRECATED: Orchestration functions below
// Use primitives above + IntelligentTools directly. Agent orchestrates.
// ============================================================================

interface IssueHandler {
  areas: string[];
  handler: (
    results: Record<string, unknown>,
    issue: EvaluationIssue,
    tools: IntelligentTools,
    ctx: OptimizerContext
  ) => Promise<Record<string, unknown>>;
}

// Type for tech stack within results
interface TechStackField {
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  [key: string]: unknown;
}

async function handleTechStackIssue(
  results: Record<string, unknown>,
  issue: EvaluationIssue,
  tools: IntelligentTools,
  ctx: OptimizerContext
): Promise<Record<string, unknown>> {
  const optimized: Record<string, unknown> = { ...results };
  const techStack = results.techStack as TechStackField | undefined;

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Verbessere Tech Stack: ${issue.description}`,
    },
  });

  if (techStack?.cms && !techStack?.cmsVersion) {
    const githubInfo = await tools.githubRepo(techStack.cms);
    if (githubInfo.latestVersion) {
      optimized.techStack = {
        ...(optimized.techStack as object),
        cmsVersion: githubInfo.latestVersion,
        cmsVersionConfidence: 90,
        githubStars: githubInfo.githubStars,
        lastRelease: githubInfo.lastRelease,
      };
    }
  }

  const websiteUrl = results.websiteUrl as string | undefined;
  if (websiteUrl) {
    const siteSearch = await tools.webSearch(
      `site:${new URL(websiteUrl).hostname} technology stack`
    );
    if (siteSearch.length > 0) {
      const techMentions = flattenSearchResults(siteSearch, false);
      const cmsMatch = matchCMSPatterns(techMentions);

      const currentTechStack = optimized.techStack as TechStackField | undefined;
      if (cmsMatch && (!currentTechStack?.cms || (currentTechStack.cmsConfidence ?? 0) < 80)) {
        optimized.techStack = {
          ...(optimized.techStack as object),
          cms: cmsMatch.name,
          cmsConfidence: 75,
          detectedVia: 'web-search',
        };
      }
    }
  }

  return optimized;
}

async function handleCompanyIssue(
  results: Record<string, any>,
  issue: EvaluationIssue,
  tools: IntelligentTools,
  ctx: OptimizerContext
): Promise<Record<string, any>> {
  const optimized = { ...results };

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Verbessere Company Info: ${issue.description}`,
    },
  });

  const companyName =
    results.companyIntelligence?.basicInfo?.name ||
    results.extractedRequirements?.customerName ||
    (results.websiteUrl ? new URL(results.websiteUrl).hostname.replace('www.', '') : null);

  if (companyName) {
    const searchResults = await tools.webSearch(
      `"${companyName}" company info employees revenue industry`
    );

    if (searchResults.length > 0) {
      const allText = flattenSearchResults(searchResults);

      const employee = extractEmployeeCount(allText);
      if (employee) {
        optimized.companyIntelligence = {
          ...optimized.companyIntelligence,
          basicInfo: {
            ...optimized.companyIntelligence?.basicInfo,
            employeeCount: employee.raw,
          },
        };
      }

      const industry = extractIndustry(allText);
      if (industry) {
        optimized.companyIntelligence = {
          ...optimized.companyIntelligence,
          basicInfo: {
            ...optimized.companyIntelligence?.basicInfo,
            industry,
          },
        };
      }
    }
  }

  return optimized;
}

async function handleFeaturesIssue(
  results: Record<string, any>,
  issue: EvaluationIssue,
  tools: IntelligentTools,
  ctx: OptimizerContext
): Promise<Record<string, any>> {
  const optimized = { ...results };

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Verbessere Features: ${issue.description}`,
    },
  });

  if (results.websiteUrl) {
    const crawlResult = await tools.crawlSite(results.websiteUrl, { maxDepth: 2, maxPages: 30 });

    if (crawlResult.pages.length > 0) {
      const allText = crawlResult.pages.map(p => p.text || '').join(' ');

      const features = detectFeatures(allText);

      optimized.features = { ...optimized.features };
      for (const { feature, detected } of features) {
        if (detected) {
          optimized.features[feature] = true;
        }
      }

      optimized.contentVolume = {
        ...optimized.contentVolume,
        estimatedPageCount: Math.max(
          optimized.contentVolume?.estimatedPageCount || 0,
          crawlResult.totalUrls
        ),
      };
    }
  }

  return optimized;
}

async function handlePageCountIssue(
  results: Record<string, any>,
  issue: EvaluationIssue,
  tools: IntelligentTools,
  ctx: OptimizerContext
): Promise<Record<string, any>> {
  const optimized = { ...results };

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Verbessere Page Count: ${issue.description}`,
    },
  });

  if (results.websiteUrl) {
    const sitemapResult = await tools.fetchSitemap(results.websiteUrl);

    if (sitemapResult.found && sitemapResult.urls.length > 0) {
      optimized.contentVolume = {
        ...optimized.contentVolume,
        estimatedPageCount: sitemapResult.urls.length,
        sitemapFound: true,
        pageCountConfidence: 95,
      };
    } else {
      const navResult = await tools.quickNavScan(results.websiteUrl);
      optimized.contentVolume = {
        ...optimized.contentVolume,
        estimatedPageCount: navResult.estimatedPages,
        sitemapFound: false,
        pageCountConfidence: 60,
      };
    }
  }

  return optimized;
}

async function handleConfidenceIssue(
  results: Record<string, any>,
  issue: EvaluationIssue,
  tools: IntelligentTools,
  ctx: OptimizerContext
): Promise<Record<string, any>> {
  const optimized = { ...results };

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Verifiziere: ${issue.description}`,
    },
  });

  const field = parseConfidenceField(issue.description);
  if (!field) return optimized;

  if (field.includes('cms') && results.techStack?.cms) {
    const searchResults = await tools.webSearch(
      `"${results.techStack.cms}" CMS latest version features`
    );

    if (searchResults.length > 0) {
      const githubInfo = await tools.githubRepo(results.techStack.cms);

      if (githubInfo.latestVersion) {
        optimized.techStack = {
          ...optimized.techStack,
          cmsVersion: githubInfo.latestVersion,
          cmsConfidence: Math.min(100, (optimized.techStack.cmsConfidence || 50) + 20),
          verifiedVia: 'github',
        };
      }
    }
  }

  if (field.includes('bl') && results.blRecommendation) {
    optimized.blRecommendation = {
      ...optimized.blRecommendation,
      verificationAttempted: true,
    };
  }

  return optimized;
}

const issueHandlers: IssueHandler[] = [
  {
    areas: ['techStack', 'tech-stack', 'cms', 'technology'],
    handler: handleTechStackIssue,
  },
  {
    areas: ['company', 'companyIntelligence', 'company-info'],
    handler: handleCompanyIssue,
  },
  {
    areas: ['features', 'content', 'contentVolume'],
    handler: handleFeaturesIssue,
  },
  {
    areas: ['pageCount', 'page-count', 'pages'],
    handler: handlePageCountIssue,
  },
  {
    areas: ['confidence'],
    handler: handleConfidenceIssue,
  },
];

function findHandler(issue: EvaluationIssue): IssueHandler | undefined {
  const normalizedArea = issue.area.toLowerCase();
  return issueHandlers.find(h =>
    h.areas.some(a => normalizedArea.includes(a) || a.includes(normalizedArea))
  );
}

/**
 * @deprecated Use primitives (matchCMSPatterns, extractEmployeeCount, extractIndustry,
 * detectFeatures, parseConfidenceField, flattenSearchResults) + IntelligentTools directly.
 * Agent should orchestrate which tools to call and interpret results via LLM.
 */
export async function optimizeResults<T extends Record<string, any>>(
  results: T,
  evaluation: EvaluationResult,
  tools: IntelligentTools,
  ctx: OptimizerContext = {}
): Promise<OptimizationResult<T>> {
  const maxIterations = ctx.maxIterations ?? 3;
  const targetScore = ctx.targetScore ?? 80;

  let optimized = { ...results };
  let currentScore = evaluation.qualityScore;
  const improvements: string[] = [];
  let iterations = 0;

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Starte Optimierung (Score: ${currentScore}/100, Ziel: ${targetScore})`,
    },
  });

  const fixableIssues = evaluation.issues
    .filter(i => i.canAutoFix)
    .sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  for (const issue of fixableIssues) {
    if (iterations >= maxIterations) {
      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Optimizer',
          message: `Max Iterations erreicht (${maxIterations})`,
        },
      });
      break;
    }

    if (currentScore >= targetScore) {
      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Optimizer',
          message: `Ziel-Score erreicht (${currentScore}/${targetScore})`,
        },
      });
      break;
    }

    const handler = findHandler(issue);
    if (!handler) {
      continue;
    }

    try {
      const improved = await handler.handler(optimized, issue, tools, ctx);

      if (JSON.stringify(improved) !== JSON.stringify(optimized)) {
        optimized = improved as T;
        iterations++;

        const scoreBoost = issue.severity === 'critical' ? 15 : issue.severity === 'major' ? 10 : 5;
        currentScore = Math.min(100, currentScore + scoreBoost);

        improvements.push(`${issue.area}: ${issue.description}`);

        ctx.emit?.({
          type: AgentEventType.AGENT_PROGRESS,
          data: {
            agent: ctx.agentName || 'Optimizer',
            message: `Verbessert: ${issue.area} (Score: ~${currentScore})`,
          },
        });
      }
    } catch (error) {
      console.warn(`[Optimizer] Failed to handle issue ${issue.area}:`, error);
    }
  }

  ctx.emit?.({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: ctx.agentName || 'Optimizer',
      message: `Optimierung abgeschlossen: ${improvements.length} Verbesserungen, Score: ${currentScore}`,
      confidence: currentScore,
    },
  });

  return {
    optimized,
    iterations,
    improvements,
    finalScore: currentScore,
  };
}

/**
 * @deprecated Use primitives + IntelligentTools directly.
 */
export async function optimizeArea<T extends Record<string, any>>(
  results: T,
  area: string,
  tools: IntelligentTools,
  ctx: OptimizerContext = {}
): Promise<T> {
  const fakeIssue: EvaluationIssue = {
    area,
    severity: 'major',
    description: `Improve ${area}`,
    suggestion: '',
    canAutoFix: true,
  };

  const handler = findHandler(fakeIssue);
  if (!handler) {
    return results;
  }

  return handler.handler(results, fakeIssue, tools, ctx) as Promise<T>;
}

/**
 * @deprecated Use primitives + IntelligentTools directly.
 */
export async function optimizeQualificationScanResults(
  results: Record<string, any>,
  evaluation: EvaluationResult,
  tools: IntelligentTools,
  ctx: OptimizerContext = {}
): Promise<OptimizationResult<Record<string, any>>> {
  return optimizeResults(results, evaluation, tools, {
    ...ctx,
    agentName: ctx.agentName || 'QualificationScan Optimizer',
    targetScore: ctx.targetScore || 75,
  });
}

/**
 * @deprecated Use primitives + IntelligentTools directly.
 */
export async function optimizeCMSMatchingResults(
  results: Record<string, any>,
  evaluation: EvaluationResult,
  tools: IntelligentTools,
  ctx: OptimizerContext = {}
): Promise<OptimizationResult<Record<string, any>>> {
  return optimizeResults(results, evaluation, tools, {
    ...ctx,
    agentName: ctx.agentName || 'CMS Matching Optimizer',
    targetScore: ctx.targetScore || 80,
  });
}

/**
 * @deprecated Use primitives + IntelligentTools directly.
 */
export async function evaluateAndOptimize<T extends Record<string, any>>(
  results: T,
  evaluate: (results: T) => Promise<EvaluationResult>,
  tools: IntelligentTools,
  ctx: OptimizerContext = {}
): Promise<{
  results: T;
  evaluation: EvaluationResult;
  optimizationResult?: OptimizationResult<T>;
}> {
  const evaluation = await evaluate(results);

  if (evaluation.qualityScore >= (ctx.targetScore || 80) || !evaluation.canImprove) {
    return { results, evaluation };
  }

  const optimizationResult = await optimizeResults(results, evaluation, tools, ctx);

  return {
    results: optimizationResult.optimized,
    evaluation,
    optimizationResult,
  };
}
