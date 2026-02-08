import { generateStructuredOutput } from '@/lib/ai/config';

import wappalyzer from 'simple-wappalyzer';

import {
  techStackSchema,
  contentVolumeSchema,
  featuresSchema,
  blRecommendationSchema,
  accessibilityAuditSchema,
  screenshotsSchema,
  seoAuditSchema,
  legalComplianceSchema,
  performanceIndicatorsSchema,
  navigationStructureSchema,
  type TechStack,
  type ContentVolume,
  type Features,
  type BLRecommendation,
  type AccessibilityAudit,
  type Screenshots,
  type SEOAudit,
  type LegalCompliance,
  type PerformanceIndicators,
  type NavigationStructure,
  type CompanyIntelligence,
} from './schema';
// TODO: Restore when tech-stack module is complete
// import { runTechStackDetection } from '@/lib/tech-stack/agent';
interface TechStackDetectionInput {
  url: string;
  html?: string | null;
  headers?: Record<string, string>;
  wappalyzerResults?: Array<{
    name: string;
    categories: string[];
    version?: string;
    confidence: number;
  }>;
}

interface TechStackDetectionResult {
  technologies: Array<{ name: string; category: string; confidence: number }>;
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  framework?: string;
  frameworkVersion?: string;
  backend?: string[];
  hosting?: string;
  cdn?: string;
  server?: string;
  libraries?: string[];
  analytics?: string[];
  marketing?: string[];
  overallConfidence?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS UNITS SINGLETON CACHE
// Prevents multiple DB loads per session - loaded once, reused everywhere
// ═══════════════════════════════════════════════════════════════════════════════

type CachedBusinessUnit = { name: string; keywords: string[] };
let cachedBusinessUnits: CachedBusinessUnit[] | null = null;

/**
 * Get business units from cache or load from DB once
 * This is the ONLY way to get business units in the QualificationScan flow
 */
async function getBusinessUnitsOnce(): Promise<CachedBusinessUnit[]> {
  if (!cachedBusinessUnits) {
    try {
      const units = await db.select().from(businessUnitsTable);
      cachedBusinessUnits = units.map(unit => ({
        name: unit.name,
        keywords:
          typeof unit.keywords === 'string' ? JSON.parse(unit.keywords) : unit.keywords || [],
      }));
      console.log(
        `[QualificationScan] Business Units loaded from DB: ${cachedBusinessUnits.length}`
      );
    } catch (error) {
      console.error('[QualificationScan] Error loading business units from DB:', error);
      cachedBusinessUnits = [];
    }
  }
  return cachedBusinessUnits;
}

/**
 * Clear the business units cache (for testing or refresh)
 */
function clearBusinessUnitsCache(): void {
  cachedBusinessUnits = null;
}

// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Real tech stack detection using analyzePageTech from multi-page-analyzer
 * Combines Wappalyzer + HTML pattern detection for reliable CMS identification
 */
const runTechStackDetection = async (
  input: TechStackDetectionInput,
  _options?: { emit?: EventEmitter }
): Promise<TechStackDetectionResult> => {
  const technologies: Array<{ name: string; category: string; confidence: number }> = [];
  let cms: string | undefined;
  let cmsVersion: string | undefined;
  let cmsConfidence: number | undefined;
  let framework: string | undefined;
  let frameworkVersion: string | undefined;
  const backend: string[] = [];
  let hosting: string | undefined;
  let cdn: string | undefined;
  let server: string | undefined;
  const libraries: string[] = [];
  const analytics: string[] = [];
  const marketing: string[] = [];

  // Use Wappalyzer results if provided
  if (input.wappalyzerResults && input.wappalyzerResults.length > 0) {
    for (const tech of input.wappalyzerResults) {
      const category = tech.categories[0] || 'Other';
      technologies.push({
        name: tech.name,
        category,
        confidence: tech.confidence,
      });

      // Categorize technologies
      if (tech.categories.includes('CMS')) {
        if (!cms || tech.confidence > (cmsConfidence || 0)) {
          cms = tech.name;
          cmsVersion = tech.version;
          cmsConfidence = tech.confidence;
        }
      }

      if (
        tech.categories.some(c =>
          ['JavaScript frameworks', 'Frontend frameworks', 'Web frameworks'].includes(c)
        )
      ) {
        if (!framework || tech.confidence > 50) {
          framework = tech.name;
          frameworkVersion = tech.version;
        }
      }

      if (tech.categories.some(c => ['Programming languages', 'Web servers'].includes(c))) {
        backend.push(tech.name);
      }

      if (tech.categories.some(c => ['PaaS', 'Hosting', 'IaaS'].includes(c))) {
        hosting = hosting || tech.name;
      }

      if (tech.categories.includes('CDN')) {
        cdn = cdn || tech.name;
      }

      if (tech.categories.includes('Web servers')) {
        server = server || tech.name;
      }

      if (
        tech.categories.some(c =>
          ['JavaScript libraries', 'UI frameworks', 'CSS frameworks'].includes(c)
        )
      ) {
        libraries.push(tech.name);
      }

      if (tech.categories.some(c => ['Analytics', 'Tag managers', 'RUM'].includes(c))) {
        analytics.push(tech.name);
      }

      if (
        tech.categories.some(c =>
          [
            'Marketing automation',
            'Cookie compliance',
            'A/B testing',
            'Personalization',
            'Advertising',
            'Live chat',
          ].includes(c)
        )
      ) {
        marketing.push(tech.name);
      }
    }
  }

  // HTML Pattern detection for CMS (if no CMS found via Wappalyzer or low confidence)
  if (input.html && (!cms || (cmsConfidence || 0) < 70)) {
    const cmsPatterns = [
      {
        name: 'Drupal',
        patterns: [
          /Drupal\.settings/i,
          /drupal\.js/i,
          /\/sites\/default\/files\//i,
          /data-drupal/i,
          /X-Drupal-Cache/i,
          /generator.*Drupal/i,
        ],
        version: /Drupal\s*(\d+(\.\d+)?)/i,
      },
      {
        name: 'WordPress',
        patterns: [/wp-content/i, /wp-includes/i, /wp-json/i, /\/wp-admin\//i],
        version: /WordPress\s*(\d+(\.\d+)?(\.\d+)?)/i,
      },
      {
        name: 'TYPO3',
        patterns: [/typo3/i, /t3js/i, /\/typo3conf\//i, /\/typo3temp\//i, /generator.*TYPO3/i],
        version: /TYPO3\s*(CMS\s*)?(\d+(\.\d+)?)/i,
      },
      {
        name: 'Joomla',
        patterns: [/joomla/i, /\/media\/jui\//i, /\/components\/com_/i],
        version: /Joomla!\s*(\d+(\.\d+)?)/i,
      },
      { name: 'Contao', patterns: [/contao/i, /\/system\/modules\//i, /data-contao/i] },
      {
        name: 'Magento',
        patterns: [/Magento/i, /Mage\.Cookies/i, /\/skin\/frontend\//i],
        version: /Magento\/(\d+(\.\d+)?)/i,
      },
      { name: 'Shopify', patterns: [/Shopify\.shop/i, /cdn\.shopify/i, /shopify\.com/i] },
      { name: 'Sitecore', patterns: [/sitecore/i, /sc_mode/i, /\/sitecore\//i] },
      {
        name: 'Adobe Experience Manager',
        patterns: [/cq-wcm-edit/i, /\/content\/dam\//i, /Adobe Experience Manager/i],
      },
    ];

    const headersStr = JSON.stringify(input.headers || {});

    for (const cmsPattern of cmsPatterns) {
      let matchCount = 0;
      for (const pattern of cmsPattern.patterns) {
        if (pattern.test(input.html) || pattern.test(headersStr)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const patternConfidence = Math.min(95, 50 + matchCount * 15);

        // Only override if pattern detection has higher confidence
        if (!cms || patternConfidence > (cmsConfidence || 0)) {
          cms = cmsPattern.name;
          cmsConfidence = patternConfidence;

          // Try to extract version
          if (cmsPattern.version) {
            const versionMatch = input.html.match(cmsPattern.version);
            if (versionMatch) {
              cmsVersion = versionMatch[1] || versionMatch[2];
            }
          }

          technologies.push({
            name: cmsPattern.name,
            category: 'CMS',
            confidence: patternConfidence,
          });
        }
      }
    }
  }

  // Header-based detection
  if (input.headers) {
    if (input.headers['server'] && !server) {
      server = input.headers['server'];
      technologies.push({ name: server, category: 'Web servers', confidence: 100 });
    }

    if (input.headers['x-powered-by']) {
      const poweredBy = input.headers['x-powered-by'];
      backend.push(poweredBy);
      technologies.push({ name: poweredBy, category: 'Programming languages', confidence: 100 });
    }

    if (input.headers['x-generator']) {
      const generator = input.headers['x-generator'];
      if (!cms) {
        cms = generator;
        cmsConfidence = 90;
      }
      technologies.push({ name: generator, category: 'CMS', confidence: 90 });
    }
  }

  // Calculate overall confidence
  const confidenceValues = [cmsConfidence, ...technologies.map(t => t.confidence)].filter(
    (c): c is number => c !== undefined
  );
  const overallConfidence =
    confidenceValues.length > 0
      ? Math.round(confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length)
      : undefined;

  return {
    technologies,
    cms,
    cmsVersion,
    cmsConfidence,
    framework,
    frameworkVersion,
    backend: backend.length > 0 ? [...new Set(backend)] : undefined,
    hosting,
    cdn,
    server,
    libraries: libraries.length > 0 ? [...new Set(libraries)] : undefined,
    analytics: analytics.length > 0 ? [...new Set(analytics)] : undefined,
    marketing: marketing.length > 0 ? [...new Set(marketing)] : undefined,
    overallConfidence,
  };
};
// Multi-Page Analysis Tools - NEW
// QualificationScan 2.0 Tools - NEW
import type {
  ContentTypeDistribution,
  MigrationComplexity,
  DecisionMakersResearch,
} from './schema';
import { gatherCompanyIntelligence } from './tools/company-research';
import { extractComponents, type ExtractedComponents } from './tools/component-extractor';
import { classifyContentTypes, estimateContentTypesFromUrls } from './tools/content-classifier';
import { searchDecisionMakers } from './tools/decision-maker-research';
import { analyzeMigrationComplexity } from './tools/migration-analyzer';
import {
  fetchPages,
  analyzePageTech,
  aggregateTechResults,
  type PageData,
  type AggregatedTechResult,
} from './tools/multi-page-analyzer';
import { selectDiversePages, type SampledPages } from './tools/page-sampler';
import {
  runPlaywrightAudit,
  runHttpxTechDetection,
  detectEnhancedTechStack,
  fetchHtmlWithPlaywright,
  type PlaywrightAuditResult,
  type HttpxTechResult,
  type EnhancedTechStackResult,
} from './tools/playwright';

import { buildAgentContext, formatContextForPrompt } from '@/lib/agent-tools/context-builder';
// Intelligent Agent Framework - NEW
import { quickEvaluate } from '@/lib/agent-tools/evaluator';
import { createIntelligentTools, KNOWN_GITHUB_REPOS } from '@/lib/agent-tools/intelligent-tools';
import { optimizeQualificationScanResults } from '@/lib/agent-tools/optimizer';
import { db } from '@/lib/db';
import { businessUnits as businessUnitsTable } from '@/lib/db/schema';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import {
  AgentEventType,
  type QualificationScanPhase,
} from '@/lib/streaming/in-process/event-types';
import { validateUrlForFetch } from '@/lib/utils/url-validation';

async function callAI<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: any,
  contextSection?: string
): Promise<T> {
  const fullSystemPrompt = contextSection ? `${systemPrompt}\n\n${contextSection}` : systemPrompt;

  return generateStructuredOutput({
    schema,
    system: fullSystemPrompt,
    prompt: userPrompt,
  });
}

export interface QualificationScanInput {
  websiteUrl: string;
  extractedRequirements?: any;
  bidId?: string;
  userId?: string;
  /** Qualification ID for RAG write tools (enables agent-native output) */
  preQualificationId?: string;
  /**
   * Controls behavior of the QualificationScan agent in different workflows.
   * - qualification: only collect fields needed for Qualification pages; skip contact research.
   * - full: full quick scan behavior (default)
   */
  mode?: 'qualification' | 'full';
}

export interface QualificationScanResult {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  blRecommendation: BLRecommendation;
  // Enhanced audit fields
  navigationStructure?: NavigationStructure;
  accessibilityAudit?: AccessibilityAudit;
  seoAudit?: SEOAudit;
  legalCompliance?: LegalCompliance;
  performanceIndicators?: PerformanceIndicators;
  screenshots?: Screenshots;
  companyIntelligence?: CompanyIntelligence;
  // QualificationScan 2.0 fields - NEW
  contentTypes?: ContentTypeDistribution;
  migrationComplexity?: MigrationComplexity;
  decisionMakers?: DecisionMakersResearch;
  // Multi-Page Analysis fields - NEW
  extractedComponents?: ExtractedComponents;
  multiPageAnalysis?: {
    pagesAnalyzed: number;
    analyzedUrls: string[];
    pageCategories?: Record<string, string[]>;
    detectionMethod: 'multi-page' | 'single-page' | 'httpx-fallback' | 'wappalyzer';
    analysisTimestamp: string;
  };
  // Raw data for debugging/reprocessing
  rawScanData?: {
    wappalyzer?: any[];
    httpx?: any;
    playwright?: any;
    sitemapUrls?: string[];
    multiPageTech?: AggregatedTechResult;
  };
  // Activity tracking
  activityLog: Array<{
    timestamp: string;
    action: string;
    details?: string;
  }>;
}

interface WebsiteData {
  html: string;
  headers: Record<string, string>;
  url: string;
  wappalyzerResults: WappalyzerTechnology[];
  sitemapUrls: string[];
  sitemapFound: boolean;
  sitemapUrl?: string;
}

interface WappalyzerTechnology {
  name: string;
  categories: string[];
  version?: string;
  confidence: number;
  website?: string;
  icon?: string;
}

/**
 * Quick Scan Agent - Analyzes customer website for tech stack and content
 * Returns business line recommendation within 5 minutes
 */
export async function runQualificationScan(
  input: QualificationScanInput
): Promise<QualificationScanResult> {
  const activityLog: QualificationScanResult['activityLog'] = [];

  const logActivity = (action: string, details?: string) => {
    activityLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  };

  let contextSection: string | undefined;
  if (input.userId) {
    try {
      const context = await buildAgentContext(input.userId);
      contextSection = formatContextForPrompt(context);
    } catch {
      // Ignore context errors
    }
  }

  try {
    logActivity('Starting Quick Scan', `URL: ${input.websiteUrl}`);

    logActivity('Fetching website content, headers, and sitemap');
    const websiteData = await fetchWebsiteData(input.websiteUrl);

    if (!websiteData.html) {
      throw new Error('Failed to fetch website content');
    }

    logActivity('Running parallel analysis: tech stack, content volume, features, and loading BUs');
    const [techStack, contentVolume, features, cachedBusinessUnits] = await Promise.all([
      detectTechStack(websiteData),
      analyzeContentVolume(websiteData),
      detectFeatures(websiteData.html),
      getBusinessUnitsOnce(), // Singleton cache
    ]);

    logActivity('Generating business line recommendation');
    const blRecommendation = await recommendBusinessLine({
      techStack,
      contentVolume,
      features,
      extractedRequirements: input.extractedRequirements,
      contextSection,
      cachedBusinessUnits, // Use pre-loaded BUs
    });

    logActivity('Quick Scan completed successfully');

    return {
      techStack,
      contentVolume,
      features,
      blRecommendation,
      activityLog,
    };
  } catch (error) {
    logActivity('Quick Scan failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * URL reachability check result
 */
interface UrlCheckResult {
  reachable: boolean;
  finalUrl: string;
  suggestedUrl?: string;
  reason?: string;
  statusCode?: number;
  redirectChain?: string[];
}

/**
 * Check if a URL is reachable and suggest alternatives if not
 * - Follows redirects and captures the final URL
 * - Detects canonical URLs from HTML
 * - Provides clear error messages for unreachable URLs
 */
async function checkAndSuggestUrl(url: string): Promise<UrlCheckResult> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  // Validate URL format and security
  try {
    validateUrlForFetch(fullUrl);
  } catch (error) {
    return {
      reachable: false,
      finalUrl: fullUrl,
      reason: error instanceof Error ? error.message : 'Ungültiges URL-Format',
    };
  }

  const redirectChain: string[] = [fullUrl];

  try {
    // Quick HEAD request with redirect following disabled to capture chain
    const response = await fetch(fullUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout for quick check
    });

    // Capture final URL after redirects
    const finalUrl = response.url;
    if (finalUrl !== fullUrl) {
      redirectChain.push(finalUrl);
    }

    // Check status code
    if (response.ok) {
      // URL is reachable
      return {
        reachable: true,
        finalUrl,
        statusCode: response.status,
        redirectChain: redirectChain.length > 1 ? redirectChain : undefined,
        // Suggest the final URL if it differs from input
        suggestedUrl: finalUrl !== fullUrl ? finalUrl : undefined,
      };
    }

    // Handle specific error codes
    if (response.status === 404) {
      // Try common alternatives
      const alternatives = await tryUrlAlternatives(fullUrl);
      return {
        reachable: false,
        finalUrl,
        statusCode: 404,
        reason: 'Seite nicht gefunden (404)',
        suggestedUrl: alternatives,
        redirectChain,
      };
    }

    if (response.status === 403) {
      return {
        reachable: false,
        finalUrl,
        statusCode: 403,
        reason:
          'Zugriff verweigert (403) - Website blockiert möglicherweise automatisierte Zugriffe',
      };
    }

    if (response.status >= 500) {
      return {
        reachable: false,
        finalUrl,
        statusCode: response.status,
        reason: `Server-Fehler (${response.status}) - Website ist momentan nicht erreichbar`,
      };
    }

    return {
      reachable: false,
      finalUrl,
      statusCode: response.status,
      reason: `HTTP-Fehler ${response.status}`,
    };
  } catch (error) {
    // Network errors, DNS failures, timeouts
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

    // Try to provide helpful suggestions based on error type
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      // DNS resolution failed - domain doesn't exist
      const suggestedUrl = await tryUrlAlternatives(fullUrl);
      return {
        reachable: false,
        finalUrl: fullUrl,
        reason: 'Domain nicht gefunden - prüfen Sie die Schreibweise',
        suggestedUrl,
      };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        reachable: false,
        finalUrl: fullUrl,
        reason: 'Zeitüberschreitung - Website antwortet nicht',
      };
    }

    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        reachable: false,
        finalUrl: fullUrl,
        reason: 'Verbindung abgelehnt - Server nicht erreichbar',
      };
    }

    if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
      // Try HTTP if HTTPS fails
      if (fullUrl.startsWith('https://')) {
        const httpUrl = fullUrl.replace('https://', 'http://');
        return {
          reachable: false,
          finalUrl: fullUrl,
          reason: 'SSL/Zertifikatsfehler',
          suggestedUrl: httpUrl,
        };
      }
    }

    return {
      reachable: false,
      finalUrl: fullUrl,
      reason: `Verbindungsfehler: ${errorMessage}`,
    };
  }
}

/**
 * Try common URL alternatives when the original fails
 */
async function tryUrlAlternatives(originalUrl: string): Promise<string | undefined> {
  const url = new URL(originalUrl);
  const alternatives: string[] = [];

  // If path exists, try without it (homepage)
  if (url.pathname !== '/' && url.pathname !== '') {
    alternatives.push(`${url.protocol}//${url.host}/`);
  }

  // Try with/without www
  if (url.hostname.startsWith('www.')) {
    alternatives.push(`${url.protocol}//${url.hostname.replace('www.', '')}${url.pathname}`);
  } else {
    alternatives.push(`${url.protocol}//www.${url.hostname}${url.pathname}`);
  }

  // Try each alternative with a quick check
  for (const altUrl of alternatives) {
    try {
      const response = await fetch(altUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return response.url; // Return the final URL after redirects
      }
    } catch {
      // Continue to next alternative
    }
  }

  return undefined;
}

/**
 * Fetch all website data: HTML, headers, Wappalyzer analysis, sitemap
 */
async function fetchWebsiteData(url: string): Promise<WebsiteData> {
  // Ensure URL has protocol
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  // Validate URL to prevent SSRF attacks
  validateUrlForFetch(fullUrl);

  const result: WebsiteData = {
    html: '',
    headers: {},
    url: fullUrl,
    wappalyzerResults: [],
    sitemapUrls: [],
    sitemapFound: false,
    sitemapUrl: undefined,
  };

  try {
    // First try: Simple fetch (fast, works for most sites)
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5,de;q=0.3',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      result.html = await response.text();

      // Extract headers
      response.headers.forEach((value, key) => {
        result.headers[key.toLowerCase()] = value;
      });
    }
  } catch (error) {
    console.error('Simple fetch failed:', error);
  }

  // Fallback: Use Playwright for bot-protected sites
  if (!result.html || result.html.length < 500) {
    console.log('Simple fetch returned empty/minimal HTML, trying Playwright fallback...');
    try {
      const playwrightResult = await fetchHtmlWithPlaywright(fullUrl);
      if (playwrightResult.html && playwrightResult.html.length > result.html.length) {
        result.html = playwrightResult.html;
        result.headers = playwrightResult.headers;
        result.url = playwrightResult.finalUrl;
        console.log(
          'Playwright fallback successful, got',
          Math.round(result.html.length / 1024),
          'KB'
        );
      }
    } catch (playwrightError) {
      console.error('Playwright fallback also failed:', playwrightError);
    }
  }

  // Run Wappalyzer analysis
  if (result.html) {
    try {
      const wappalyzerResult = wappalyzer({
        url: fullUrl,
        html: result.html,
        headers: result.headers,
      });
      result.wappalyzerResults = Array.isArray(wappalyzerResult) ? wappalyzerResult : [];
    } catch (e) {
      console.error('Wappalyzer error:', e);
      result.wappalyzerResults = [];
    }
  }

  // Try to fetch sitemap
  try {
    const sitemapResult = await fetchSitemapUrls(fullUrl);
    result.sitemapUrls = sitemapResult.urls;
    result.sitemapFound = sitemapResult.found;
    result.sitemapUrl = sitemapResult.sitemapUrl;
  } catch (sitemapError) {
    console.error('Sitemap fetch error:', sitemapError);
  }

  return result;
}

interface SitemapResult {
  urls: string[];
  found: boolean;
  sitemapUrl?: string;
}

/**
 * Fetch and parse sitemap.xml for URL count
 */
async function fetchSitemapUrls(baseUrl: string): Promise<SitemapResult> {
  const urls: string[] = [];
  const sitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap/sitemap.xml',
    '/page-sitemap.xml',
  ];
  let foundSitemapUrl: string | undefined;

  for (const path of sitemapPaths) {
    try {
      const sitemapUrl = new URL(path, baseUrl).toString();
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealhunterBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        foundSitemapUrl = sitemapUrl;
        const xml = await response.text();

        // Extract URLs from sitemap
        const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/gi) || [];
        for (const match of urlMatches) {
          const urlContent = match.replace(/<\/?loc>/gi, '');
          // Check if it's another sitemap or a page URL
          if (urlContent.includes('sitemap') && urlContent.endsWith('.xml')) {
            // It's a sitemap index, fetch nested sitemap
            try {
              const nestedResponse = await fetch(urlContent, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealhunterBot/1.0)' },
                signal: AbortSignal.timeout(5000),
              });
              if (nestedResponse.ok) {
                const nestedXml = await nestedResponse.text();
                const nestedUrls = nestedXml.match(/<loc>([^<]+)<\/loc>/gi) || [];
                urls.push(...nestedUrls.map(m => m.replace(/<\/?loc>/gi, '')));
              }
            } catch {
              // Ignore nested sitemap errors
            }
          } else {
            urls.push(urlContent);
          }
        }

        if (urls.length > 0) break; // Found sitemap with URLs
      }
    } catch {
      // Continue to next sitemap path
    }
  }

  return {
    urls: urls.slice(0, 5000), // Increased limit for better accuracy
    found: foundSitemapUrl !== undefined,
    sitemapUrl: foundSitemapUrl,
  };
}

/**
 * Detect tech stack using Wappalyzer results and AI analysis
 */
async function detectTechStack(data: WebsiteData, emit?: EventEmitter): Promise<TechStack> {
  const techStackResult = await runTechStackDetection(
    {
      url: data.url,
      html: data.html,
      headers: data.headers,
      wappalyzerResults: data.wappalyzerResults.map(t => ({
        name: t.name,
        categories: t.categories,
        version: t.version,
        confidence: t.confidence,
      })),
    },
    { emit }
  );

  const techByCategory: Record<string, WappalyzerTechnology[]> = {};
  for (const tech of data.wappalyzerResults) {
    for (const cat of tech.categories) {
      if (!techByCategory[cat]) techByCategory[cat] = [];
      techByCategory[cat].push(tech);
    }
  }

  const backend = (techByCategory['Programming languages'] || [])
    .concat(techByCategory['Web servers'] || [])
    .map(t => t.name);

  const hosting = (techByCategory['PaaS'] || [])
    .concat(techByCategory['Hosting'] || [])
    .concat(techByCategory['IaaS'] || [])
    .map(t => t.name)[0];

  const cdn = (techByCategory['CDN'] || []).map(t => t.name)[0];
  const server =
    data.headers['server'] || (techByCategory['Web servers'] || []).map(t => t.name)[0];

  const libraries = (techByCategory['JavaScript libraries'] || [])
    .concat(techByCategory['UI frameworks'] || [])
    .concat(techByCategory['JavaScript frameworks'] || [])
    .map(t => t.name);

  const analytics = (techByCategory['Analytics'] || [])
    .concat(techByCategory['Tag managers'] || [])
    .concat(techByCategory['RUM'] || [])
    .map(t => t.name);

  const marketing = (techByCategory['Marketing automation'] || [])
    .concat(techByCategory['Cookie compliance'] || [])
    .concat(techByCategory['A/B testing'] || [])
    .concat(techByCategory['Personalization'] || [])
    .concat(techByCategory['Advertising'] || [])
    .concat(techByCategory['Live chat'] || [])
    .map(t => t.name);

  return techStackSchema.parse({
    cms: techStackResult.cms,
    cmsVersion: techStackResult.cmsVersion,
    cmsConfidence: techStackResult.cmsConfidence,
    framework: techStackResult.framework,
    frameworkVersion: techStackResult.frameworkVersion,
    backend: techStackResult.backend?.length
      ? techStackResult.backend
      : backend.length > 0
        ? backend
        : undefined,
    hosting: techStackResult.hosting ?? hosting,
    cdn: techStackResult.cdn ?? cdn,
    server: techStackResult.server ?? server,
    libraries: techStackResult.libraries?.length
      ? techStackResult.libraries
      : libraries.length > 0
        ? libraries
        : undefined,
    analytics: techStackResult.analytics?.length
      ? techStackResult.analytics
      : analytics.length > 0
        ? analytics
        : undefined,
    marketing: techStackResult.marketing?.length
      ? techStackResult.marketing
      : marketing.length > 0
        ? marketing
        : undefined,
    overallConfidence:
      techStackResult.overallConfidence ??
      Math.round(
        data.wappalyzerResults.reduce((sum, t) => sum + t.confidence, 0) /
          Math.max(data.wappalyzerResults.length, 1)
      ),
  });
}

/**
 * AI fallback for tech stack detection - robust version with comprehensive analysis
 */
async function detectTechStackWithAI(
  html: string,
  url: string,
  headers: Record<string, string>
): Promise<TechStack> {
  const htmlSnippet = extractTechIndicators(html);
  const headerInfo = Object.entries(headers)
    .filter(([k]) =>
      [
        'server',
        'x-powered-by',
        'x-generator',
        'x-drupal-cache',
        'x-wordpress',
        'x-aspnet',
        'x-frame',
      ].some(h => k.toLowerCase().includes(h))
    )
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  // Additional HTML-based detection
  const htmlPatterns = extractDetailedPatterns(html);

  const systemPrompt = `Du bist ein Experte für Website-Technologie-Analyse. Analysiere IMMER gründlich und gib eine umfassende Bewertung ab, auch wenn die Indizien begrenzt sind. Antworte immer mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Du MUSST immer eine Einschätzung abgeben, basierend auf:
- HTML-Struktur und Kommentare
- CSS-Klassen und Naming Conventions
- JavaScript-Dateien und Libraries
- Meta-Tags und Generatoren
- URL-Patterns und Asset-Pfade`;

  const userPrompt = `Analysiere diese Website und erkenne den Technology Stack.

URL: ${url}

HTTP Headers:
${headerInfo || 'Keine relevanten Headers gefunden'}

HTML-Indikatoren:
${htmlSnippet}

Erkannte Patterns:
${htmlPatterns}

ANALYSE-AUFGABEN:
1. CMS-Erkennung: Suche nach typischen Pfaden wie /wp-content/, /sites/default/, /typo3/, etc.
2. Framework-Erkennung: Prüfe auf React (__NEXT_DATA__, data-reactroot), Vue (v-app, __VUE__), Angular (ng-version)
3. Backend: Erkenne PHP (.php URLs), ASP.NET (.aspx), Java/Kotlin Patterns
4. Hosting: Prüfe auf AWS, Azure, Google Cloud, Vercel, Netlify Signaturen
5. Libraries: jQuery, Bootstrap, Tailwind, Font Awesome, etc.
6. Analytics: Google Analytics, Matomo, Adobe Analytics
7. Marketing: HubSpot, Salesforce, Marketo

WICHTIG: Wenn du keine eindeutigen Indikatoren findest, schätze basierend auf:
- Modernen HTML5-Patterns → wahrscheinlich custom/headless
- Bootstrap-Klassen → wahrscheinlich PHP/WordPress oder Custom
- Professionelles Design → wahrscheinlich CMS-basiert

Antworte mit JSON:
- cms (string, optional): Erkanntes CMS (WordPress, Drupal, Typo3, Joomla, Sitecore, Adobe AEM, Custom, etc.)
- cmsVersion (string, optional): CMS-Version falls erkennbar
- cmsConfidence (number 0-100): Confidence in CMS-Erkennung (IMMER angeben, auch bei niedriger Confidence!)
- framework (string, optional): Frontend-Framework
- frameworkVersion (string, optional): Framework-Version
- backend (array of strings): Backend-Technologien (PHP, Node.js, Java, .NET, Python, etc.)
- hosting (string, optional): Hosting-Anbieter
- cdn (string, optional): CDN-Anbieter
- server (string, optional): Web-Server
- libraries (array of strings): JavaScript Libraries (Bootstrap, jQuery, React, etc.)
- analytics (array of strings): Analytics-Tools
- marketing (array of strings): Marketing-Tools
- overallConfidence (number 0-100): Gesamt-Confidence (MUSS immer angegeben werden!)`;

  return callAI<TechStack>(systemPrompt, userPrompt, techStackSchema);
}

/**
 * Extract detailed patterns from HTML for better AI analysis
 */
function extractDetailedPatterns(html: string): string {
  const patterns: string[] = [];

  // CMS-specific patterns
  const cmsPatterns = {
    WordPress: ['/wp-content/', '/wp-includes/', 'wp-json', 'wordpress'],
    Drupal: ['/sites/default/', '/modules/', '/themes/', 'drupal', 'Drupal.'],
    Typo3: ['/typo3/', '/fileadmin/', 'TYPO3'],
    Joomla: ['/components/', '/modules/', '/templates/', 'joomla'],
    Sitecore: ['/sitecore/', '/-/media/', 'scItemId'],
    'Adobe AEM': ['/content/dam/', '/etc/designs/', 'cq:', 'granite'],
    Contentful: ['contentful', 'ctfl'],
    Strapi: ['strapi'],
    Sanity: ['sanity.io', 'cdn.sanity.io'],
  };

  for (const [cms, indicators] of Object.entries(cmsPatterns)) {
    const found = indicators.filter(i => html.toLowerCase().includes(i.toLowerCase()));
    if (found.length > 0) {
      patterns.push(`${cms}-Indikatoren: ${found.join(', ')}`);
    }
  }

  // Framework patterns
  const frameworkPatterns = {
    'Next.js': ['__NEXT_DATA__', '_next/static', 'next/dist'],
    React: ['data-reactroot', 'react-dom', '__REACT_DEVTOOLS'],
    'Vue.js': ['__VUE__', 'v-cloak', 'data-v-'],
    Angular: ['ng-version', 'ng-app', '_ngcontent'],
    'Nuxt.js': ['__NUXT__', '_nuxt/'],
    Gatsby: ['gatsby-', '__gatsby'],
    Svelte: ['__svelte'],
  };

  for (const [framework, indicators] of Object.entries(frameworkPatterns)) {
    const found = indicators.filter(i => html.includes(i));
    if (found.length > 0) {
      patterns.push(`${framework}-Indikatoren: ${found.join(', ')}`);
    }
  }

  // CSS Framework patterns
  if (html.includes('bootstrap') || /class="[^"]*\b(container|row|col-)\b/.test(html)) {
    patterns.push('Bootstrap CSS Framework erkannt');
  }
  if (html.includes('tailwind') || /class="[^"]*\b(flex|grid|p-\d|m-\d|text-)\b/.test(html)) {
    patterns.push('Tailwind CSS Framework erkannt');
  }

  // Common libraries
  const libraryPatterns = [
    ['jQuery', ['jquery', 'jQuery']],
    ['Lodash', ['lodash', '_\\.']],
    ['Axios', ['axios']],
    ['Font Awesome', ['font-awesome', 'fontawesome', 'fa-']],
    ['Google Fonts', ['fonts.googleapis.com', 'fonts.gstatic.com']],
  ] as const;

  const foundLibs: string[] = [];
  for (const [name, indicators] of libraryPatterns) {
    if (indicators.some(i => html.toLowerCase().includes(i.toLowerCase()))) {
      foundLibs.push(name);
    }
  }
  if (foundLibs.length > 0) {
    patterns.push(`Libraries gefunden: ${foundLibs.join(', ')}`);
  }

  // Analytics
  const analyticsPatterns = [
    ['Google Analytics', ['google-analytics', 'ga.js', 'gtag', 'UA-', 'G-']],
    ['Google Tag Manager', ['googletagmanager', 'GTM-']],
    ['Matomo/Piwik', ['matomo', 'piwik']],
    ['Adobe Analytics', ['omniture', 's_code', 'AppMeasurement']],
    ['Hotjar', ['hotjar', 'hj(']],
  ] as const;

  const foundAnalytics: string[] = [];
  for (const [name, indicators] of analyticsPatterns) {
    if (indicators.some(i => html.includes(i))) {
      foundAnalytics.push(name);
    }
  }
  if (foundAnalytics.length > 0) {
    patterns.push(`Analytics gefunden: ${foundAnalytics.join(', ')}`);
  }

  return (
    patterns.join('\n') ||
    'Keine spezifischen Patterns erkannt - Analyse basiert auf allgemeinen HTML-Strukturen'
  );
}

/**
 * Analyze content volume using sitemap and HTML analysis
 */
async function analyzeContentVolume(data: WebsiteData): Promise<ContentVolume> {
  // Use sitemap URL count if available (this is the actual count)
  const actualPageCount = data.sitemapFound ? data.sitemapUrls.length : undefined;

  // Estimate from HTML as fallback
  const htmlEstimate = estimatePageCountFromHTML(data.html);

  // The estimated count is either from sitemap or HTML analysis
  const estimatedPageCount = actualPageCount ?? htmlEstimate;

  // Analyze content types from sitemap URLs
  const contentTypes = analyzeContentTypesFromUrls(data.sitemapUrls);

  // Detect languages
  const languages = detectLanguages(data.html, data.sitemapUrls);

  // Estimate complexity
  const complexity = estimateComplexity(
    estimatedPageCount,
    data.wappalyzerResults.length,
    data.html
  );

  // Count media assets in HTML
  const mediaAssets = countMediaAssets(data.html);

  return contentVolumeSchema.parse({
    actualPageCount,
    estimatedPageCount,
    sitemapFound: data.sitemapFound,
    sitemapUrl: data.sitemapUrl,
    contentTypes: contentTypes.length > 0 ? contentTypes : undefined,
    mediaAssets,
    languages: languages.length > 0 ? languages : undefined,
    complexity,
  });
}

/**
 * Estimate page count from HTML navigation
 */
function estimatePageCountFromHTML(html: string): number {
  // Count unique internal links
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links = new Set<string>();

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    // Only count internal links (relative or same domain)
    if (href.startsWith('/') || href.startsWith('#') || !href.includes('://')) {
      links.add(href.split('#')[0].split('?')[0]); // Remove fragments and query params
    }
  }

  return Math.max(links.size, 1);
}

/**
 * Analyze content types from sitemap URLs
 */
function analyzeContentTypesFromUrls(urls: string[]): Array<{ type: string; count: number }> {
  const types: Record<string, number> = {};

  for (const url of urls) {
    const path = url.toLowerCase();

    if (path.includes('/blog') || path.includes('/news') || path.includes('/artikel')) {
      types['Blog/News'] = (types['Blog/News'] || 0) + 1;
    } else if (path.includes('/product') || path.includes('/shop') || path.includes('/produkt')) {
      types['Products'] = (types['Products'] || 0) + 1;
    } else if (path.includes('/service') || path.includes('/leistung')) {
      types['Services'] = (types['Services'] || 0) + 1;
    } else if (path.includes('/team') || path.includes('/about') || path.includes('/ueber')) {
      types['About/Team'] = (types['About/Team'] || 0) + 1;
    } else if (path.includes('/contact') || path.includes('/kontakt')) {
      types['Contact'] = (types['Contact'] || 0) + 1;
    } else {
      types['Pages'] = (types['Pages'] || 0) + 1;
    }
  }

  return Object.entries(types)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Detect languages from HTML and URLs
 */
function detectLanguages(html: string, urls: string[]): string[] {
  const languages = new Set<string>();

  // Check HTML lang attribute
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (langMatch) {
    languages.add(langMatch[1].split('-')[0].toUpperCase());
  }

  // Check for language patterns in URLs
  const langPatterns = [
    '/en/',
    '/de/',
    '/fr/',
    '/es/',
    '/it/',
    '/nl/',
    '/ar/',
    '/zh/',
    '/ja/',
    '/ko/',
  ];
  for (const url of urls) {
    for (const pattern of langPatterns) {
      if (url.includes(pattern)) {
        languages.add(pattern.replace(/\//g, '').toUpperCase());
      }
    }
  }

  // Check for hreflang tags
  const hreflangRegex = /hreflang=["']([^"']+)["']/gi;
  let match;
  while ((match = hreflangRegex.exec(html)) !== null) {
    const lang = match[1].split('-')[0].toUpperCase();
    if (lang !== 'X-DEFAULT') {
      languages.add(lang);
    }
  }

  return Array.from(languages);
}

/**
 * Estimate site complexity
 */
function estimateComplexity(
  pageCount: number,
  techCount: number,
  html: string
): 'low' | 'medium' | 'high' {
  // Check for complex features
  const hasEcommerce = /cart|checkout|shop|warenkorb|kasse/i.test(html);
  const hasLogin = /login|signin|sign-in|anmelden/i.test(html);
  const hasApi = /api\.|\/api\/|graphql/i.test(html);

  let complexityScore = 0;

  // Page count contribution
  if (pageCount > 500) complexityScore += 3;
  else if (pageCount > 100) complexityScore += 2;
  else if (pageCount > 20) complexityScore += 1;

  // Tech stack contribution
  if (techCount > 15) complexityScore += 2;
  else if (techCount > 8) complexityScore += 1;

  // Feature contribution
  if (hasEcommerce) complexityScore += 2;
  if (hasLogin) complexityScore += 1;
  if (hasApi) complexityScore += 1;

  if (complexityScore >= 5) return 'high';
  if (complexityScore >= 2) return 'medium';
  return 'low';
}

/**
 * Count media assets in HTML
 */
function countMediaAssets(html: string): { images: number; videos: number; documents: number } {
  const images = (html.match(/<img[^>]+>/gi) || []).length;
  const videos = (html.match(/<video[^>]+>|youtube|vimeo|\.mp4|\.webm/gi) || []).length;
  const documents = (html.match(/\.pdf|\.doc|\.xls|\.ppt/gi) || []).length;

  return { images, videos, documents };
}

/**
 * Extract internal links from HTML for link discovery fallback
 * Used when sitemap is not available or has few URLs
 */
function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();

  try {
    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname.replace(/^www\./, '');
    const baseOrigin = baseUrlObj.origin;

    // Extract all href attributes from anchor tags
    const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1];
      if (!href) continue;

      // Skip anchors, javascript, mailto, tel
      if (
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        continue;
      }

      try {
        // Resolve relative URLs
        const url = new URL(href, baseOrigin);
        const urlDomain = url.hostname.replace(/^www\./, '');

        // Only internal links
        if (urlDomain === baseDomain) {
          // Clean URL (remove trailing slash, fragments, query params for deduplication)
          const cleanPath = url.pathname.replace(/\/$/, '') || '/';
          const cleanUrl = `${url.origin}${cleanPath}`;

          // Skip common non-content URLs
          if (
            !cleanPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|xml)$/i)
          ) {
            links.add(cleanUrl);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  } catch (error) {
    console.error('Error extracting links from HTML:', error);
  }

  return Array.from(links);
}

/**
 * Detect features from HTML using AI-based analysis
 * Combines DOM structure analysis with AI verification for accuracy
 */
async function detectFeatures(html: string, url?: string): Promise<Features> {
  // First pass: DOM-based evidence collection
  const evidence = collectFeatureEvidence(html);

  // If we have strong DOM evidence, use it directly (fast path)
  if (evidence.highConfidenceCount >= 3) {
    return featuresSchema.parse({
      ecommerce: evidence.ecommerce.confidence > 60,
      userAccounts: evidence.userAccounts.confidence > 60,
      search: evidence.search.confidence > 60,
      multiLanguage: evidence.multiLanguage.confidence > 60,
      blog: evidence.blog.confidence > 60,
      forms: evidence.forms.confidence > 60,
      api: evidence.api.confidence > 60,
      mobileApp: evidence.mobileApp.confidence > 60,
      customFeatures: evidence.customFeatures,
    });
  }

  // Use AI to analyze ambiguous cases
  try {
    const aiFeatures = await detectFeaturesWithAI(html, url, evidence);
    return featuresSchema.parse(aiFeatures);
  } catch (error) {
    console.error('AI feature detection failed, using DOM evidence:', error);
    // Fallback to DOM evidence
    return featuresSchema.parse({
      ecommerce: evidence.ecommerce.confidence > 40,
      userAccounts: evidence.userAccounts.confidence > 40,
      search: evidence.search.confidence > 40,
      multiLanguage: evidence.multiLanguage.confidence > 40,
      blog: evidence.blog.confidence > 40,
      forms: evidence.forms.confidence > 40,
      api: evidence.api.confidence > 40,
      mobileApp: evidence.mobileApp.confidence > 40,
      customFeatures: evidence.customFeatures,
    });
  }
}

interface FeatureEvidence {
  confidence: number;
  indicators: string[];
}

interface CollectedEvidence {
  ecommerce: FeatureEvidence;
  userAccounts: FeatureEvidence;
  search: FeatureEvidence;
  multiLanguage: FeatureEvidence;
  blog: FeatureEvidence;
  forms: FeatureEvidence;
  api: FeatureEvidence;
  mobileApp: FeatureEvidence;
  customFeatures: string[];
  highConfidenceCount: number;
}

/**
 * Collect DOM-based evidence for each feature
 * Returns confidence scores based on actual DOM elements, not just keywords
 */
function collectFeatureEvidence(html: string): CollectedEvidence {
  const evidence: CollectedEvidence = {
    ecommerce: { confidence: 0, indicators: [] },
    userAccounts: { confidence: 0, indicators: [] },
    search: { confidence: 0, indicators: [] },
    multiLanguage: { confidence: 0, indicators: [] },
    blog: { confidence: 0, indicators: [] },
    forms: { confidence: 0, indicators: [] },
    api: { confidence: 0, indicators: [] },
    mobileApp: { confidence: 0, indicators: [] },
    customFeatures: [],
    highConfidenceCount: 0,
  };

  // E-Commerce: Look for actual cart/checkout elements
  const ecommerceChecks = [
    { pattern: /<[^>]*class="[^"]*cart[^"]*"/i, weight: 30, name: 'cart class' },
    { pattern: /<[^>]*id="[^"]*cart[^"]*"/i, weight: 30, name: 'cart id' },
    { pattern: /<button[^>]*add[^>]*cart/i, weight: 40, name: 'add to cart button' },
    { pattern: /data-product|data-price|data-sku/i, weight: 35, name: 'product data attributes' },
    { pattern: /WooCommerce|Shopify|Magento/i, weight: 50, name: 'e-commerce platform' },
    { pattern: /<form[^>]*checkout/i, weight: 40, name: 'checkout form' },
    { pattern: /shopping.cart|warenkorb/i, weight: 25, name: 'cart references' },
  ];
  for (const check of ecommerceChecks) {
    if (check.pattern.test(html)) {
      evidence.ecommerce.confidence += check.weight;
      evidence.ecommerce.indicators.push(check.name);
    }
  }

  // User Accounts: Look for login/register forms
  const accountChecks = [
    { pattern: /<form[^>]*login|<form[^>]*signin/i, weight: 40, name: 'login form' },
    { pattern: /<input[^>]*type=["']password["']/i, weight: 35, name: 'password field' },
    {
      pattern: /<[^>]*class="[^"]*login[^"]*"|<[^>]*id="[^"]*login[^"]*"/i,
      weight: 25,
      name: 'login element',
    },
    { pattern: /my.?account|mein.?konto/i, weight: 20, name: 'account link' },
    {
      pattern: /<a[^>]*href="[^"]*(?:register|signup|anmelden)[^"]*"/i,
      weight: 30,
      name: 'register link',
    },
    { pattern: /logout|abmelden|sign.?out/i, weight: 25, name: 'logout link' },
  ];
  for (const check of accountChecks) {
    if (check.pattern.test(html)) {
      evidence.userAccounts.confidence += check.weight;
      evidence.userAccounts.indicators.push(check.name);
    }
  }

  // Search: Look for actual search inputs
  const searchChecks = [
    { pattern: /<input[^>]*type=["']search["']/i, weight: 50, name: 'search input type' },
    { pattern: /<form[^>]*search|<form[^>]*role=["']search["']/i, weight: 40, name: 'search form' },
    { pattern: /<[^>]*class="[^"]*search[^"]*"[^>]*>/i, weight: 20, name: 'search class' },
    {
      pattern: /aria-label=["'][^"]*such|aria-label=["'][^"]*search/i,
      weight: 30,
      name: 'search aria-label',
    },
    {
      pattern: /<button[^>]*type=["']submit["'][^>]*search/i,
      weight: 35,
      name: 'search submit button',
    },
  ];
  for (const check of searchChecks) {
    if (check.pattern.test(html)) {
      evidence.search.confidence += check.weight;
      evidence.search.indicators.push(check.name);
    }
  }

  // Multi-Language: Look for language switchers and hreflang
  const langChecks = [
    { pattern: /hreflang=["'][a-z]{2}["']/i, weight: 50, name: 'hreflang tags' },
    {
      pattern: /<[^>]*class="[^"]*language[^"]*switcher[^"]*"/i,
      weight: 40,
      name: 'language switcher class',
    },
    { pattern: /\/(?:en|de|fr|es|it|nl|pl|pt)\/[^"'>\s]/i, weight: 30, name: 'language URL paths' },
    { pattern: /data-lang|data-locale/i, weight: 25, name: 'language data attributes' },
    { pattern: /<html[^>]*lang=["'][a-z]{2}/i, weight: 15, name: 'html lang attribute' },
  ];
  for (const check of langChecks) {
    if (check.pattern.test(html)) {
      evidence.multiLanguage.confidence += check.weight;
      evidence.multiLanguage.indicators.push(check.name);
    }
  }
  // Require multiple hreflang or URL paths for multi-language
  const hreflangMatches = (html.match(/hreflang/gi) || []).length;
  if (hreflangMatches >= 2) evidence.multiLanguage.confidence += 30;

  // Blog/News: Look for article structures
  const blogChecks = [
    { pattern: /<article[^>]*>/i, weight: 30, name: 'article elements' },
    {
      pattern: /<[^>]*class="[^"]*(?:blog|post|article)[^"]*"/i,
      weight: 25,
      name: 'blog/post classes',
    },
    { pattern: /\/blog\/|\/news\/|\/aktuelles\//i, weight: 35, name: 'blog URL paths' },
    { pattern: /<time[^>]*datetime/i, weight: 20, name: 'datetime elements' },
    { pattern: /<[^>]*class="[^"]*author[^"]*"/i, weight: 15, name: 'author classes' },
    { pattern: /category|kategorie|tag/i, weight: 10, name: 'category/tag references' },
  ];
  for (const check of blogChecks) {
    if (check.pattern.test(html)) {
      evidence.blog.confidence += check.weight;
      evidence.blog.indicators.push(check.name);
    }
  }

  // Forms: Look for actual form elements with inputs
  const formChecks = [
    { pattern: /<form[^>]*action/i, weight: 30, name: 'form with action' },
    { pattern: /<form[^>]*contact|<form[^>]*kontakt/i, weight: 40, name: 'contact form' },
    {
      pattern: /<input[^>]*type=["'](?:text|email|tel)["']/i,
      weight: 20,
      name: 'text/email inputs',
    },
    { pattern: /<textarea/i, weight: 25, name: 'textarea element' },
    { pattern: /<button[^>]*type=["']submit["']/i, weight: 20, name: 'submit button' },
    { pattern: /newsletter|subscribe|abonnieren/i, weight: 30, name: 'newsletter form' },
  ];
  for (const check of formChecks) {
    if (check.pattern.test(html)) {
      evidence.forms.confidence += check.weight;
      evidence.forms.indicators.push(check.name);
    }
  }

  // API: Look for API indicators
  const apiChecks = [
    { pattern: /\/api\/v?\d?/i, weight: 40, name: 'API versioned path' },
    { pattern: /graphql|__APOLLO|__RELAY/i, weight: 50, name: 'GraphQL indicators' },
    { pattern: /application\/json|fetch\(/i, weight: 25, name: 'JSON/fetch usage' },
    { pattern: /swagger|openapi/i, weight: 45, name: 'API documentation' },
    { pattern: /data-api|api-endpoint/i, weight: 35, name: 'API data attributes' },
  ];
  for (const check of apiChecks) {
    if (check.pattern.test(html)) {
      evidence.api.confidence += check.weight;
      evidence.api.indicators.push(check.name);
    }
  }

  // Mobile App: Look for app store links
  const appChecks = [
    { pattern: /apps\.apple\.com|itunes\.apple\.com/i, weight: 50, name: 'Apple App Store link' },
    { pattern: /play\.google\.com\/store/i, weight: 50, name: 'Google Play Store link' },
    {
      pattern: /<[^>]*class="[^"]*app[^"]*(?:badge|download|store)[^"]*"/i,
      weight: 35,
      name: 'app store badge',
    },
    { pattern: /download[^>]*app|app[^>]*download/i, weight: 20, name: 'app download text' },
  ];
  for (const check of appChecks) {
    if (check.pattern.test(html)) {
      evidence.mobileApp.confidence += check.weight;
      evidence.mobileApp.indicators.push(check.name);
    }
  }

  // Custom features: Only add if confidence is high
  const customChecks = [
    { pattern: /intercom|zendesk|freshdesk|drift|crisp/i, feature: 'Live Chat', minMatches: 1 },
    {
      pattern: /google.?maps|mapbox|openstreetmap|leaflet/i,
      feature: 'Maps Integration',
      minMatches: 1,
    },
    {
      pattern: /youtube\.com\/embed|vimeo\.com\/video|wistia\.com/i,
      feature: 'Video Embeds',
      minMatches: 1,
    },
    {
      pattern: /facebook\.com\/plugins|twitter\.com\/widgets|linkedin\.com\/embed/i,
      feature: 'Social Widgets',
      minMatches: 1,
    },
    {
      pattern: /calendly|booking\.com|reservation|terminbuchung/i,
      feature: 'Booking System',
      minMatches: 1,
    },
    { pattern: /stripe\.com|paypal\.com|klarna/i, feature: 'Payment Provider', minMatches: 1 },
    { pattern: /\.pdf["']|download[^>]*pdf/i, feature: 'PDF Downloads', minMatches: 1 },
    { pattern: /recaptcha|hcaptcha|turnstile/i, feature: 'Bot Protection', minMatches: 1 },
    { pattern: /cookie.?consent|cookie.?banner|gdpr/i, feature: 'Cookie Consent', minMatches: 1 },
  ];
  for (const check of customChecks) {
    const matches = (html.match(check.pattern) || []).length;
    if (matches >= check.minMatches) {
      evidence.customFeatures.push(check.feature);
    }
  }

  // Count high confidence features
  const allConfidences = [
    evidence.ecommerce.confidence,
    evidence.userAccounts.confidence,
    evidence.search.confidence,
    evidence.multiLanguage.confidence,
    evidence.blog.confidence,
    evidence.forms.confidence,
    evidence.api.confidence,
    evidence.mobileApp.confidence,
  ];
  evidence.highConfidenceCount = allConfidences.filter(c => c >= 60).length;

  // Cap confidences at 100
  evidence.ecommerce.confidence = Math.min(100, evidence.ecommerce.confidence);
  evidence.userAccounts.confidence = Math.min(100, evidence.userAccounts.confidence);
  evidence.search.confidence = Math.min(100, evidence.search.confidence);
  evidence.multiLanguage.confidence = Math.min(100, evidence.multiLanguage.confidence);
  evidence.blog.confidence = Math.min(100, evidence.blog.confidence);
  evidence.forms.confidence = Math.min(100, evidence.forms.confidence);
  evidence.api.confidence = Math.min(100, evidence.api.confidence);
  evidence.mobileApp.confidence = Math.min(100, evidence.mobileApp.confidence);

  return evidence;
}

/**
 * AI-based feature detection for ambiguous cases
 */
async function detectFeaturesWithAI(
  html: string,
  url: string | undefined,
  evidence: CollectedEvidence
): Promise<Features> {
  const htmlSnippet = html.substring(0, 15000); // Limit for AI context

  const systemPrompt = `Du bist ein Website-Feature-Analyst. Analysiere das HTML und bestimme welche Features die Website hat.
Antworte NUR mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Basiere deine Analyse auf konkreten DOM-Elementen und Strukturen, nicht nur auf Keyword-Vorkommen.`;

  const userPrompt = `Analysiere diese Website und bestimme welche Features vorhanden sind.

URL: ${url || 'unbekannt'}

Vorläufige Evidenz (DOM-basiert):
- E-Commerce: ${evidence.ecommerce.confidence}% (${evidence.ecommerce.indicators.join(', ') || 'keine'})
- User Accounts: ${evidence.userAccounts.confidence}% (${evidence.userAccounts.indicators.join(', ') || 'keine'})
- Search: ${evidence.search.confidence}% (${evidence.search.indicators.join(', ') || 'keine'})
- Multi-Language: ${evidence.multiLanguage.confidence}% (${evidence.multiLanguage.indicators.join(', ') || 'keine'})
- Blog/News: ${evidence.blog.confidence}% (${evidence.blog.indicators.join(', ') || 'keine'})
- Forms: ${evidence.forms.confidence}% (${evidence.forms.indicators.join(', ') || 'keine'})
- API: ${evidence.api.confidence}% (${evidence.api.indicators.join(', ') || 'keine'})
- Mobile App: ${evidence.mobileApp.confidence}% (${evidence.mobileApp.indicators.join(', ') || 'keine'})
- Custom Features: ${evidence.customFeatures.join(', ') || 'keine'}

HTML Auszug:
${htmlSnippet}

Antworte mit JSON:
{
  "ecommerce": true/false,
  "userAccounts": true/false,
  "search": true/false,
  "multiLanguage": true/false,
  "blog": true/false,
  "forms": true/false,
  "api": true/false,
  "mobileApp": true/false,
  "customFeatures": ["Feature1", "Feature2"]
}`;

  const result = await generateStructuredOutput({
    schema: featuresSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return result;
}

/**
 * @deprecated Use getBusinessUnitsOnce() from singleton cache instead
 * This function is kept for backwards compatibility but will be removed in future versions.
 */
async function loadBusinessUnitsFromDB(): Promise<Array<{ name: string; keywords: string[] }>> {
  try {
    const units = await db.select().from(businessUnitsTable);
    return units.map(unit => ({
      name: unit.name,
      keywords: typeof unit.keywords === 'string' ? JSON.parse(unit.keywords) : unit.keywords || [],
    }));
  } catch (error) {
    console.error('Error loading business units from DB:', error);
    // Fallback to empty array - validation will use keyword matching
    return [];
  }
}

/**
 * Validate and match BL recommendation against DB entries
 * Falls back to keyword-based matching if AI returns unknown BL
 */
function validateAndMatchBL(
  aiRecommendation: BLRecommendation,
  businessUnits: Array<{ name: string; keywords: string[] }>,
  context: { techStack: TechStack; features: Features }
): BLRecommendation {
  if (businessUnits.length === 0) {
    // No BUs in DB - return AI recommendation as-is
    return aiRecommendation;
  }

  const recommendedLower = aiRecommendation.primaryBusinessLine.toLowerCase();

  // Check if AI recommendation matches exactly
  const exactMatch = businessUnits.find(bu => bu.name.toLowerCase() === recommendedLower);
  if (exactMatch) {
    return { ...aiRecommendation, primaryBusinessLine: exactMatch.name };
  }

  // Check for partial match (e.g., "eCommerce" matches "eCommerce & Retail")
  const partialMatch = businessUnits.find(
    bu =>
      bu.name.toLowerCase().includes(recommendedLower) ||
      recommendedLower.includes(bu.name.toLowerCase())
  );
  if (partialMatch) {
    return { ...aiRecommendation, primaryBusinessLine: partialMatch.name };
  }

  // Fallback: Keyword-based matching
  const contextKeywords = [
    context.techStack.cms?.toLowerCase(),
    context.techStack.framework?.toLowerCase(),
    ...(context.techStack.backend?.map(b => b.toLowerCase()) || []),
    ...(context.techStack.libraries?.map(l => l.toLowerCase()) || []),
    context.features.ecommerce ? 'ecommerce' : null,
    context.features.ecommerce ? 'shop' : null,
    context.features.userAccounts ? 'portal' : null,
    context.features.api ? 'api' : null,
  ].filter(Boolean) as string[];

  let bestMatch: { name: string; score: number } | null = null;

  for (const bu of businessUnits) {
    let score = 0;
    for (const keyword of bu.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Check if any context keyword matches
      if (contextKeywords.some(ck => ck.includes(keywordLower) || keywordLower.includes(ck))) {
        score++;
      }
      // Check if recommended BL name contains keyword
      if (recommendedLower.includes(keywordLower)) {
        score += 2;
      }
    }
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { name: bu.name, score };
    }
  }

  if (bestMatch && bestMatch.score > 0) {
    return {
      ...aiRecommendation,
      primaryBusinessLine: bestMatch.name,
      reasoning:
        aiRecommendation.reasoning +
        ` (Zugeordnet zu "${bestMatch.name}" basierend auf Keyword-Matching)`,
    };
  }

  // If no match found, use first BU as fallback with reduced confidence
  return {
    ...aiRecommendation,
    primaryBusinessLine: businessUnits[0].name,
    confidence: Math.min(aiRecommendation.confidence, 40),
    reasoning:
      aiRecommendation.reasoning +
      ` (Keine direkte Übereinstimmung - Standard-Zuordnung zu "${businessUnits[0].name}")`,
  };
}

/**
 * Recommend business line based on analysis
 * Uses singleton cache for business units (loaded once per session)
 */
async function recommendBusinessLine(context: {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  extractedRequirements?: any;
  contextSection?: string;
  cachedBusinessUnits?: CachedBusinessUnit[]; // Pre-loaded BUs from bootstrap
}): Promise<BLRecommendation> {
  // Use cached BUs if provided, otherwise use singleton cache
  const businessUnits = context.cachedBusinessUnits ?? (await getBusinessUnitsOnce());

  // Build dynamic BU list for prompt
  let buListPrompt: string;
  if (businessUnits.length > 0) {
    buListPrompt = businessUnits
      .map(bu => `- ${bu.name} (Keywords: ${bu.keywords.join(', ')})`)
      .join('\n');
  } else {
    // Fallback if no BUs in DB
    buListPrompt = `- Technology & Innovation (Custom Development, Cloud Migration, Modernisierung)
- Microsoft (SharePoint, Dynamics 365, Azure, Power Platform)
- Public Sector (Behördenportale, OZG, Bürgerservices)`;
  }

  const systemPrompt = `Du bist ein Business Development Experte bei adesso SE, einem führenden IT-Beratungsunternehmen.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG:
- Gib immer eine fundierte Empfehlung ab, auch wenn die Datenlage begrenzt ist.
- Wähle NUR aus den unten aufgeführten Business Lines - erfinde KEINE neuen Namen!
- Verwende den EXAKTEN Namen der Business Line wie in der Liste angegeben.`;

  const userPrompt = `Analysiere die Website-Daten und empfehle die optimale Business Line für dieses Projekt.

**Tech Stack:**
${JSON.stringify(context.techStack, null, 2)}

**Content Volume:**
${JSON.stringify(context.contentVolume, null, 2)}

**Features:**
${JSON.stringify(context.features, null, 2)}

${
  context.extractedRequirements
    ? `
**Extrahierte Anforderungen aus der Ausschreibung:**
${JSON.stringify(context.extractedRequirements, null, 2)}
`
    : '**Keine Ausschreibungsdaten verfügbar - Empfehlung basiert nur auf Website-Analyse**'
}

**VERFÜGBARE Business Lines (wähle NUR aus dieser Liste!):**
${buListPrompt}

**ANALYSE-KRITERIEN:**
1. Welche Business Line passt am besten zum erkannten Tech Stack?
2. Welche Keywords der Business Lines matchen mit den erkannten Technologien?
3. Welche Branchen-Indikatoren sind erkennbar?
4. Welche speziellen Kompetenzen werden benötigt?

**KRITISCH - OUTPUT-ANFORDERUNGEN:**
- primaryBusinessLine: MUSS exakt einer der oben aufgeführten Business Line Namen sein!
- confidence: Deine Sicherheit in Prozent (0-100)
- reasoning: Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- alternativeBusinessLines: 2-3 alternative BLs aus der obigen Liste mit Begründung
- requiredSkills: Konkrete Skills für dieses Projekt

Antworte mit JSON:
- primaryBusinessLine (string): Exakt einer der verfügbaren Business Line Namen
- confidence (number 0-100): Confidence in der Empfehlung
- reasoning (string): Deutsche Erklärung für die Empfehlung
- alternativeBusinessLines (array of {name: string, confidence: number, reason: string}): Alternativen aus der verfügbaren Liste
- requiredSkills (array of strings): Benötigte Skills für das Projekt`;

  const aiResult = await callAI<BLRecommendation>(
    systemPrompt,
    userPrompt,
    blRecommendationSchema,
    context.contextSection
  );

  // Validate and match against actual DB entries
  return validateAndMatchBL(aiResult, businessUnits, context);
}

/**
 * Extract tech indicators from HTML (for AI fallback)
 */
function extractTechIndicators(html: string): string {
  const indicators: string[] = [];

  // Extract meta tags
  const metaRegex = /<meta[^>]+>/gi;
  const metas = html.match(metaRegex) || [];
  indicators.push('Meta Tags:', ...metas.slice(0, 10));

  // Extract script tags
  const scriptRegex = /<script[^>]*src="([^"]+)"/gi;
  const scripts = Array.from(html.matchAll(scriptRegex)).map(m => m[1]);
  indicators.push('\nScript Sources:', ...scripts.slice(0, 20));

  // Extract link tags (stylesheets)
  const linkRegex = /<link[^>]*href="([^"]+)"/gi;
  const links = Array.from(html.matchAll(linkRegex)).map(m => m[1]);
  indicators.push('\nStylesheet Links:', ...links.slice(0, 10));

  // Look for common CMS indicators
  const cmsIndicators = [
    'wp-content',
    'wp-includes',
    'drupal',
    'typo3',
    'joomla',
    'sites/default',
    'magento',
    'shopify',
    'wix',
    'squarespace',
  ];

  indicators.push('\nCMS Indicators Found:');
  cmsIndicators.forEach(indicator => {
    if (html.toLowerCase().includes(indicator)) {
      indicators.push(`- ${indicator}`);
    }
  });

  return indicators.join('\n').substring(0, 5000);
}

/**
 * Perform accessibility audit on the HTML content
 * Checks for WCAG 2.1 compliance issues
 */
async function performAccessibilityAudit(html: string, url: string): Promise<AccessibilityAudit> {
  // Parse HTML for accessibility checks
  const issues: Array<{
    type: string;
    count: number;
    severity: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
  }> = [];

  // Check for images without alt text
  const imgRegex = /<img[^>]*>/gi;
  const images = html.match(imgRegex) || [];
  const imagesWithoutAlt = images.filter(
    img => !img.includes('alt=') || img.includes('alt=""') || img.includes("alt=''")
  );
  if (imagesWithoutAlt.length > 0) {
    issues.push({
      type: 'missing-alt',
      count: imagesWithoutAlt.length,
      severity: 'critical',
      description: `${imagesWithoutAlt.length} Bilder ohne Alt-Text gefunden`,
    });
  }

  // Check for proper heading hierarchy
  const headings = html.match(/<h[1-6][^>]*>/gi) || [];
  const headingLevels = headings.map(h => parseInt(h.match(/<h([1-6])/i)?.[1] || '0'));
  let headingIssues = 0;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      headingIssues++;
    }
  }
  if (headingIssues > 0) {
    issues.push({
      type: 'heading-order',
      count: headingIssues,
      severity: 'serious',
      description: `${headingIssues} Überschriften-Hierarchie-Probleme gefunden`,
    });
  }

  // Check for form labels
  const inputs = html.match(/<input[^>]*type=["'](text|email|password|tel|number)[^>]*>/gi) || [];
  const inputsWithoutLabel = inputs.filter(input => {
    const idMatch = input.match(/id=["']([^"']+)["']/i);
    if (!idMatch) return true;
    const labelRegex = new RegExp(`<label[^>]*for=["']${idMatch[1]}["']`, 'i');
    return !labelRegex.test(html);
  });
  if (inputsWithoutLabel.length > 0) {
    issues.push({
      type: 'missing-form-labels',
      count: inputsWithoutLabel.length,
      severity: 'critical',
      description: `${inputsWithoutLabel.length} Formularfelder ohne zugehörige Labels`,
    });
  }

  // Check for ARIA landmarks
  const hasMainLandmark = /<main[^>]*>|role=["']main["']/i.test(html);
  const hasNavLandmark = /<nav[^>]*>|role=["']navigation["']/i.test(html);
  if (!hasMainLandmark) {
    issues.push({
      type: 'missing-landmark',
      count: 1,
      severity: 'moderate',
      description: 'Kein <main> Landmark gefunden',
    });
  }

  // Check for skip links
  const hasSkipLink = /skip|springe.*inhalt|jump.*content/i.test(html);

  // Check for language attribute
  const hasLangAttr = /<html[^>]*lang=["'][^"']+["']/i.test(html);
  if (!hasLangAttr) {
    issues.push({
      type: 'missing-lang',
      count: 1,
      severity: 'serious',
      description: 'Kein lang-Attribut im <html> Tag',
    });
  }

  // Check for links with descriptive text
  const links = html.match(/<a[^>]*>([^<]*)<\/a>/gi) || [];
  const badLinks = links.filter(link => {
    const text = link
      .replace(/<[^>]+>/g, '')
      .trim()
      .toLowerCase();
    return ['hier', 'klicken', 'mehr', 'link', 'here', 'click', 'more', 'read more'].includes(text);
  });
  if (badLinks.length > 0) {
    issues.push({
      type: 'non-descriptive-links',
      count: badLinks.length,
      severity: 'moderate',
      description: `${badLinks.length} Links mit nicht-beschreibendem Text (z.B. "hier klicken")`,
    });
  }

  // Check for buttons without accessible names
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
  const buttonsWithoutText = buttons.filter(btn => {
    const text = btn.replace(/<[^>]+>/g, '').trim();
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(btn);
    return !text && !hasAriaLabel;
  });
  if (buttonsWithoutText.length > 0) {
    issues.push({
      type: 'button-no-name',
      count: buttonsWithoutText.length,
      severity: 'critical',
      description: `${buttonsWithoutText.length} Buttons ohne zugänglichen Namen`,
    });
  }

  // Check for tabindex > 0 (anti-pattern)
  const tabindexIssues = (html.match(/tabindex=["'][1-9]/gi) || []).length;
  if (tabindexIssues > 0) {
    issues.push({
      type: 'positive-tabindex',
      count: tabindexIssues,
      severity: 'moderate',
      description: `${tabindexIssues} Elemente mit positivem tabindex (Anti-Pattern)`,
    });
  }

  // Calculate scores
  const criticalIssues = issues
    .filter(i => i.severity === 'critical')
    .reduce((sum, i) => sum + i.count, 0);
  const seriousIssues = issues
    .filter(i => i.severity === 'serious')
    .reduce((sum, i) => sum + i.count, 0);
  const moderateIssues = issues
    .filter(i => i.severity === 'moderate')
    .reduce((sum, i) => sum + i.count, 0);
  const minorIssues = issues
    .filter(i => i.severity === 'minor')
    .reduce((sum, i) => sum + i.count, 0);

  // Calculate overall score (100 - penalties)
  const penalty = criticalIssues * 10 + seriousIssues * 5 + moderateIssues * 2 + minorIssues * 1;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  // Determine WCAG level
  let level: 'A' | 'AA' | 'AAA' | 'fail' = 'AAA';
  if (criticalIssues > 0) level = 'fail';
  else if (seriousIssues > 0) level = 'A';
  else if (moderateIssues > 0) level = 'AA';

  // Generate recommendations
  const recommendations: string[] = [];
  if (imagesWithoutAlt.length > 0) {
    recommendations.push('Alt-Texte für alle Bilder hinzufügen (WCAG 1.1.1)');
  }
  if (!hasLangAttr) {
    recommendations.push('lang-Attribut zum <html> Tag hinzufügen (WCAG 3.1.1)');
  }
  if (inputsWithoutLabel.length > 0) {
    recommendations.push('Labels für alle Formularfelder hinzufügen (WCAG 1.3.1, 3.3.2)');
  }
  if (headingIssues > 0) {
    recommendations.push('Überschriften-Hierarchie korrigieren (WCAG 1.3.1)');
  }
  if (!hasSkipLink) {
    recommendations.push('Skip-Link zur Navigation hinzufügen (WCAG 2.4.1)');
  }
  if (badLinks.length > 0) {
    recommendations.push('Beschreibende Linktexte verwenden statt "hier klicken" (WCAG 2.4.4)');
  }

  return accessibilityAuditSchema.parse({
    score,
    level,
    criticalIssues,
    seriousIssues,
    moderateIssues,
    minorIssues,
    checks: {
      hasAltTexts: imagesWithoutAlt.length === 0,
      hasAriaLabels: hasMainLandmark && hasNavLandmark,
      hasProperHeadings: headingIssues === 0,
      hasSkipLinks: hasSkipLink,
      colorContrast: 'warning', // Can't check without rendering
      keyboardNavigation: tabindexIssues === 0 ? 'pass' : 'warning',
      formLabels: inputs.length === 0 ? 'n/a' : inputsWithoutLabel.length === 0 ? 'pass' : 'fail',
      languageAttribute: hasLangAttr,
    },
    topIssues: issues.slice(0, 5),
    recommendations,
  });
}

/**
 * Extract company name from HTML or URL
 * Improved fallback chain based on Research Insights:
 * 1. og:site_name (most reliable)
 * 2. JSON-LD structured data (schema.org Organization/name)
 * 3. <title> cleaned (remove common patterns)
 * 4. Domain name capitalized (last resort)
 */
function extractCompanyName(html: string, url: string): string | null {
  // 1. Try og:site_name meta tag (most reliable)
  const ogSiteNameMatch = html.match(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogSiteNameMatch) {
    const name = ogSiteNameMatch[1].trim();
    if (name.length > 1 && !isGenericPageTitle(name)) return name;
  }

  // 2. Try JSON-LD structured data (schema.org Organization)
  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdMatch) {
    for (const script of jsonLdMatch) {
      try {
        const content = script.replace(/<script[^>]*>|<\/script>/gi, '');
        const data = JSON.parse(content);
        // Handle single object or array
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Organization' && item.name) {
            const name = String(item.name).trim();
            if (name.length > 1 && !isGenericPageTitle(name)) return name;
          }
          // Also check for WebSite type with publisher
          if (item['@type'] === 'WebSite' && item.publisher?.name) {
            const name = String(item.publisher.name).trim();
            if (name.length > 1 && !isGenericPageTitle(name)) return name;
          }
        }
      } catch {
        // Invalid JSON, continue
      }
    }
  }

  // 3. Try from title tag with improved cleaning
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const rawTitle = titleMatch[1].trim();
    const cleanedTitle = cleanPageTitle(rawTitle);
    if (cleanedTitle && cleanedTitle.length > 1 && cleanedTitle.length < 100) {
      return cleanedTitle;
    }
  }

  // 4. Extract from domain (last resort)
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const domain = hostname.replace('www.', '').split('.')[0];
    // Capitalize first letter, handle multi-word domains like "my-company"
    return domain
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

/**
 * Phase 2: Enhanced blacklist for company name extraction
 * Extended list of generic page titles that shouldn't be used as company name
 */
const TITLE_BLACKLIST = new Set([
  // German generic titles
  'startseite',
  'willkommen',
  'home',
  'homepage',
  'index',
  'hauptseite',
  'start',
  'übersicht',
  'overview',
  'portal',
  'aktuelles',
  'news',
  'blog',
  'kontakt',
  'contact',
  'impressum',
  'imprint',
  'über uns',
  'about',
  'about us',
  'menü',
  'menu',
  'navigation',
  'login',
  'anmeldung',
  // English generic titles
  'welcome',
  'main',
  'landing',
  'enter',
  'intro',
  'introduction',
  'sign in',
  'log in',
  'register',
  // Common section titles
  'produkte',
  'products',
  'leistungen',
  'services',
  'unternehmen',
  'company',
  'karriere',
  'career',
  'jobs',
  'presse',
  'press',
  'media',
  'referenzen',
  'references',
  'datenschutz',
  'privacy',
  'agb',
  'terms',
  'cookie',
]);

/**
 * Check if a string is a generic page title that shouldn't be used as company name
 */
function isGenericPageTitle(text: string): boolean {
  const normalizedText = text.trim().toLowerCase();

  // Direct blacklist match
  if (TITLE_BLACKLIST.has(normalizedText)) {
    return true;
  }

  // Pattern-based checks for compound generic titles
  const genericPatterns = [
    /^(startseite|home|homepage|willkommen|welcome|start)\s/i,
    /\s(startseite|home|homepage)$/i,
  ];
  return genericPatterns.some(pattern => pattern.test(text.trim()));
}

/**
 * Clean page title to extract company name
 * Handles patterns like:
 * - "Startseite - Company Name" -> "Company Name"
 * - "Company Name | Startseite" -> "Company Name"
 * - "Home :: Company Name" -> "Company Name"
 * - "Company Name - Website Title | Slogan" -> "Company Name"
 */
function cleanPageTitle(title: string): string | null {
  // Split by common separators
  const separators = /\s*[-–—|:|::]\s*/;
  const parts = title
    .split(separators)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Filter out generic page titles
  const meaningfulParts = parts.filter(part => !isGenericPageTitle(part));

  if (meaningfulParts.length === 0) return null;

  // Return the first meaningful part (usually the company name)
  // Exception: If first part is very short (1-2 chars), try the second
  if (meaningfulParts[0].length <= 2 && meaningfulParts.length > 1) {
    return meaningfulParts[1];
  }

  return meaningfulParts[0];
}

/**
 * Perform SEO audit on HTML content
 */
async function performSEOAudit(html: string, _url: string): Promise<SEOAudit> {
  // Check title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const hasTitle = !!titleMatch && titleMatch[1].trim().length > 0;
  const titleLength = titleMatch ? titleMatch[1].trim().length : 0;

  // Check meta description
  const metaDescMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  const hasMetaDescription = !!metaDescMatch && metaDescMatch[1].trim().length > 0;
  const metaDescriptionLength = metaDescMatch ? metaDescMatch[1].trim().length : 0;

  // Check canonical
  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);

  // Check robots.txt (we assume based on URL patterns in the HTML)
  const hasRobotsTxt = true; // Would need actual fetch to verify

  // Check sitemap
  const hasSitemap = /<link[^>]*sitemap/i.test(html) || html.includes('sitemap.xml');

  // Check structured data
  const hasStructuredData =
    /application\/ld\+json/i.test(html) || /itemtype.*schema\.org/i.test(html);

  // Check Open Graph
  const hasOpenGraph = /<meta[^>]*property=["']og:/i.test(html);

  // Check mobile viewport
  const mobileViewport = /<meta[^>]*name=["']viewport["']/i.test(html);

  // Calculate score
  const checks = [
    hasTitle,
    titleLength >= 30 && titleLength <= 60,
    hasMetaDescription,
    metaDescriptionLength >= 120 && metaDescriptionLength <= 160,
    hasCanonical,
    hasSitemap,
    hasStructuredData,
    hasOpenGraph,
    mobileViewport,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  // Collect issues
  const issues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
  }> = [];
  if (!hasTitle)
    issues.push({
      type: 'missing-title',
      severity: 'error',
      description: 'Kein Title-Tag gefunden',
    });
  if (!hasMetaDescription)
    issues.push({
      type: 'missing-meta-desc',
      severity: 'warning',
      description: 'Keine Meta-Description vorhanden',
    });
  if (!hasCanonical)
    issues.push({
      type: 'missing-canonical',
      severity: 'info',
      description: 'Kein Canonical-Tag definiert',
    });
  if (!hasOpenGraph)
    issues.push({ type: 'missing-og', severity: 'info', description: 'Keine Open Graph Tags' });

  return seoAuditSchema.parse({
    score,
    checks: {
      hasTitle,
      titleLength: titleLength || undefined,
      hasMetaDescription,
      metaDescriptionLength: metaDescriptionLength || undefined,
      hasCanonical,
      hasRobotsTxt,
      hasSitemap,
      hasStructuredData,
      hasOpenGraph,
      mobileViewport,
    },
    issues,
  });
}

/**
 * Perform legal compliance check
 */
async function performLegalComplianceCheck(html: string): Promise<LegalCompliance> {
  // Check for imprint
  const hasImprint =
    /impressum|imprint|legal notice/i.test(html) &&
    (/<a[^>]*href=["'][^"']*impressum[^"']*["']/i.test(html) ||
      /<a[^>]*href=["'][^"']*imprint[^"']*["']/i.test(html));

  // Check for privacy policy
  const hasPrivacyPolicy =
    /datenschutz|privacy|dsgvo|gdpr/i.test(html) &&
    /<a[^>]*href=["'][^"']*(datenschutz|privacy)[^"']*["']/i.test(html);

  // Check for cookie banner
  const hasCookieBanner =
    /cookie|consent|ccm19|cookiefirst|onetrust|usercentrics|borlabs|complianz/i.test(html);

  // Check for terms of service
  const hasTermsOfService = /agb|terms|nutzungsbedingungen|geschäftsbedingungen/i.test(html);

  // Check for accessibility statement
  const hasAccessibilityStatement = /barrierefreiheit|accessibility|barrierefrei/i.test(html);

  // Detect cookie consent tool
  let cookieConsentTool: string | undefined;
  if (/cookiefirst/i.test(html)) cookieConsentTool = 'CookieFirst';
  else if (/onetrust/i.test(html)) cookieConsentTool = 'OneTrust';
  else if (/usercentrics/i.test(html)) cookieConsentTool = 'Usercentrics';
  else if (/borlabs/i.test(html)) cookieConsentTool = 'Borlabs Cookie';
  else if (/complianz/i.test(html)) cookieConsentTool = 'Complianz';
  else if (/ccm19/i.test(html)) cookieConsentTool = 'CCM19';

  // Calculate score
  const criticalChecks = [hasImprint, hasPrivacyPolicy, hasCookieBanner];
  const allChecks = [...criticalChecks, hasTermsOfService, hasAccessibilityStatement];
  const score = Math.round((allChecks.filter(Boolean).length / allChecks.length) * 100);

  // Collect issues
  const issues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
  }> = [];
  if (!hasImprint)
    issues.push({
      type: 'missing-imprint',
      severity: 'critical',
      description: 'Kein Impressum gefunden (Pflicht in DE)',
    });
  if (!hasPrivacyPolicy)
    issues.push({
      type: 'missing-privacy',
      severity: 'critical',
      description: 'Keine Datenschutzerklärung gefunden (DSGVO-Pflicht)',
    });
  if (!hasCookieBanner)
    issues.push({
      type: 'missing-cookie-banner',
      severity: 'warning',
      description: 'Kein Cookie-Banner erkannt',
    });

  return legalComplianceSchema.parse({
    score,
    checks: {
      hasImprint,
      hasPrivacyPolicy,
      hasCookieBanner,
      hasTermsOfService,
      hasAccessibilityStatement,
    },
    gdprIndicators: {
      cookieConsentTool,
      analyticsCompliant: hasCookieBanner,
      hasDataProcessingInfo: hasPrivacyPolicy,
    },
    issues,
  });
}

/**
 * Analyze performance indicators from HTML
 */
async function analyzePerformanceIndicators(html: string): Promise<PerformanceIndicators> {
  // Count resources
  const scripts = (html.match(/<script[^>]*>/gi) || []).length;
  const stylesheets = (html.match(/<link[^>]*rel=["']stylesheet["']/gi) || []).length;
  const images = (html.match(/<img[^>]+>/gi) || []).length;
  const fonts = (html.match(/font-face|fonts\.googleapis|fonts\.gstatic/gi) || []).length;

  // Check for lazy loading
  const hasLazyLoading = /loading=["']lazy["']/i.test(html);

  // Check for minification (rough estimate)
  const hasMinification = html.length < 50000 || !/\n\s{4,}/g.test(html);

  // Estimate load time
  const totalResources = scripts + stylesheets + images;
  const estimatedLoadTime: 'fast' | 'medium' | 'slow' =
    totalResources < 30 ? 'fast' : totalResources < 60 ? 'medium' : 'slow';

  // Count render-blocking (inline scripts without defer/async)
  const renderBlockingScripts = (html.match(/<script(?![^>]*(?:defer|async))[^>]*src=/gi) || [])
    .length;
  const renderBlockingResources = renderBlockingScripts + stylesheets;

  return performanceIndicatorsSchema.parse({
    htmlSize: Math.round(html.length / 1024),
    resourceCount: {
      scripts,
      stylesheets,
      images,
      fonts,
    },
    estimatedLoadTime,
    hasLazyLoading,
    hasMinification,
    hasCaching: false, // Can't determine from HTML alone
    renderBlockingResources,
  });
}

/**
 * Quick Scan with Streaming Support
 * Emits real-time events for progress tracking with detailed Chain of Thought
 */
export async function runQualificationScanWithStreaming(
  input: QualificationScanInput,
  emit: EventEmitter
): Promise<QualificationScanResult> {
  const activityLog: QualificationScanResult['activityLog'] = [];

  const logActivity = (action: string, details?: string) => {
    activityLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  };

  let contextSection: string | undefined;
  if (input.userId) {
    try {
      const context = await buildAgentContext(input.userId);
      contextSection = formatContextForPrompt(context);
    } catch {
      // Ignore context errors
    }
  }

  const emitThought = (agent: string, thought: string, details?: string) => {
    emit({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent,
        message: thought,
        details,
      },
    });
    logActivity(thought, details);
  };

  // Helper to emit agent completion - used for progress tracking in UI
  const emitAgentComplete = (agent: string, result?: unknown) => {
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent,
        result: result || { status: 'completed' },
      },
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE EVENT HELPERS - QualificationScan 2.0 Workflow
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Emit a phase start event for UI progress tracking
   * Phases: bootstrap, multi_page, analysis, synthesis
   */
  const emitPhase = (phase: QualificationScanPhase, message: string) => {
    emit({
      type: AgentEventType.PHASE_START,
      data: {
        phase,
        message,
        timestamp: Date.now(),
      },
    });
    logActivity(`Phase: ${phase}`, message);
  };

  /**
   * Emit an analysis completion event for tracking individual analysis results
   */
  const emitAnalysisComplete = (
    analysis: string,
    success: boolean,
    duration: number,
    details?: string
  ) => {
    emit({
      type: AgentEventType.ANALYSIS_COMPLETE,
      data: {
        analysis,
        success,
        duration,
        details,
      },
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════════

  try {
    emitThought('Quick Scan', `Starte Quick Scan Analyse...`, `URL: ${input.websiteUrl}`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRE-CHECK: URL Reachability (Fast-Fail before expensive operations)
    // ═══════════════════════════════════════════════════════════════════════════════
    emitThought('Website Crawler', `Prüfe URL-Erreichbarkeit...`);
    const urlCheck = await checkAndSuggestUrl(input.websiteUrl);

    // Emit URL check result
    emit({
      type: AgentEventType.URL_CHECK,
      data: {
        originalUrl: input.websiteUrl,
        finalUrl: urlCheck.finalUrl,
        reachable: urlCheck.reachable,
        statusCode: urlCheck.statusCode,
        redirectChain: urlCheck.redirectChain,
      },
    });

    if (!urlCheck.reachable) {
      // If we have a suggestion, emit it before throwing
      if (urlCheck.suggestedUrl) {
        emit({
          type: AgentEventType.URL_SUGGESTION,
          data: {
            originalUrl: input.websiteUrl,
            suggestedUrl: urlCheck.suggestedUrl,
            reason: urlCheck.reason || 'URL nicht erreichbar',
          },
        });
        throw new Error(
          `Website nicht erreichbar: ${urlCheck.reason}. Vorgeschlagene URL: ${urlCheck.suggestedUrl}`
        );
      }
      throw new Error(`Website nicht erreichbar: ${urlCheck.reason}`);
    }

    // Use the final URL (after redirects) for the rest of the scan
    const fullUrl = urlCheck.finalUrl;

    // Log if URL was redirected
    if (urlCheck.redirectChain && urlCheck.redirectChain.length > 1) {
      emitThought(
        'Website Crawler',
        `URL wurde weitergeleitet`,
        `${input.websiteUrl} → ${fullUrl}`
      );
    } else {
      emitThought('Website Crawler', `URL erreichbar (${urlCheck.statusCode || 'OK'})`, fullUrl);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 1: BOOTSTRAP (Parallel: Website Data + Business Units)
    // ═══════════════════════════════════════════════════════════════════════════════
    emitPhase('bootstrap', 'Initialisiere Scan - lade Website und Business Units...');

    // Run bootstrap tasks in parallel - use fullUrl (validated, after redirects)
    const bootstrapStart = Date.now();
    const [websiteData, cachedBusinessUnits] = await Promise.all([
      fetchWebsiteData(fullUrl),
      getBusinessUnitsOnce(), // Singleton cache - loaded once per session
    ]);

    emitAnalysisComplete(
      'bootstrap',
      true,
      Date.now() - bootstrapStart,
      `Website + ${cachedBusinessUnits.length} Business Units geladen`
    );

    if (!websiteData.html) {
      throw new Error('Website konnte nicht geladen werden');
    }

    const htmlSize = Math.round(websiteData.html.length / 1024);
    emitThought(
      'Website Crawler',
      `Website geladen: ${htmlSize} KB HTML`,
      `${Object.keys(websiteData.headers).length} HTTP-Headers empfangen`
    );

    // Report Wappalyzer results
    if (websiteData.wappalyzerResults.length > 0) {
      const techNames = websiteData.wappalyzerResults
        .slice(0, 5)
        .map(t => t.name)
        .join(', ');
      emitThought(
        'Wappalyzer',
        `${websiteData.wappalyzerResults.length} Technologien erkannt`,
        techNames + (websiteData.wappalyzerResults.length > 5 ? '...' : '')
      );
    } else {
      emitThought(
        'Wappalyzer',
        'Keine Technologien automatisch erkannt',
        'Verwende AI-Analyse als Fallback'
      );
    }

    // Report sitemap results
    if (websiteData.sitemapUrls.length > 0) {
      emitThought(
        'Sitemap Parser',
        `${websiteData.sitemapUrls.length} Seiten in Sitemap gefunden`,
        `Analysiere URL-Struktur und Content-Typen`
      );
    } else {
      emitThought(
        'Sitemap Parser',
        'Keine Sitemap gefunden',
        'Schätze Seitenanzahl aus Navigation'
      );
    }

    // Mark data collection agents as complete
    emitAgentComplete('Website Crawler', {
      htmlSize,
      headersCount: Object.keys(websiteData.headers).length,
    });
    emitAgentComplete('Wappalyzer', { technologiesFound: websiteData.wappalyzerResults.length });
    emitAgentComplete('Sitemap Parser', { urlsFound: websiteData.sitemapUrls.length });

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 1.2: MULTI-PAGE FETCH (Parallel page loading)
    // ═══════════════════════════════════════════════════════════════════════════════
    emitPhase('multi_page', 'Lade diverse Seiten für Analyse...');
    const multiPageStart = Date.now();

    // Select diverse pages for analysis
    let multiPageData: {
      sampledPages: SampledPages;
      pageDataArray: PageData[];
      aggregatedTech: AggregatedTechResult | null;
      extractedComponents: ExtractedComponents | null;
    } | null = null;

    // Determine URLs for analysis - combine sitemap + link discovery
    const urlPool = [...websiteData.sitemapUrls];
    let urlSource: 'sitemap' | 'link_discovery' | 'combined' = 'sitemap';

    // Link Discovery Fallback: If sitemap has < 5 URLs, extract links from HTML
    if (urlPool.length < 5 && websiteData.html) {
      emitThought(
        'Link Discovery',
        'Sitemap hat wenig URLs, extrahiere Links aus Homepage...',
        `Sitemap URLs: ${urlPool.length}`
      );

      const discoveredLinks = extractLinksFromHtml(websiteData.html, fullUrl);

      // Merge with sitemap URLs, deduplicate
      const existingUrls = new Set([fullUrl, ...urlPool]);
      let newLinksAdded = 0;
      for (const link of discoveredLinks) {
        if (!existingUrls.has(link)) {
          urlPool.push(link);
          existingUrls.add(link);
          newLinksAdded++;
        }
      }

      urlSource = urlPool.length === newLinksAdded ? 'link_discovery' : 'combined';
      emitThought(
        'Link Discovery',
        `${discoveredLinks.length} Links aus Homepage extrahiert`,
        `Neu hinzugefügt: ${newLinksAdded} | Total Pool: ${urlPool.length}`
      );
      emitAgentComplete('Link Discovery', {
        discoveredLinks: discoveredLinks.length,
        newLinksAdded,
        totalPool: urlPool.length,
        source: urlSource,
      });
    }

    // Run multi-page analysis if we have enough URLs (5+)
    if (urlPool.length >= 5) {
      emitThought(
        'Page Sampler',
        'Wähle diverse Seiten für Analyse...',
        `Pool: ${urlPool.length} URLs (Quelle: ${urlSource})`
      );

      const sampledPages = selectDiversePages(
        [fullUrl, ...urlPool],
        10, // Analyze 10 pages
        fullUrl
      );

      emitThought(
        'Page Sampler',
        `${sampledPages.urls.length} diverse Seiten ausgewählt`,
        Object.entries(sampledPages.categories)
          .filter(([, urls]) => urls.length > 0)
          .map(([cat, urls]) => `${cat}: ${urls.length}`)
          .join(', ')
      );

      emitAgentComplete('Page Sampler', {
        selectedCount: sampledPages.urls.length,
        categories: Object.keys(sampledPages.categories).length,
      });

      // Fetch all selected pages in parallel
      emitThought('Multi-Page Fetcher', `Lade ${sampledPages.urls.length} Seiten parallel...`);

      const pageDataArray = await fetchPages(sampledPages.urls, {
        timeout: 10000,
        maxConcurrent: 5,
        onProgress: (completed, total) => {
          if (completed % 3 === 0 || completed === total) {
            emitThought('Multi-Page Fetcher', `${completed}/${total} Seiten geladen`);
          }
        },
      });

      const successfulPages = pageDataArray.filter(p => !p.error);
      emitThought(
        'Multi-Page Fetcher',
        `${successfulPages.length}/${pageDataArray.length} Seiten erfolgreich geladen`,
        pageDataArray
          .filter(p => p.error)
          .map(p => p.error)
          .slice(0, 3)
          .join(', ') || undefined
      );

      emitAgentComplete('Multi-Page Fetcher', {
        successful: successfulPages.length,
        failed: pageDataArray.length - successfulPages.length,
      });

      // Analyze tech stack on all pages
      if (successfulPages.length > 0) {
        emitThought('Multi-Page Tech Analyzer', 'Analysiere Tech Stack auf allen Seiten...');

        const techResults = successfulPages.map(page => analyzePageTech(page));
        const aggregatedTech = aggregateTechResults(techResults);

        emitThought(
          'Multi-Page Tech Analyzer',
          aggregatedTech.cms
            ? `CMS: ${aggregatedTech.cms.name} (${aggregatedTech.cms.detectedOn}/${aggregatedTech.pagesAnalyzed} Seiten, ${aggregatedTech.cms.confidence}% Confidence)`
            : 'Kein CMS eindeutig erkannt',
          [
            aggregatedTech.framework && `Framework: ${aggregatedTech.framework.name}`,
            aggregatedTech.backend.length > 0 &&
              `Backend: ${aggregatedTech.backend.map(b => b.name).join(', ')}`,
          ]
            .filter(Boolean)
            .join(' | ') || undefined
        );

        emitAgentComplete('Multi-Page Tech Analyzer', {
          cms: aggregatedTech.cms?.name,
          confidence: aggregatedTech.cms?.confidence,
          pagesAnalyzed: aggregatedTech.pagesAnalyzed,
        });

        // Extract UI components
        emitThought('Component Extractor', 'Extrahiere UI-Komponenten...');

        const extractedComponents = extractComponents(successfulPages);

        emitThought(
          'Component Extractor',
          `${extractedComponents.summary.totalComponents} Komponenten gefunden`,
          `${extractedComponents.summary.uniquePatterns} Muster | Komplexität: ${extractedComponents.summary.complexity}`
        );

        emitAgentComplete('Component Extractor', {
          components: extractedComponents.summary.totalComponents,
          patterns: extractedComponents.summary.uniquePatterns,
          complexity: extractedComponents.summary.complexity,
        });

        multiPageData = {
          sampledPages,
          pageDataArray,
          aggregatedTech,
          extractedComponents,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 1.3: ANALYSIS (All analyses in parallel)
    // ═══════════════════════════════════════════════════════════════════════════════
    emitPhase('analysis', 'Führe alle Analysen parallel aus...');
    emitAnalysisComplete(
      'multiPage',
      !!multiPageData,
      Date.now() - multiPageStart,
      multiPageData ? `${multiPageData.pageDataArray.length} Seiten analysiert` : 'Single-Page Mode'
    );

    emitThought(
      'Coordinator',
      'Starte parallele Analyse...',
      '1. Tech Stack Analyse\n2. Content Volume Analyse\n3. Feature Detection'
    );

    // Tech Stack Analysis with progress
    emitThought(
      'Tech Stack Analyzer',
      'Analysiere Technology Stack...',
      multiPageData?.aggregatedTech
        ? 'Verwende Multi-Page-Analyse-Ergebnisse'
        : websiteData.wappalyzerResults.length >= 3
          ? 'Verwende Wappalyzer-Ergebnisse'
          : 'Starte AI-gestützte Analyse'
    );

    // Run analyses in parallel
    const [techStack, contentVolume, features] = await Promise.all([
      detectTechStack(websiteData, emit),
      analyzeContentVolume(websiteData),
      detectFeatures(websiteData.html),
    ]);

    // Track which method provided the final CMS detection
    let cmsDetectionSource: 'wappalyzer' | 'multi-page' | 'httpx-fallback' | 'single-page' =
      techStack.cms ? 'wappalyzer' : 'single-page';

    // Merge multi-page tech results into techStack if available
    if (multiPageData?.aggregatedTech) {
      const mpTech = multiPageData.aggregatedTech;

      // Only override if multi-page has higher confidence
      if (
        mpTech.cms &&
        (!techStack.cms || mpTech.cms.confidence > (techStack.cmsConfidence || 0))
      ) {
        techStack.cms = mpTech.cms.name;
        techStack.cmsVersion = mpTech.cms.version;
        techStack.cmsConfidence = mpTech.cms.confidence;
        cmsDetectionSource = 'multi-page';
      }

      if (mpTech.framework && !techStack.framework) {
        techStack.framework = mpTech.framework.name;
        techStack.frameworkVersion = mpTech.framework.version;
      }

      // Merge libraries
      if (mpTech.libraries.length > 0) {
        const existingLibs = new Set(techStack.libraries || []);
        for (const lib of mpTech.libraries) {
          existingLibs.add(lib.name);
        }
        techStack.libraries = Array.from(existingLibs);
      }

      // Update overall confidence
      if (mpTech.overallConfidence > (techStack.overallConfidence || 0)) {
        techStack.overallConfidence = mpTech.overallConfidence;
      }
    }

    // Report Tech Stack results
    const techSummary = [
      techStack.cms && `CMS: ${techStack.cms}`,
      techStack.framework && `Framework: ${techStack.framework}`,
      techStack.hosting && `Hosting: ${techStack.hosting}`,
      techStack.server && `Server: ${techStack.server}`,
    ]
      .filter(Boolean)
      .join(' | ');

    emitThought(
      'Tech Stack Analyzer',
      techStack.cms ? `Tech Stack erkannt: ${techStack.cms}` : 'Kein CMS eindeutig erkannt',
      techSummary || 'Minimale Tech-Stack-Informationen verfügbar'
    );

    // Report libraries if found
    if (techStack.libraries && techStack.libraries.length > 0) {
      emitThought(
        'Tech Stack Analyzer',
        `${techStack.libraries.length} JavaScript Libraries gefunden`,
        techStack.libraries.slice(0, 5).join(', ')
      );
    }

    // Report Content Volume results
    emitThought(
      'Content Analyzer',
      `${contentVolume.estimatedPageCount} Seiten geschätzt`,
      `Komplexität: ${contentVolume.complexity?.toUpperCase() || 'unbekannt'}`
    );

    if (contentVolume.contentTypes && contentVolume.contentTypes.length > 0) {
      const contentBreakdown = contentVolume.contentTypes
        .slice(0, 3)
        .map(ct => `${ct.type}: ${ct.count}`)
        .join(', ');
      emitThought('Content Analyzer', 'Content-Typen analysiert', contentBreakdown);
    }

    if (contentVolume.languages && contentVolume.languages.length > 0) {
      emitThought(
        'Content Analyzer',
        `${contentVolume.languages.length} Sprache(n) erkannt`,
        contentVolume.languages.join(', ')
      );
    }

    // Report Features results
    const detectedFeatures = [
      features.ecommerce && 'E-Commerce',
      features.userAccounts && 'Benutzerkonten',
      features.search && 'Suche',
      features.multiLanguage && 'Mehrsprachig',
      features.blog && 'Blog',
      features.forms && 'Formulare',
      features.api && 'API',
    ].filter(Boolean);

    emitThought(
      'Feature Detector',
      `${detectedFeatures.length} Kern-Features erkannt`,
      detectedFeatures.join(', ') || 'Keine speziellen Features'
    );

    if (features.customFeatures && features.customFeatures.length > 0) {
      emitThought(
        'Feature Detector',
        'Weitere Features gefunden',
        features.customFeatures.join(', ')
      );
    }

    // Mark Phase 3 analysis agents as complete
    emitAgentComplete('Tech Stack Analyzer', techStack);
    emitAgentComplete('Content Analyzer', contentVolume);
    emitAgentComplete('Feature Detector', features);

    // === PHASE 3.5: Intelligent Research (Web Search + GitHub API) ===
    // Initialize intelligent tools for verification and enrichment
    const intelligentTools = createIntelligentTools({
      emit,
      agentName: 'Researcher',
    });

    // Web Search for CMS verification if detected
    if (techStack.cms) {
      emitThought('Researcher', `Verifiziere ${techStack.cms} via Web Search...`);

      try {
        // Search for CMS info and latest version
        const searchResults = await intelligentTools.webSearch(
          `${techStack.cms} CMS latest version features 2024`,
          5
        );

        if (searchResults && searchResults.length > 0) {
          emitThought(
            'Researcher',
            `${searchResults.length} Web-Ergebnisse für ${techStack.cms}`,
            searchResults
              .slice(0, 2)
              .map(r => r.title || 'Untitled')
              .join(' | ')
          );
        }

        // GitHub API for CMS if known repo exists
        const cmsLower = techStack.cms.toLowerCase();
        const knownRepoUrl = KNOWN_GITHUB_REPOS[cmsLower];

        if (knownRepoUrl) {
          emitThought('Researcher', `Prüfe ${techStack.cms} auf GitHub...`);

          const repoInfo = await intelligentTools.githubRepo(knownRepoUrl);

          if (repoInfo && !repoInfo.error) {
            if (repoInfo.latestVersion) {
              techStack.cmsVersion = repoInfo.latestVersion;
              emitThought(
                'Researcher',
                `${techStack.cms} aktuelle Version: ${repoInfo.latestVersion}`,
                `GitHub Stars: ${repoInfo.githubStars?.toLocaleString() || 'N/A'}`
              );
            }
          }
        }
      } catch (error) {
        // Non-critical: Continue without verification
        emitThought(
          'Researcher',
          'Web-Recherche übersprungen',
          error instanceof Error ? error.message : 'Fehler bei Recherche'
        );
      }
    }

    // Additional page discovery if sitemap is limited
    if (websiteData.sitemapUrls.length < 10) {
      emitThought('Researcher', 'Wenige Seiten in Sitemap, suche weitere via Web Search...');

      try {
        const siteSearch = await intelligentTools.webSearch(
          `site:${new URL(fullUrl).hostname}`,
          20
        );

        if (siteSearch && siteSearch.length > 0) {
          const additionalUrls = siteSearch.map(r => r.url).filter((url): url is string => !!url);

          if (additionalUrls.length > websiteData.sitemapUrls.length) {
            emitThought(
              'Researcher',
              `${additionalUrls.length} zusätzliche Seiten via Web Search gefunden`,
              'Ergänze Content-Analyse'
            );
            // Merge with existing URLs (deduplicated)
            const allUrls = [...new Set([...websiteData.sitemapUrls, ...additionalUrls])];
            websiteData.sitemapUrls = allUrls.slice(0, 500);
          }
        }
      } catch {
        // Continue without additional pages
      }
    }

    emitAgentComplete('Researcher', {
      cmsVerified: !!techStack.cmsVersion,
      additionalPages: websiteData.sitemapUrls.length,
    });

    // === PHASE 4: Enhanced Audits (Playwright + Company Intel) ===
    let playwrightResult: PlaywrightAuditResult | null = null;
    let companyIntel: CompanyIntelligence | undefined;
    let navigationStructure: NavigationStructure | undefined;
    let accessibilityAudit: AccessibilityAudit | undefined;
    let screenshots: Screenshots | undefined;
    let seoAudit: SEOAudit | undefined;
    let legalCompliance: LegalCompliance | undefined;
    let performanceIndicators: PerformanceIndicators | undefined;
    // QualificationScan 2.0 variables - NEW
    let contentTypes: ContentTypeDistribution | undefined;
    let migrationComplexity: MigrationComplexity | undefined;
    let decisionMakersResult: DecisionMakersResearch | undefined;
    // Raw data for debugging
    const rawScanData: QualificationScanResult['rawScanData'] = {
      wappalyzer: websiteData.wappalyzerResults,
      sitemapUrls: websiteData.sitemapUrls,
    };

    // Phase 2: Extract company name with fallback chain
    // 1. Try to extract from HTML (og:site_name, JSON-LD, title)
    // 2. Fallback to customerName from extractedRequirements
    // 3. Fallback to domain name
    const extractedCompanyName = extractCompanyName(websiteData.html, fullUrl);
    const customerNameFromRfp = input.extractedRequirements?.customerName;
    const companyName = extractedCompanyName || customerNameFromRfp || null;

    // Run enhanced audits in parallel
    emitThought(
      'Coordinator',
      'Starte erweiterte Analysen...',
      '1. Screenshots & A11y (Playwright)\n2. SEO & Legal Audit\n3. Company Intelligence\n4. QualificationScan 2.0: Content Types, Migration, Decision Makers'
    );

    try {
      // Run Playwright audit for screenshots + accessibility + navigation + performance
      emitThought(
        'Playwright',
        'Starte Browser-basierte Analyse...',
        'Screenshots, Accessibility, Navigation, Performance'
      );

      // Quick content type estimation from URLs (no AI, fast)
      const quickContentEstimate =
        websiteData.sitemapUrls.length > 0
          ? estimateContentTypesFromUrls(websiteData.sitemapUrls)
          : null;

      const [
        playwrightRes,
        seoRes,
        legalRes,
        perfRes,
        companyRes,
        enhancedTechRes,
        httpxRes,
        contentTypesRes,
        migrationRes,
        decisionMakersRes,
      ] = await Promise.allSettled([
        runPlaywrightAudit(fullUrl, input.bidId || 'temp', {
          takeScreenshots: true,
          runAccessibilityAudit: true,
          analyzeNavigation: true,
        }),
        performSEOAudit(websiteData.html, fullUrl),
        performLegalComplianceCheck(websiteData.html),
        analyzePerformanceIndicators(websiteData.html),
        companyName
          ? gatherCompanyIntelligence(companyName, fullUrl, websiteData.html)
          : Promise.resolve(null),
        detectEnhancedTechStack(fullUrl),
        runHttpxTechDetection(fullUrl),
        // QualificationScan 2.0 Tools - NEW
        websiteData.sitemapUrls.length > 10
          ? classifyContentTypes(websiteData.sitemapUrls, { sampleSize: 15 })
          : Promise.resolve(null), // Skip AI classification if too few URLs
        analyzeMigrationComplexity({
          techStack,
          pageCount: contentVolume.estimatedPageCount ?? 1,
          features: {
            ecommerce: features.ecommerce ?? false,
            userAccounts: features.userAccounts ?? false,
            multiLanguage: features.multiLanguage ?? false,
            search: features.search ?? false,
            forms: features.forms ?? false,
            api: features.api ?? false,
          },
          html: websiteData.html,
        }),
        companyName ? searchDecisionMakers(companyName, fullUrl) : Promise.resolve(null),
      ]);

      // Process Playwright results
      if (playwrightRes.status === 'fulfilled' && playwrightRes.value) {
        playwrightResult = playwrightRes.value;

        // Screenshots
        if (playwrightResult.screenshots.desktop || playwrightResult.screenshots.mobile) {
          screenshots = screenshotsSchema.parse({
            homepage: {
              desktop: playwrightResult.screenshots.desktop,
              mobile: playwrightResult.screenshots.mobile,
            },
            keyPages: playwrightResult.screenshots.keyPages,
            timestamp: new Date().toISOString(),
          });

          emitThought(
            'Playwright',
            'Screenshots erstellt',
            `Desktop: ${playwrightResult.screenshots.desktop ? '✓' : '✗'} | Mobile: ${playwrightResult.screenshots.mobile ? '✓' : '✗'}`
          );
        }

        // Accessibility from Playwright
        if (playwrightResult.accessibility) {
          const a11y = playwrightResult.accessibility;
          accessibilityAudit = accessibilityAuditSchema.parse({
            score: a11y.score,
            level: a11y.level,
            criticalIssues: a11y.violations.filter(v => v.impact === 'critical').length,
            seriousIssues: a11y.violations.filter(v => v.impact === 'serious').length,
            moderateIssues: a11y.violations.filter(v => v.impact === 'moderate').length,
            minorIssues: a11y.violations.filter(v => v.impact === 'minor').length,
            checks: {
              hasAltTexts: !a11y.violations.some(v => v.id === 'image-alt'),
              hasAriaLabels: !a11y.violations.some(v => v.id.includes('aria')),
              hasProperHeadings: !a11y.violations.some(v => v.id.includes('heading')),
              hasSkipLinks: a11y.passes > 0,
              colorContrast: a11y.violations.some(v => v.id === 'color-contrast') ? 'fail' : 'pass',
              keyboardNavigation: a11y.violations.some(v => v.id.includes('keyboard'))
                ? 'fail'
                : 'pass',
              formLabels: a11y.violations.some(v => v.id.includes('label')) ? 'fail' : 'pass',
              languageAttribute: !a11y.violations.some(v => v.id === 'html-has-lang'),
            },
            topIssues: a11y.violations.slice(0, 5).map(v => ({
              type: v.id,
              count: v.nodes,
              severity: v.impact,
              description: v.description,
            })),
            recommendations: a11y.violations.slice(0, 3).map(v => v.description),
          });

          emitThought(
            'Accessibility Audit',
            `Score: ${a11y.score}/100 - Level: ${a11y.level}`,
            `${a11y.violations.length} Probleme gefunden, ${a11y.passes} Tests bestanden`
          );
        }

        // Navigation structure - with URLs and hierarchy
        if (playwrightResult.navigation) {
          const nav = playwrightResult.navigation;
          // Count total items (handling both string[] and object[] formats)
          const totalItems = nav.mainNav.length + nav.footerNav.length;

          // Convert string items to NavItem objects if needed
          type NavItem = { label: string; url?: string; children?: NavItem[] };
          const normalizeNav = (items: (string | NavItem)[]): NavItem[] =>
            items.map(item =>
              typeof item === 'string'
                ? { label: item }
                : { label: item.label, url: item.url, children: item.children }
            );

          navigationStructure = navigationStructureSchema.parse({
            mainNav: normalizeNav(nav.mainNav as (string | NavItem)[]),
            footerNav: normalizeNav(nav.footerNav as (string | NavItem)[]).map(item => ({
              label: item.label,
              url: item.url,
            })),
            hasSearch: nav.hasSearch,
            hasBreadcrumbs: nav.hasBreadcrumbs,
            hasMegaMenu: nav.hasMegaMenu,
            maxDepth: nav.maxDepth,
            totalItems,
          });

          // Count items with URLs (only for object items)
          const normalizedMainNav = normalizeNav(nav.mainNav as (string | NavItem)[]);
          const urlCount =
            normalizedMainNav.filter(i => i.url).length +
            normalizedMainNav.reduce(
              (sum, i) => sum + (i.children?.filter((c: NavItem) => c.url).length || 0),
              0
            );

          emitThought(
            'Navigation Analyzer',
            `${nav.mainNav.length} Haupt-Navigation Items (${urlCount} mit URLs)`,
            `Tiefe: ${nav.maxDepth} | Suche: ${nav.hasSearch ? '✓' : '✗'} | Mega-Menu: ${nav.hasMegaMenu ? '✓' : '✗'}`
          );
        }

        // Performance from Playwright
        if (playwrightResult.performance) {
          const perf = playwrightResult.performance;
          performanceIndicators = performanceIndicatorsSchema.parse({
            htmlSize: Math.round(websiteData.html.length / 1024),
            resourceCount: perf.resourceCount,
            estimatedLoadTime:
              perf.loadTime < 2000 ? 'fast' : perf.loadTime < 5000 ? 'medium' : 'slow',
            hasLazyLoading: /loading=["']lazy["']/i.test(websiteData.html),
            hasMinification: websiteData.html.length < 50000 || !/\n\s{4,}/g.test(websiteData.html),
            hasCaching: Boolean(websiteData.headers['cache-control']),
            renderBlockingResources: perf.resourceCount.scripts + perf.resourceCount.stylesheets,
          });

          emitThought(
            'Performance Analyzer',
            `Ladezeit: ${perf.loadTime}ms - ${performanceIndicators.estimatedLoadTime}`,
            `Scripts: ${perf.resourceCount.scripts} | CSS: ${perf.resourceCount.stylesheets} | Images: ${perf.resourceCount.images}`
          );
        }
      } else {
        emitThought(
          'Playwright',
          'Browser-Analyse übersprungen',
          playwrightRes.status === 'rejected'
            ? (playwrightRes.reason as Error).message
            : 'Keine Ergebnisse'
        );
      }

      // Process SEO results
      if (seoRes.status === 'fulfilled' && seoRes.value) {
        seoAudit = seoRes.value;
        emitThought(
          'SEO Audit',
          `Score: ${seoAudit.score}/100`,
          `Title: ${seoAudit.checks.hasTitle ? '✓' : '✗'} | Meta: ${seoAudit.checks.hasMetaDescription ? '✓' : '✗'} | Sitemap: ${seoAudit.checks.hasSitemap ? '✓' : '✗'}`
        );
      }

      // Process Legal results
      if (legalRes.status === 'fulfilled' && legalRes.value) {
        legalCompliance = legalRes.value;
        emitThought(
          'Legal Compliance',
          `Score: ${legalCompliance.score}/100`,
          `Impressum: ${legalCompliance.checks.hasImprint ? '✓' : '✗'} | Datenschutz: ${legalCompliance.checks.hasPrivacyPolicy ? '✓' : '✗'} | Cookie Banner: ${legalCompliance.checks.hasCookieBanner ? '✓' : '✗'}`
        );
      }

      // Process Performance results (fallback if Playwright didn't provide)
      if (perfRes.status === 'fulfilled' && perfRes.value && !performanceIndicators) {
        performanceIndicators = perfRes.value;
      }

      // Process Company Intelligence
      if (companyRes.status === 'fulfilled' && companyRes.value) {
        companyIntel = companyRes.value;
        emitThought(
          'Company Intelligence',
          `Unternehmensdaten: ${companyIntel.basicInfo.name}`,
          `Branche: ${companyIntel.basicInfo.industry || 'unbekannt'} | Mitarbeiter: ${companyIntel.basicInfo.employeeCount || 'unbekannt'}`
        );

        if (companyIntel.newsAndReputation?.recentNews?.length) {
          emitThought(
            'Company Intelligence',
            `${companyIntel.newsAndReputation.recentNews.length} aktuelle News gefunden`,
            companyIntel.newsAndReputation.recentNews[0]?.title || ''
          );
        }
      }

      // Process Enhanced Tech Stack from Playwright
      if (enhancedTechRes.status === 'fulfilled' && enhancedTechRes.value) {
        const enhancedTech = enhancedTechRes.value;

        // Apply available fields from EnhancedTechStackResult
        if (enhancedTech.cms) {
          techStack.cms = enhancedTech.cms.name;
        }
        if (enhancedTech.framework) {
          techStack.framework = enhancedTech.framework.name;
        }
        if (enhancedTech.cdn) {
          techStack.cdnProviders = [enhancedTech.cdn];
        }
        if (enhancedTech.hosting) {
          techStack.hosting = enhancedTech.hosting;
        }
        if (enhancedTech.analytics.length > 0) {
          techStack.analytics = enhancedTech.analytics;
        }

        // Map libraries to JavaScript frameworks if detected
        const jsLibraries = enhancedTech.libraries.filter(lib =>
          ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'gatsby'].some(fw =>
            lib.name.toLowerCase().includes(fw)
          )
        );
        if (jsLibraries.length > 0) {
          techStack.javascriptFrameworks = jsLibraries.map(lib => ({
            name: lib.name,
            confidence: lib.confidence,
          }));
          const jsFrameworks = jsLibraries
            .map(f => `${f.name}${f.version ? ` (${f.version})` : ''}`)
            .join(', ');
          emitThought(
            'Enhanced Tech Stack',
            `${jsLibraries.length} JavaScript Framework(s) erkannt`,
            jsFrameworks
          );
        }

        // Map libraries to CSS frameworks if detected
        const cssLibraries = enhancedTech.libraries.filter(lib =>
          ['tailwind', 'bootstrap', 'bulma', 'material', 'foundation'].some(css =>
            lib.name.toLowerCase().includes(css)
          )
        );
        if (cssLibraries.length > 0) {
          techStack.cssFrameworks = cssLibraries.map(lib => ({
            name: lib.name,
            confidence: lib.confidence,
          }));
          const cssFrameworks = cssLibraries
            .map(f => `${f.name}${f.version ? ` (${f.version})` : ''}`)
            .join(', ');
          emitThought(
            'Enhanced Tech Stack',
            `${cssLibraries.length} CSS Framework(s) erkannt`,
            cssFrameworks
          );
        }

        // Report CMS if detected
        if (enhancedTech.cms) {
          emitThought(
            'Enhanced Tech Stack',
            `CMS erkannt: ${enhancedTech.cms.name}`,
            `Confidence: ${enhancedTech.cms.confidence}%`
          );
        }

        // Report analytics
        if (enhancedTech.analytics.length > 0) {
          emitThought(
            'Enhanced Tech Stack',
            'Analytics erkannt',
            enhancedTech.analytics.join(', ')
          );
        }

        // Report CDN if detected
        if (enhancedTech.cdn) {
          emitThought('Enhanced Tech Stack', 'CDN-Provider', enhancedTech.cdn);
        }
      }

      // Process httpx Tech Detection
      if (httpxRes.status === 'fulfilled' && httpxRes.value) {
        const httpxTech = httpxRes.value;
        const detectedTechs = httpxTech.technologies.map(t => t.name);

        emitThought(
          'httpx Tech Detection',
          `${httpxTech.technologies.length} Technologien erkannt`,
          detectedTechs.slice(0, 10).join(', ') +
            (httpxTech.technologies.length > 10
              ? ` (+${httpxTech.technologies.length - 10} weitere)`
              : '')
        );

        // Map httpx technologies to TechStack categories
        for (const tech of httpxTech.technologies) {
          const techName = tech.name.toLowerCase();

          // CMS - httpx hat 100% Confidence und überschreibt niedrigere Signature-Confidence
          if (
            techName.includes('cms') ||
            techName.includes('drupal') ||
            techName.includes('wordpress') ||
            techName.includes('typo3') ||
            techName.includes('joomla') ||
            techName.includes('kentico') ||
            techName.includes('sitecore') ||
            techName.includes('umbraco') ||
            techName.includes('aem') ||
            techName.includes('tridion') ||
            techName.includes('magnolia') ||
            techName.includes('contentful')
          ) {
            // FIX: httpx überschreibt niedrigere Confidence (z.B. AEM durch /content/ matched mit 55%)
            const httpxConfidence = 100; // httpx ist sehr zuverlässig
            if (
              !techStack.cms ||
              (techStack.cmsConfidence && techStack.cmsConfidence < httpxConfidence)
            ) {
              techStack.cms = tech.name;
              techStack.cmsConfidence = httpxConfidence;
              cmsDetectionSource = 'httpx-fallback';
            }
          }

          // Frameworks
          if (
            techName.includes('react') ||
            techName.includes('vue') ||
            techName.includes('angular') ||
            techName.includes('jquery') ||
            techName.includes('bootstrap') ||
            techName.includes('tailwind')
          ) {
            if (!techStack.libraries) techStack.libraries = [];
            if (!techStack.libraries.includes(tech.name)) {
              techStack.libraries.push(tech.name);
            }
          }

          // Backend
          if (
            techName.includes('.net') ||
            techName.includes('asp') ||
            techName.includes('php') ||
            techName.includes('java') ||
            techName.includes('python') ||
            techName.includes('node')
          ) {
            if (!techStack.backend) techStack.backend = [];
            if (!techStack.backend.includes(tech.name)) {
              techStack.backend.push(tech.name);
            }
          }

          // Server
          if (
            techName.includes('iis') ||
            techName.includes('nginx') ||
            techName.includes('apache')
          ) {
            techStack.server = tech.name;
          }

          // CDN
          if (
            techName.includes('cloudflare') ||
            techName.includes('cloudfront') ||
            techName.includes('fastly') ||
            techName.includes('akamai') ||
            techName.includes('cdn') ||
            techName.includes('cdnjs')
          ) {
            if (!techStack.cdn) {
              techStack.cdn = tech.name;
            }
            if (!techStack.cdnProviders) techStack.cdnProviders = [];
            if (!techStack.cdnProviders.includes(tech.name)) {
              techStack.cdnProviders.push(tech.name);
            }
          }

          // Hosting
          if (
            techName.includes('aws') ||
            techName.includes('azure') ||
            techName.includes('google cloud') ||
            techName.includes('heroku') ||
            techName.includes('vercel') ||
            techName.includes('netlify')
          ) {
            techStack.hosting = tech.name;
          }

          // Analytics
          if (
            techName.includes('analytics') ||
            techName.includes('google analytics') ||
            techName.includes('gtag') ||
            techName.includes('gtm')
          ) {
            if (!techStack.analytics) techStack.analytics = [];
            if (!techStack.analytics.includes(tech.name)) {
              techStack.analytics.push(tech.name);
            }
          }
        }

        // Store raw httpx data
        rawScanData.httpx = httpxTech;
      }

      // === QualificationScan 2.0 Results Processing - NEW ===

      // Process Content Types
      if (contentTypesRes.status === 'fulfilled' && contentTypesRes.value) {
        contentTypes = contentTypesRes.value;
        emitThought(
          'Content Classifier',
          `${contentTypes.distribution?.length || 0} Content-Typen klassifiziert`,
          `Komplexität: ${contentTypes.complexity} | Dominanter Typ: ${contentTypes.distribution?.[0]?.type || 'unbekannt'}`
        );
      } else if (quickContentEstimate) {
        // Fallback to quick estimation
        const uniqueTypes = Object.keys(quickContentEstimate.estimated).length;
        contentTypes = {
          pagesAnalyzed: websiteData.sitemapUrls.length,
          distribution: Object.entries(quickContentEstimate.estimated).map(([type, count]) => ({
            type: type as any,
            count,
            percentage: Math.round((count / websiteData.sitemapUrls.length) * 100),
            examples: [],
          })),
          complexity: quickContentEstimate.complexity,
          estimatedContentTypes: uniqueTypes,
          customFieldsNeeded: uniqueTypes * 2,
          recommendations: [],
        };
        emitThought(
          'Content Classifier',
          `${uniqueTypes} Content-Typen geschätzt (URL-basiert)`,
          `Komplexität: ${quickContentEstimate.complexity}`
        );
      }

      // Process Migration Complexity
      if (migrationRes.status === 'fulfilled' && migrationRes.value) {
        migrationComplexity = migrationRes.value;
        emitThought(
          'Migration Analyzer',
          `Komplexität: ${migrationComplexity.recommendation} (Score: ${migrationComplexity.score}/100)`,
          `Geschätzte PT: ${migrationComplexity.estimatedEffort?.minPT}-${migrationComplexity.estimatedEffort?.maxPT} | ${migrationComplexity.warnings?.length || 0} Warnungen`
        );
      }

      // Process Decision Makers
      if (decisionMakersRes.status === 'fulfilled' && decisionMakersRes.value) {
        decisionMakersResult = decisionMakersRes.value;
        const contactCount = decisionMakersResult.decisionMakers?.length || 0;
        const emailCount = decisionMakersResult.decisionMakers?.filter(d => d.email).length || 0;
        emitThought(
          'Decision Maker Research',
          `${contactCount} Entscheidungsträger gefunden`,
          `${emailCount} E-Mails | Quellen: ${decisionMakersResult.researchQuality?.sources?.join(', ') || 'keine'}`
        );
      }

      // Store raw Playwright data
      if (playwrightResult) {
        rawScanData.playwright = {
          screenshots: playwrightResult.screenshots,
          accessibility: playwrightResult.accessibility,
          navigation: playwrightResult.navigation,
        };
      }
    } catch (error) {
      emitThought(
        'Warning',
        'Einige erweiterte Analysen fehlgeschlagen',
        error instanceof Error ? error.message : 'Unbekannter Fehler'
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 2: SYNTHESIS - BL Recommendation (LETZTE Aktion, hat alle Daten)
    // ═══════════════════════════════════════════════════════════════════════════════
    emitPhase('synthesis', 'Erstelle Gesamtbild und BL-Empfehlung...');

    emitThought(
      'Business Analyst',
      'Generiere Business Line Empfehlung...',
      'Analysiere Tech Stack, Content, Features und Company Intelligence für optimale BL-Zuordnung'
    );

    emitThought(
      'AI Reasoning',
      'Starte AI-Analyse für Empfehlung...',
      'Berücksichtige: Technologie-Expertise, Projekt-Komplexität, Feature-Anforderungen, Unternehmensprofil'
    );

    const blRecommendationStart = Date.now();
    const blRecommendation = await recommendBusinessLine({
      techStack,
      contentVolume,
      features,
      extractedRequirements: input.extractedRequirements,
      contextSection,
      cachedBusinessUnits, // Use pre-loaded BUs from bootstrap (no extra DB query)
    });
    emitAnalysisComplete('blRecommendation', true, Date.now() - blRecommendationStart);

    // Report recommendation reasoning
    emitThought(
      'Business Analyst',
      `Empfehlung: ${blRecommendation.primaryBusinessLine}`,
      `Confidence: ${blRecommendation.confidence}%`
    );

    emitThought('AI Reasoning', 'Begründung', blRecommendation.reasoning);

    if (
      blRecommendation.alternativeBusinessLines &&
      blRecommendation.alternativeBusinessLines.length > 0
    ) {
      const alternatives = blRecommendation.alternativeBusinessLines
        .map(alt => `${alt.name} (${alt.confidence}%)`)
        .join(', ');
      emitThought('Business Analyst', 'Alternative Business Lines', alternatives);
    }

    if (blRecommendation.requiredSkills && blRecommendation.requiredSkills.length > 0) {
      emitThought(
        'Business Analyst',
        'Benötigte Skills',
        blRecommendation.requiredSkills.join(', ')
      );
    }

    // Mark Business Analyst as complete
    emitAgentComplete('Business Analyst', blRecommendation);

    // === PHASE 5.5: Evaluator-Optimizer Loop ===
    // Build results object for evaluation
    let finalResults = {
      techStack,
      contentVolume,
      features,
      blRecommendation,
      navigationStructure,
      accessibilityAudit,
      seoAudit,
      legalCompliance,
      performanceIndicators,
      screenshots,
      companyIntelligence: companyIntel,
      contentTypes,
      migrationComplexity,
      decisionMakers: decisionMakersResult,
      // Multi-Page Analysis fields (NEW)
      extractedComponents: multiPageData?.extractedComponents ?? undefined,
      multiPageAnalysis: multiPageData
        ? {
            pagesAnalyzed: multiPageData.pageDataArray.filter(p => !p.error).length,
            analyzedUrls: multiPageData.sampledPages.urls,
            pageCategories: multiPageData.sampledPages.categories,
            detectionMethod:
              cmsDetectionSource === 'httpx-fallback' ? 'httpx-fallback' : 'multi-page',
            analysisTimestamp: new Date().toISOString(),
          }
        : {
            pagesAnalyzed: 1,
            analyzedUrls: [fullUrl],
            detectionMethod: cmsDetectionSource,
            analysisTimestamp: new Date().toISOString(),
          },
    };

    // Quick evaluation to check if optimization is needed
    const quickEval = quickEvaluate(finalResults, {
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
      context: 'QualificationScan Website Analysis',
    });

    emitThought(
      'Evaluator',
      `Qualitäts-Score: ${quickEval.score}/100`,
      quickEval.issues.length > 0
        ? `${quickEval.issues.length} Verbesserungen möglich`
        : 'Alle Kriterien erfüllt'
    );

    // If score is low and improvements are possible, run optimizer
    if (quickEval.score < 70 && quickEval.canImprove) {
      emitThought('Optimizer', 'Starte Optimierung...', quickEval.issues.slice(0, 3).join(', '));

      try {
        const optimization = await optimizeQualificationScanResults(
          finalResults,
          {
            qualityScore: quickEval.score,
            confidencesMet: quickEval.issues.length === 0,
            completeness: quickEval.score,
            issues: quickEval.issues.map(issue => ({
              area: issue.split(':')[0] || 'general',
              severity: 'major' as const,
              description: issue,
              suggestion: 'Verbessere über zusätzliche Recherche',
              canAutoFix: true,
            })),
            canImprove: true,
            summary: `Score ${quickEval.score}/100`,
          },
          intelligentTools,
          { emit, agentName: 'Optimizer' }
        );

        if (optimization.finalScore > quickEval.score) {
          finalResults = { ...finalResults, ...optimization.optimized };
          emitThought(
            'Optimizer',
            `Optimierung erfolgreich: ${optimization.finalScore}/100`,
            optimization.improvements.join(', ')
          );
        }
      } catch (error) {
        // Non-critical: Continue with original results
        emitThought(
          'Optimizer',
          'Optimierung übersprungen',
          error instanceof Error ? error.message : 'Fehler'
        );
      }
    }

    emitAgentComplete('Evaluator', { score: quickEval.score, issues: quickEval.issues.length });

    // === PHASE 6: Completion ===
    emit({
      type: AgentEventType.AGENT_COMPLETE,
      data: {
        agent: 'Quick Scan',
        result: {
          techStack,
          contentVolume,
          features,
          blRecommendation,
          navigationStructure,
          accessibilityAudit,
          seoAudit,
          legalCompliance,
          performanceIndicators,
          screenshots,
          companyIntelligence: companyIntel,
          // QualificationScan 2.0 fields
          contentTypes,
          migrationComplexity,
          decisionMakers: decisionMakersResult,
          // Multi-Page Analysis fields (NEW)
          extractedComponents: multiPageData?.extractedComponents ?? undefined,
          multiPageAnalysis: multiPageData
            ? {
                pagesAnalyzed: multiPageData.pageDataArray.filter(p => !p.error).length,
                analyzedUrls: multiPageData.sampledPages.urls,
                pageCategories: multiPageData.sampledPages.categories,
                detectionMethod:
                  cmsDetectionSource === 'httpx-fallback' ? 'httpx-fallback' : 'multi-page',
                analysisTimestamp: new Date().toISOString(),
              }
            : {
                pagesAnalyzed: 1,
                analyzedUrls: [fullUrl],
                detectionMethod: cmsDetectionSource,
                analysisTimestamp: new Date().toISOString(),
              },
        },
        confidence: blRecommendation.confidence,
      },
    });

    logActivity('Quick Scan erfolgreich abgeschlossen');

    // Debug-Logging for QualificationScan 2.0 fields
    console.log('[QualificationScan Agent] Result Summary:', {
      hasContentTypes: !!contentTypes,
      contentTypesCount: contentTypes?.distribution?.length || 0,
      hasMigrationComplexity: !!migrationComplexity,
      migrationScore: migrationComplexity?.score || null,
      hasDecisionMakers: !!decisionMakersResult,
      decisionMakersCount: decisionMakersResult?.decisionMakers?.length || 0,
      hasRawScanData: !!rawScanData,
      // Multi-Page Analysis fields
      hasMultiPageAnalysis: !!multiPageData,
      pagesAnalyzed: multiPageData?.pageDataArray.filter(p => !p.error).length || 0,
      hasExtractedComponents: !!multiPageData?.extractedComponents,
      componentsCount: multiPageData?.extractedComponents?.summary?.totalComponents || 0,
    });

    return {
      techStack,
      contentVolume,
      features,
      blRecommendation,
      navigationStructure,
      accessibilityAudit,
      seoAudit,
      legalCompliance,
      performanceIndicators,
      screenshots,
      companyIntelligence: companyIntel,
      // QualificationScan 2.0 fields
      contentTypes,
      migrationComplexity,
      decisionMakers: decisionMakersResult,
      // Multi-Page Analysis fields (NEW)
      extractedComponents: multiPageData?.extractedComponents ?? undefined,
      multiPageAnalysis: multiPageData
        ? {
            pagesAnalyzed: multiPageData.pageDataArray.filter(p => !p.error).length,
            analyzedUrls: multiPageData.sampledPages.urls,
            pageCategories: multiPageData.sampledPages.categories,
            detectionMethod:
              cmsDetectionSource === 'httpx-fallback' ? 'httpx-fallback' : 'multi-page',
            analysisTimestamp: new Date().toISOString(),
          }
        : {
            pagesAnalyzed: 1,
            analyzedUrls: [fullUrl],
            detectionMethod: cmsDetectionSource,
            analysisTimestamp: new Date().toISOString(),
          },
      rawScanData,
      activityLog,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    logActivity('Quick Scan fehlgeschlagen', errorMsg);

    emitThought('Error', 'Quick Scan Fehler aufgetreten', errorMsg);

    emit({
      type: AgentEventType.ERROR,
      data: {
        message: errorMsg,
        code: 'QUICK_SCAN_ERROR',
      },
    });
    throw error;
  }
}
