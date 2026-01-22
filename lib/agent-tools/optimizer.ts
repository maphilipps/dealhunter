/**
 * Agent Results Optimizer
 *
 * Verbesserungslogik basierend auf Evaluator-Feedback.
 * Nutzt Intelligent Tools um fehlende Informationen zu recherchieren.
 *
 * Verwendung:
 * ```ts
 * const evaluation = await evaluateResults(results, schema);
 * if (evaluation.qualityScore < 80 && evaluation.canImprove) {
 *   const optimized = await optimizeResults(results, evaluation, tools);
 * }
 * ```
 */

import type { EvaluationResult, EvaluationIssue } from './evaluator';
import type { IntelligentTools } from './intelligent-tools';

import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

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

interface IssueHandler {
  areas: string[];
  handler: (
    results: Record<string, any>,
    issue: EvaluationIssue,
    tools: IntelligentTools,
    ctx: OptimizerContext
  ) => Promise<Record<string, any>>;
}

// ========================================
// Issue Handlers
// ========================================

/**
 * Handler für Tech Stack Issues
 */
async function handleTechStackIssue(
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
      message: `Verbessere Tech Stack: ${issue.description}`,
    },
  });

  // Try to improve CMS detection via GitHub
  if (results.techStack?.cms && !results.techStack?.cmsVersion) {
    const githubInfo = await tools.githubRepo(results.techStack.cms);
    if (githubInfo.latestVersion) {
      optimized.techStack = {
        ...optimized.techStack,
        cmsVersion: githubInfo.latestVersion,
        cmsVersionConfidence: 90,
        githubStars: githubInfo.githubStars,
        lastRelease: githubInfo.lastRelease,
      };
    }
  }

  // Try web search for tech stack verification
  if (results.websiteUrl) {
    const siteSearch = await tools.webSearch(
      `site:${new URL(results.websiteUrl).hostname} technology stack`
    );
    if (siteSearch.length > 0) {
      // Extract tech mentions from search results
      const techMentions = siteSearch.map(r => r.snippet).join(' ');

      // Common CMS patterns
      const cmsPatterns = [
        { name: 'WordPress', patterns: ['wordpress', 'wp-content', 'wp-includes'] },
        { name: 'Drupal', patterns: ['drupal', '/sites/default/', '/modules/'] },
        { name: 'TYPO3', patterns: ['typo3', 'typo3conf', 'typo3temp'] },
        { name: 'Joomla', patterns: ['joomla', '/components/', '/modules/'] },
        { name: 'Shopify', patterns: ['shopify', 'cdn.shopify.com'] },
        { name: 'Magento', patterns: ['magento', 'mage', '/skin/'] },
      ];

      for (const cms of cmsPatterns) {
        if (cms.patterns.some(p => techMentions.toLowerCase().includes(p))) {
          if (!optimized.techStack?.cms || optimized.techStack.cmsConfidence < 80) {
            optimized.techStack = {
              ...optimized.techStack,
              cms: cms.name,
              cmsConfidence: 75,
              detectedVia: 'web-search',
            };
            break;
          }
        }
      }
    }
  }

  return optimized;
}

/**
 * Handler für Company Info Issues
 */
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

  // Search for company information
  const companyName =
    results.companyIntelligence?.basicInfo?.name ||
    results.extractedRequirements?.customerName ||
    (results.websiteUrl ? new URL(results.websiteUrl).hostname.replace('www.', '') : null);

  if (companyName) {
    const searchResults = await tools.webSearch(
      `"${companyName}" company info employees revenue industry`
    );

    if (searchResults.length > 0) {
      const allText = searchResults
        .map(r => `${r.title} ${r.snippet}`)
        .join(' ')
        .toLowerCase();

      // Extract employee count patterns
      const employeePatterns = [
        /(\d{1,3}(?:,\d{3})*(?:\s*-\s*\d{1,3}(?:,\d{3})*)?)\s*(?:employees|mitarbeiter)/i,
        /(\d+)\+?\s*(?:employees|mitarbeiter)/i,
      ];

      for (const pattern of employeePatterns) {
        const match = allText.match(pattern);
        if (match) {
          optimized.companyIntelligence = {
            ...optimized.companyIntelligence,
            basicInfo: {
              ...optimized.companyIntelligence?.basicInfo,
              employeeCount: match[1],
            },
          };
          break;
        }
      }

      // Extract industry from search results
      const industries = [
        'IT',
        'Finance',
        'Healthcare',
        'Manufacturing',
        'Retail',
        'Education',
        'Media',
      ];
      for (const industry of industries) {
        if (allText.includes(industry.toLowerCase())) {
          optimized.companyIntelligence = {
            ...optimized.companyIntelligence,
            basicInfo: {
              ...optimized.companyIntelligence?.basicInfo,
              industry,
            },
          };
          break;
        }
      }
    }
  }

  return optimized;
}

/**
 * Handler für Content/Features Issues
 */
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

  // Crawl more pages if page count is low or features are missing
  if (results.websiteUrl) {
    const crawlResult = await tools.crawlSite(results.websiteUrl, { maxDepth: 2, maxPages: 30 });

    if (crawlResult.pages.length > 0) {
      // Analyze all pages for features
      const allText = crawlResult.pages
        .map(p => p.text || '')
        .join(' ')
        .toLowerCase();

      // Detect features
      const featurePatterns: Record<string, RegExp[]> = {
        ecommerce: [/warenkorb|cart|shop|produkt|kaufen|bestellen|checkout/i],
        userAccounts: [/login|anmelden|registrieren|mein konto|account|passwort/i],
        search: [/suche|search|durchsuchen/i],
        multiLanguage: [/lang=|hreflang|\/de\/|\/en\/|\/fr\/|sprache|language/i],
        blog: [/blog|news|aktuell|artikel|beitrag/i],
        forms: [/kontakt|contact|formular|form|anfrage/i],
        api: [/api|endpoint|rest|graphql/i],
      };

      optimized.features = { ...optimized.features };
      for (const [feature, patterns] of Object.entries(featurePatterns)) {
        if (patterns.some(p => p.test(allText))) {
          optimized.features[feature] = true;
        }
      }

      // Update page count
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

/**
 * Handler für Page Count Issues
 */
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
    // Try sitemap first
    const sitemapResult = await tools.fetchSitemap(results.websiteUrl);

    if (sitemapResult.found && sitemapResult.urls.length > 0) {
      optimized.contentVolume = {
        ...optimized.contentVolume,
        estimatedPageCount: sitemapResult.urls.length,
        sitemapFound: true,
        pageCountConfidence: 95,
      };
    } else {
      // Fallback to quick nav scan
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

/**
 * Handler für Confidence Issues
 */
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

  // Parse which field has low confidence
  const fieldMatch = issue.description.match(/^([^:]+):/);
  if (!fieldMatch) return optimized;

  const field = fieldMatch[1].toLowerCase();

  // Verify via additional sources
  if (field.includes('cms') && results.techStack?.cms) {
    // Double-check CMS via web search
    const searchResults = await tools.webSearch(
      `"${results.techStack.cms}" CMS latest version features`
    );

    if (searchResults.length > 0) {
      // Get GitHub info for authoritative version
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
    // BL recommendation confidence can be improved by verifying against more data
    // This would typically involve checking against internal BL capabilities
    // For now, we just note that verification was attempted
    optimized.blRecommendation = {
      ...optimized.blRecommendation,
      verificationAttempted: true,
    };
  }

  return optimized;
}

// ========================================
// Issue Handler Registry
// ========================================

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

/**
 * Find handler for an issue
 */
function findHandler(issue: EvaluationIssue): IssueHandler | undefined {
  const normalizedArea = issue.area.toLowerCase();
  return issueHandlers.find(h =>
    h.areas.some(a => normalizedArea.includes(a) || a.includes(normalizedArea))
  );
}

// ========================================
// Main Optimizer Function
// ========================================

/**
 * Optimize Agent Results
 *
 * Takes evaluation results and uses intelligent tools to improve data quality.
 * Runs iteratively until target score is reached or max iterations exceeded.
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

  // Filter to auto-fixable issues and sort by severity
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

      // Check if something actually changed
      if (JSON.stringify(improved) !== JSON.stringify(optimized)) {
        optimized = improved as T;
        iterations++;

        // Estimate score improvement based on severity
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
 * Quick optimization for a single area
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

// ========================================
// Specialized Optimizers
// ========================================

/**
 * Optimize QuickScan Results
 */
export async function optimizeQuickScanResults(
  results: Record<string, any>,
  evaluation: EvaluationResult,
  tools: IntelligentTools,
  ctx: OptimizerContext = {}
): Promise<OptimizationResult<Record<string, any>>> {
  return optimizeResults(results, evaluation, tools, {
    ...ctx,
    agentName: ctx.agentName || 'QuickScan Optimizer',
    targetScore: ctx.targetScore || 75,
  });
}

/**
 * Optimize CMS Matching Results
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
 * Full Evaluator-Optimizer Loop
 *
 * Convenience function that runs evaluation and optimization in one call.
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
