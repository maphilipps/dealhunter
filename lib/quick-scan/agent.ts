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
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';
import { validateUrlForFetch } from '@/lib/utils/url-validation';
import { runPlaywrightAudit, runHttpxTechDetection, detectEnhancedTechStack, type PlaywrightAuditResult, type HttpxTechResult, type EnhancedTechStackResult } from './tools/playwright';
import { runTechStackDetection } from '@/lib/tech-stack/agent';
import { gatherCompanyIntelligence } from './tools/company-research';
import { buildAgentContext, formatContextForPrompt } from '@/lib/agent-tools/context-builder';
// QuickScan 2.0 Tools - NEW
import { classifyContentTypes, estimateContentTypesFromUrls } from './tools/content-classifier';
import { analyzeMigrationComplexity } from './tools/migration-analyzer';
import { searchDecisionMakers } from './tools/decision-maker-research';
import type { ContentTypeDistribution, MigrationComplexity, DecisionMakersResearch } from './schema';

async function callAI<T>(systemPrompt: string, userPrompt: string, schema: any, contextSection?: string): Promise<T> {
  const fullSystemPrompt = contextSection ? `${systemPrompt}\n\n${contextSection}` : systemPrompt;
  
  return generateStructuredOutput({
    schema,
    system: fullSystemPrompt,
    prompt: userPrompt,
  });
}

export interface QuickScanInput {
  websiteUrl: string;
  extractedRequirements?: any;
  bidId?: string;
  userId?: string;
}

export interface QuickScanResult {
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
  // QuickScan 2.0 fields - NEW
  contentTypes?: ContentTypeDistribution;
  migrationComplexity?: MigrationComplexity;
  decisionMakers?: DecisionMakersResearch;
  // Raw data for debugging/reprocessing
  rawScanData?: {
    wappalyzer?: any[];
    httpx?: any;
    playwright?: any;
    sitemapUrls?: string[];
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
export async function runQuickScan(input: QuickScanInput): Promise<QuickScanResult> {
  const activityLog: QuickScanResult['activityLog'] = [];

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
    }
  }

  try {
    logActivity('Starting Quick Scan', `URL: ${input.websiteUrl}`);

    logActivity('Fetching website content, headers, and sitemap');
    const websiteData = await fetchWebsiteData(input.websiteUrl);

    if (!websiteData.html) {
      throw new Error('Failed to fetch website content');
    }

    logActivity('Running parallel analysis: tech stack, content volume, and features');
    const [techStack, contentVolume, features] = await Promise.all([
      detectTechStack(websiteData),
      analyzeContentVolume(websiteData),
      detectFeatures(websiteData.html),
    ]);

    logActivity('Generating business line recommendation');
    const blRecommendation = await recommendBusinessLine({
      techStack,
      contentVolume,
      features,
      extractedRequirements: input.extractedRequirements,
      contextSection,
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
    // Fetch main page with headers
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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

    // Run Wappalyzer analysis
    try {
      // simple-wappalyzer returns array directly
      const wappalyzerResult = wappalyzer({
        url: fullUrl,
        html: result.html,
        headers: result.headers,
      });
      // Ensure we always have an array
      result.wappalyzerResults = Array.isArray(wappalyzerResult) ? wappalyzerResult : [];
    } catch (e) {
      console.error('Wappalyzer error:', e);
      result.wappalyzerResults = [];
    }

    // Try to fetch sitemap
    const sitemapResult = await fetchSitemapUrls(fullUrl);
    result.sitemapUrls = sitemapResult.urls;
    result.sitemapFound = sitemapResult.found;
    result.sitemapUrl = sitemapResult.sitemapUrl;

  } catch (error) {
    console.error('Fetch error:', error);
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
  const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml', '/page-sitemap.xml'];
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
      wappalyzerResults: data.wappalyzerResults.map((t) => ({
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
  const server = data.headers['server'] || (techByCategory['Web servers'] || []).map(t => t.name)[0];

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
    backend: techStackResult.backend?.length ? techStackResult.backend : (backend.length > 0 ? backend : undefined),
    hosting: techStackResult.hosting ?? hosting,
    cdn: techStackResult.cdn ?? cdn,
    server: techStackResult.server ?? server,
    libraries: techStackResult.libraries?.length ? techStackResult.libraries : (libraries.length > 0 ? libraries : undefined),
    analytics: techStackResult.analytics?.length ? techStackResult.analytics : (analytics.length > 0 ? analytics : undefined),
    marketing: techStackResult.marketing?.length ? techStackResult.marketing : (marketing.length > 0 ? marketing : undefined),
    overallConfidence: techStackResult.overallConfidence ?? Math.round(
      data.wappalyzerResults.reduce((sum, t) => sum + t.confidence, 0) /
      Math.max(data.wappalyzerResults.length, 1)
    ),
  });
}

/**
 * AI fallback for tech stack detection - robust version with comprehensive analysis
 */
async function detectTechStackWithAI(html: string, url: string, headers: Record<string, string>): Promise<TechStack> {
  const htmlSnippet = extractTechIndicators(html);
  const headerInfo = Object.entries(headers)
    .filter(([k]) => ['server', 'x-powered-by', 'x-generator', 'x-drupal-cache', 'x-wordpress', 'x-aspnet', 'x-frame'].some(h => k.toLowerCase().includes(h)))
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
    'WordPress': ['/wp-content/', '/wp-includes/', 'wp-json', 'wordpress'],
    'Drupal': ['/sites/default/', '/modules/', '/themes/', 'drupal', 'Drupal.'],
    'Typo3': ['/typo3/', '/fileadmin/', 'TYPO3'],
    'Joomla': ['/components/', '/modules/', '/templates/', 'joomla'],
    'Sitecore': ['/sitecore/', '/-/media/', 'scItemId'],
    'Adobe AEM': ['/content/dam/', '/etc/designs/', 'cq:', 'granite'],
    'Contentful': ['contentful', 'ctfl'],
    'Strapi': ['strapi'],
    'Sanity': ['sanity.io', 'cdn.sanity.io'],
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
    'React': ['data-reactroot', 'react-dom', '__REACT_DEVTOOLS'],
    'Vue.js': ['__VUE__', 'v-cloak', 'data-v-'],
    'Angular': ['ng-version', 'ng-app', '_ngcontent'],
    'Nuxt.js': ['__NUXT__', '_nuxt/'],
    'Gatsby': ['gatsby-', '__gatsby'],
    'Svelte': ['__svelte'],
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

  return patterns.join('\n') || 'Keine spezifischen Patterns erkannt - Analyse basiert auf allgemeinen HTML-Strukturen';
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
  const complexity = estimateComplexity(estimatedPageCount, data.wappalyzerResults.length, data.html);

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
  const langPatterns = ['/en/', '/de/', '/fr/', '/es/', '/it/', '/nl/', '/ar/', '/zh/', '/ja/', '/ko/'];
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
function estimateComplexity(pageCount: number, techCount: number, html: string): 'low' | 'medium' | 'high' {
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
 * Detect features from HTML
 */
async function detectFeatures(html: string): Promise<Features> {
  const htmlLower = html.toLowerCase();

  // E-Commerce: Cart, Shop, Product pages
  const ecommercePatterns = /cart|checkout|add-to-cart|warenkorb|kasse|shop|woocommerce|shopify|magento|produkt|product|bestellen|order|preis|price|€|\$|ecommerce|e-commerce|online-shop|webshop/i;
  
  // User Accounts: Login areas, account pages
  const userAccountPatterns = /login|signin|sign-in|sign-up|signup|register|account|anmelden|registrieren|mein-konto|my-account|passwort|password|logout|abmelden|profil|profile|member|mitglied/i;
  
  // Search: Search forms, search functionality
  const searchPatterns = /<input[^>]*type=["']search["']|search-form|searchbox|suche|suchfeld|search|recherche|such-|find|finden/i;
  
  // Multi-Language: Language indicators (more permissive)
  const multiLangPatterns = /hreflang|language-switcher|lang-switch|\/en\/|\/de\/|\/fr\/|\/es\/|\/it\/|sprache|language|lang=|xml:lang|translate|übersetzung|i18n|locale|multilingual/i;
  
  // Blog/News: Blog sections (more permissive - just needs indicators, not WordPress classes)
  const blogPatterns = /blog|news|artikel|article|beitrag|beiträge|post|posts|aktuelles|pressemitteilung|press|media|magazine|magazin|insights|updates|neuigkeiten/i;
  
  // Forms: Contact forms, newsletter, any form with action
  const formPatterns = /<form[^>]*>/i;
  const contactFormPatterns = /contact|kontakt|newsletter|subscribe|anfrage|request|feedback|message|nachricht|formular|form|senden|submit|absenden/i;
  const hasForms = formPatterns.test(html) && contactFormPatterns.test(html);
  
  // API: API endpoints, GraphQL, REST indicators
  const apiPatterns = /api\.|\/api\/|graphql|swagger|rest|endpoint|webhook|integration|json|xml/i;
  
  // Mobile App: App store links, app download prompts
  const mobileAppPatterns = /app-store|play-store|itunes|google-play|download-app|mobile-app|ios-app|android-app|appstore|playstore/i;

  const features: Features = {
    ecommerce: ecommercePatterns.test(html),
    userAccounts: userAccountPatterns.test(html),
    search: searchPatterns.test(html),
    multiLanguage: multiLangPatterns.test(html),
    blog: blogPatterns.test(html),
    forms: hasForms,
    api: apiPatterns.test(html),
    mobileApp: mobileAppPatterns.test(html),
    customFeatures: detectCustomFeatures(htmlLower),
  };

  return featuresSchema.parse(features);
}

/**
 * Detect custom/notable features
 */
function detectCustomFeatures(html: string): string[] {
  const features: string[] = [];

  if (/chat|messenger|intercom|zendesk|freshdesk/i.test(html)) features.push('Live Chat');
  if (/map|google-maps|mapbox|openstreetmap/i.test(html)) features.push('Maps Integration');
  if (/video|youtube|vimeo|wistia/i.test(html)) features.push('Video Content');
  if (/social|facebook|twitter|linkedin|instagram/i.test(html)) features.push('Social Media Integration');
  if (/calendar|booking|reservation|termin/i.test(html)) features.push('Booking/Calendar');
  if (/payment|stripe|paypal|klarna/i.test(html)) features.push('Payment Integration');
  if (/download|\.pdf|whitepaper/i.test(html)) features.push('Downloadable Content');

  return features;
}

/**
 * Recommend business line based on analysis
 */
async function recommendBusinessLine(context: {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  extractedRequirements?: any;
  contextSection?: string;
}): Promise<BLRecommendation> {
  const systemPrompt = `Du bist ein Business Development Experte bei adesso SE, einem führenden IT-Beratungsunternehmen.
Antworte IMMER mit validem JSON ohne Markdown-Code-Blöcke.

WICHTIG: Gib immer eine fundierte Empfehlung ab, auch wenn die Datenlage begrenzt ist. Nutze dein Expertenwissen über typische Projekt-Patterns.`;

  const userPrompt = `Analysiere die Website-Daten und empfehle die optimale Business Line für dieses Projekt.

**Tech Stack:**
${JSON.stringify(context.techStack, null, 2)}

**Content Volume:**
${JSON.stringify(context.contentVolume, null, 2)}

**Features:**
${JSON.stringify(context.features, null, 2)}

${context.extractedRequirements ? `
**Extrahierte Anforderungen aus der Ausschreibung:**
${JSON.stringify(context.extractedRequirements, null, 2)}
` : '**Keine Ausschreibungsdaten verfügbar - Empfehlung basiert nur auf Website-Analyse**'}

**adesso Business Lines:**
- Banking & Insurance (Drupal CMS, komplexe Finanzsysteme, Compliance)
- Automotive (Industry 4.0, IoT, Connected Vehicles, E-Mobility)
- Energy & Utilities (Smart Grids, Energiemanagement, Nachhaltigkeit)
- Retail & E-Commerce (Online Shops, Omnichannel, PIM/DAM)
- Healthcare (Patientenportale, DiGA, ePA, medizinische Systeme)
- Public Sector (Behördenportale, OZG, Bürgerservices)
- Manufacturing (ERP, MES, Produktionssysteme)
- Technology & Innovation (Custom Development, Cloud Migration, Modernisierung)
- Microsoft (SharePoint, Dynamics 365, Azure, Power Platform)

**ANALYSE-KRITERIEN:**
1. Welche Business Line passt am besten zum erkannten Tech Stack?
2. Welche Branchen-Indikatoren sind erkennbar (Finanz, Gesundheit, Öffentlich, etc.)?
3. Welche Komplexität erfordert das Projekt?
4. Welche speziellen Kompetenzen werden benötigt?

**OUTPUT-ANFORDERUNGEN:**
- primaryBusinessLine: Die am besten passende Business Line
- confidence: Deine Sicherheit in Prozent (MUSS angegeben werden, 0-100)
- reasoning: Ausführliche Begründung auf Deutsch (min. 2-3 Sätze)
- alternativeBusinessLines: 2-3 alternative BLs mit Begründung
- requiredSkills: Konkrete Skills für dieses Projekt

Antworte mit JSON:
- primaryBusinessLine (string): Primär empfohlene Business Line
- confidence (number 0-100): Confidence in der Empfehlung
- reasoning (string): Deutsche Erklärung für die Empfehlung
- alternativeBusinessLines (array of {name: string, confidence: number, reason: string}): Alternativen mit deutscher Begründung
- requiredSkills (array of strings): Benötigte Skills für das Projekt`;

  return callAI<BLRecommendation>(systemPrompt, userPrompt, blRecommendationSchema, context.contextSection);
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
    'wp-content', 'wp-includes', 'drupal', 'typo3', 'joomla',
    'sites/default', 'magento', 'shopify', 'wix', 'squarespace',
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
  const issues: Array<{ type: string; count: number; severity: 'critical' | 'serious' | 'moderate' | 'minor'; description: string }> = [];

  // Check for images without alt text
  const imgRegex = /<img[^>]*>/gi;
  const images = html.match(imgRegex) || [];
  const imagesWithoutAlt = images.filter(img => !img.includes('alt=') || img.includes('alt=""') || img.includes("alt=''"));
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
    const text = link.replace(/<[^>]+>/g, '').trim().toLowerCase();
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
  const criticalIssues = issues.filter(i => i.severity === 'critical').reduce((sum, i) => sum + i.count, 0);
  const seriousIssues = issues.filter(i => i.severity === 'serious').reduce((sum, i) => sum + i.count, 0);
  const moderateIssues = issues.filter(i => i.severity === 'moderate').reduce((sum, i) => sum + i.count, 0);
  const minorIssues = issues.filter(i => i.severity === 'minor').reduce((sum, i) => sum + i.count, 0);

  // Calculate overall score (100 - penalties)
  const penalty = (criticalIssues * 10) + (seriousIssues * 5) + (moderateIssues * 2) + (minorIssues * 1);
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
      formLabels: inputs.length === 0 ? 'n/a' : (inputsWithoutLabel.length === 0 ? 'pass' : 'fail'),
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
  const ogSiteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  if (ogSiteNameMatch) {
    const name = ogSiteNameMatch[1].trim();
    if (name.length > 1 && !isGenericPageTitle(name)) return name;
  }

  // 2. Try JSON-LD structured data (schema.org Organization)
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
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
 * Check if a string is a generic page title that shouldn't be used as company name
 */
function isGenericPageTitle(text: string): boolean {
  const genericPatterns = [
    /^(startseite|home|homepage|willkommen|welcome|start)$/i,
    /^(aktuelles|news|blog|kontakt|contact|impressum|imprint|über uns|about|about us)$/i,
    /^(menü|menu|navigation)$/i,
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
  const parts = title.split(separators).map(p => p.trim()).filter(p => p.length > 0);

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
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const hasMetaDescription = !!metaDescMatch && metaDescMatch[1].trim().length > 0;
  const metaDescriptionLength = metaDescMatch ? metaDescMatch[1].trim().length : 0;

  // Check canonical
  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);

  // Check robots.txt (we assume based on URL patterns in the HTML)
  const hasRobotsTxt = true; // Would need actual fetch to verify

  // Check sitemap
  const hasSitemap = /<link[^>]*sitemap/i.test(html) || html.includes('sitemap.xml');

  // Check structured data
  const hasStructuredData = /application\/ld\+json/i.test(html) || /itemtype.*schema\.org/i.test(html);

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
  const issues: Array<{ type: string; severity: 'error' | 'warning' | 'info'; description: string }> = [];
  if (!hasTitle) issues.push({ type: 'missing-title', severity: 'error', description: 'Kein Title-Tag gefunden' });
  if (!hasMetaDescription) issues.push({ type: 'missing-meta-desc', severity: 'warning', description: 'Keine Meta-Description vorhanden' });
  if (!hasCanonical) issues.push({ type: 'missing-canonical', severity: 'info', description: 'Kein Canonical-Tag definiert' });
  if (!hasOpenGraph) issues.push({ type: 'missing-og', severity: 'info', description: 'Keine Open Graph Tags' });

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
  const hasImprint = /impressum|imprint|legal notice/i.test(html) &&
    (/<a[^>]*href=["'][^"']*impressum[^"']*["']/i.test(html) ||
     /<a[^>]*href=["'][^"']*imprint[^"']*["']/i.test(html));

  // Check for privacy policy
  const hasPrivacyPolicy = /datenschutz|privacy|dsgvo|gdpr/i.test(html) &&
    (/<a[^>]*href=["'][^"']*(datenschutz|privacy)[^"']*["']/i.test(html));

  // Check for cookie banner
  const hasCookieBanner = /cookie|consent|ccm19|cookiefirst|onetrust|usercentrics|borlabs|complianz/i.test(html);

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
  const issues: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; description: string }> = [];
  if (!hasImprint) issues.push({ type: 'missing-imprint', severity: 'critical', description: 'Kein Impressum gefunden (Pflicht in DE)' });
  if (!hasPrivacyPolicy) issues.push({ type: 'missing-privacy', severity: 'critical', description: 'Keine Datenschutzerklärung gefunden (DSGVO-Pflicht)' });
  if (!hasCookieBanner) issues.push({ type: 'missing-cookie-banner', severity: 'warning', description: 'Kein Cookie-Banner erkannt' });

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
  const renderBlockingScripts = (html.match(/<script(?![^>]*(?:defer|async))[^>]*src=/gi) || []).length;
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
export async function runQuickScanWithStreaming(
  input: QuickScanInput,
  emit: EventEmitter
): Promise<QuickScanResult> {
  const activityLog: QuickScanResult['activityLog'] = [];

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

  try {
    emitThought('Quick Scan', `Starte Quick Scan Analyse...`, `URL: ${input.websiteUrl}`);

    emitThought('Website Crawler', `Prüfe URL-Format und Sicherheit...`);
    const fullUrl = input.websiteUrl.startsWith('http') ? input.websiteUrl : `https://${input.websiteUrl}`;

    // === PHASE 2: Data Collection ===
    emitThought('Website Crawler', `Lade Website-Inhalt...`, fullUrl);

    const websiteData = await fetchWebsiteData(input.websiteUrl);

    if (!websiteData.html) {
      throw new Error('Website konnte nicht geladen werden');
    }

    const htmlSize = Math.round(websiteData.html.length / 1024);
    emitThought('Website Crawler', `Website geladen: ${htmlSize} KB HTML`,
      `${Object.keys(websiteData.headers).length} HTTP-Headers empfangen`);

    // Report Wappalyzer results
    if (websiteData.wappalyzerResults.length > 0) {
      const techNames = websiteData.wappalyzerResults.slice(0, 5).map(t => t.name).join(', ');
      emitThought('Wappalyzer',
        `${websiteData.wappalyzerResults.length} Technologien erkannt`,
        techNames + (websiteData.wappalyzerResults.length > 5 ? '...' : '')
      );
    } else {
      emitThought('Wappalyzer', 'Keine Technologien automatisch erkannt',
        'Verwende AI-Analyse als Fallback');
    }

    // Report sitemap results
    if (websiteData.sitemapUrls.length > 0) {
      emitThought('Sitemap Parser',
        `${websiteData.sitemapUrls.length} Seiten in Sitemap gefunden`,
        `Analysiere URL-Struktur und Content-Typen`
      );
    } else {
      emitThought('Sitemap Parser', 'Keine Sitemap gefunden',
        'Schätze Seitenanzahl aus Navigation');
    }

    // === PHASE 3: Parallel Analysis ===
    emitThought('Coordinator', 'Starte parallele Analyse...',
      '1. Tech Stack Analyse\n2. Content Volume Analyse\n3. Feature Detection');

    // Tech Stack Analysis with progress
    emitThought('Tech Stack Analyzer', 'Analysiere Technology Stack...',
      websiteData.wappalyzerResults.length >= 3
        ? 'Verwende Wappalyzer-Ergebnisse'
        : 'Starte AI-gestützte Analyse'
    );

    // Run analyses in parallel
    const [techStack, contentVolume, features] = await Promise.all([
      detectTechStack(websiteData, emit),
      analyzeContentVolume(websiteData),
      detectFeatures(websiteData.html),
    ]);

    // Report Tech Stack results
    const techSummary = [
      techStack.cms && `CMS: ${techStack.cms}`,
      techStack.framework && `Framework: ${techStack.framework}`,
      techStack.hosting && `Hosting: ${techStack.hosting}`,
      techStack.server && `Server: ${techStack.server}`,
    ].filter(Boolean).join(' | ');

    emitThought('Tech Stack Analyzer',
      techStack.cms ? `Tech Stack erkannt: ${techStack.cms}` : 'Kein CMS eindeutig erkannt',
      techSummary || 'Minimale Tech-Stack-Informationen verfügbar'
    );

    // Report libraries if found
    if (techStack.libraries && techStack.libraries.length > 0) {
      emitThought('Tech Stack Analyzer',
        `${techStack.libraries.length} JavaScript Libraries gefunden`,
        techStack.libraries.slice(0, 5).join(', ')
      );
    }

    // Report Content Volume results
    emitThought('Content Analyzer',
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
      emitThought('Content Analyzer',
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

    emitThought('Feature Detector',
      `${detectedFeatures.length} Kern-Features erkannt`,
      detectedFeatures.join(', ') || 'Keine speziellen Features'
    );

    if (features.customFeatures && features.customFeatures.length > 0) {
      emitThought('Feature Detector',
        'Weitere Features gefunden',
        features.customFeatures.join(', ')
      );
    }

    // === PHASE 4: Enhanced Audits (Playwright + Company Intel) ===
    let playwrightResult: PlaywrightAuditResult | null = null;
    let companyIntel: CompanyIntelligence | undefined;
    let navigationStructure: NavigationStructure | undefined;
    let accessibilityAudit: AccessibilityAudit | undefined;
    let screenshots: Screenshots | undefined;
    let seoAudit: SEOAudit | undefined;
    let legalCompliance: LegalCompliance | undefined;
    let performanceIndicators: PerformanceIndicators | undefined;
    // QuickScan 2.0 variables - NEW
    let contentTypes: ContentTypeDistribution | undefined;
    let migrationComplexity: MigrationComplexity | undefined;
    let decisionMakersResult: DecisionMakersResearch | undefined;
    // Raw data for debugging
    let rawScanData: QuickScanResult['rawScanData'] = {
      wappalyzer: websiteData.wappalyzerResults,
      sitemapUrls: websiteData.sitemapUrls,
    };

    // Extract company name for research
    const companyName = extractCompanyName(websiteData.html, fullUrl);

    // Run enhanced audits in parallel
    emitThought('Coordinator', 'Starte erweiterte Analysen...',
      '1. Screenshots & A11y (Playwright)\n2. SEO & Legal Audit\n3. Company Intelligence\n4. QuickScan 2.0: Content Types, Migration, Decision Makers');

    try {
      // Run Playwright audit for screenshots + accessibility + navigation + performance
      emitThought('Playwright', 'Starte Browser-basierte Analyse...',
        'Screenshots, Accessibility, Navigation, Performance');

      // Quick content type estimation from URLs (no AI, fast)
      const quickContentEstimate = websiteData.sitemapUrls.length > 0
        ? estimateContentTypesFromUrls(websiteData.sitemapUrls)
        : null;

      const [playwrightRes, seoRes, legalRes, perfRes, companyRes, enhancedTechRes, httpxRes, contentTypesRes, migrationRes, decisionMakersRes] = await Promise.allSettled([
        runPlaywrightAudit(fullUrl, input.bidId || 'temp', {
          takeScreenshots: true,
          runAccessibilityAudit: true,
          analyzeNavigation: true,
        }),
        performSEOAudit(websiteData.html, fullUrl),
        performLegalComplianceCheck(websiteData.html),
        analyzePerformanceIndicators(websiteData.html),
        companyName ? gatherCompanyIntelligence(companyName, fullUrl, websiteData.html) : Promise.resolve(null),
        detectEnhancedTechStack(fullUrl),
        runHttpxTechDetection(fullUrl),
        // QuickScan 2.0 Tools - NEW
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
        companyName
          ? searchDecisionMakers(companyName, fullUrl)
          : Promise.resolve(null),
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

          emitThought('Playwright', 'Screenshots erstellt',
            `Desktop: ${playwrightResult.screenshots.desktop ? '✓' : '✗'} | Mobile: ${playwrightResult.screenshots.mobile ? '✓' : '✗'}`);
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
              keyboardNavigation: a11y.violations.some(v => v.id.includes('keyboard')) ? 'fail' : 'pass',
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

          emitThought('Accessibility Audit',
            `Score: ${a11y.score}/100 - Level: ${a11y.level}`,
            `${a11y.violations.length} Probleme gefunden, ${a11y.passes} Tests bestanden`);
        }

        // Navigation structure - with URLs and hierarchy
        if (playwrightResult.navigation) {
          const nav = playwrightResult.navigation;
          // Count total items including children
          const totalItems = nav.mainNav.reduce(
            (sum, item) => sum + 1 + (item.children?.length || 0),
            nav.footerNav.length
          );

          navigationStructure = navigationStructureSchema.parse({
            mainNav: nav.mainNav.map(item => ({
              label: item.label,
              url: item.url,
              children: item.children?.map(child => ({
                label: child.label,
                url: child.url,
              })),
            })),
            footerNav: nav.footerNav.map(item => ({
              label: item.label,
              url: item.url,
            })),
            hasSearch: nav.hasSearch,
            hasBreadcrumbs: nav.hasBreadcrumbs,
            hasMegaMenu: nav.hasMegaMenu,
            maxDepth: nav.maxDepth,
            totalItems,
          });

          // Count items with URLs
          const urlCount = nav.mainNav.filter(i => i.url).length +
            nav.mainNav.reduce((sum, i) => sum + (i.children?.filter(c => c.url).length || 0), 0);

          emitThought('Navigation Analyzer',
            `${nav.mainNav.length} Haupt-Navigation Items (${urlCount} mit URLs)`,
            `Tiefe: ${nav.maxDepth} | Suche: ${nav.hasSearch ? '✓' : '✗'} | Mega-Menu: ${nav.hasMegaMenu ? '✓' : '✗'}`);
        }

        // Performance from Playwright
        if (playwrightResult.performance) {
          const perf = playwrightResult.performance;
          performanceIndicators = performanceIndicatorsSchema.parse({
            htmlSize: Math.round(websiteData.html.length / 1024),
            resourceCount: perf.resourceCount,
            estimatedLoadTime: perf.loadTime < 2000 ? 'fast' : perf.loadTime < 5000 ? 'medium' : 'slow',
            hasLazyLoading: /loading=["']lazy["']/i.test(websiteData.html),
            hasMinification: websiteData.html.length < 50000 || !/\n\s{4,}/g.test(websiteData.html),
            hasCaching: Boolean(websiteData.headers['cache-control']),
            renderBlockingResources: perf.resourceCount.scripts + perf.resourceCount.stylesheets,
          });

          emitThought('Performance Analyzer',
            `Ladezeit: ${perf.loadTime}ms - ${performanceIndicators.estimatedLoadTime}`,
            `Scripts: ${perf.resourceCount.scripts} | CSS: ${perf.resourceCount.stylesheets} | Images: ${perf.resourceCount.images}`);
        }
      } else {
        emitThought('Playwright', 'Browser-Analyse übersprungen',
          playwrightRes.status === 'rejected' ? (playwrightRes.reason as Error).message : 'Keine Ergebnisse');
      }

      // Process SEO results
      if (seoRes.status === 'fulfilled' && seoRes.value) {
        seoAudit = seoRes.value;
        emitThought('SEO Audit',
          `Score: ${seoAudit.score}/100`,
          `Title: ${seoAudit.checks.hasTitle ? '✓' : '✗'} | Meta: ${seoAudit.checks.hasMetaDescription ? '✓' : '✗'} | Sitemap: ${seoAudit.checks.hasSitemap ? '✓' : '✗'}`);
      }

      // Process Legal results
      if (legalRes.status === 'fulfilled' && legalRes.value) {
        legalCompliance = legalRes.value;
        emitThought('Legal Compliance',
          `Score: ${legalCompliance.score}/100`,
          `Impressum: ${legalCompliance.checks.hasImprint ? '✓' : '✗'} | Datenschutz: ${legalCompliance.checks.hasPrivacyPolicy ? '✓' : '✗'} | Cookie Banner: ${legalCompliance.checks.hasCookieBanner ? '✓' : '✗'}`);
      }

      // Process Performance results (fallback if Playwright didn't provide)
      if (perfRes.status === 'fulfilled' && perfRes.value && !performanceIndicators) {
        performanceIndicators = perfRes.value;
      }

      // Process Company Intelligence
      if (companyRes.status === 'fulfilled' && companyRes.value) {
        companyIntel = companyRes.value;
        emitThought('Company Intelligence',
          `Unternehmensdaten: ${companyIntel.basicInfo.name}`,
          `Branche: ${companyIntel.basicInfo.industry || 'unbekannt'} | Mitarbeiter: ${companyIntel.basicInfo.employeeCount || 'unbekannt'}`);

        if (companyIntel.newsAndReputation?.recentNews?.length) {
          emitThought('Company Intelligence',
            `${companyIntel.newsAndReputation.recentNews.length} aktuelle News gefunden`,
            companyIntel.newsAndReputation.recentNews[0]?.title || '');
        }
      }

      // Process Enhanced Tech Stack from Playwright
      if (enhancedTechRes.status === 'fulfilled' && enhancedTechRes.value) {
        const enhancedTech = enhancedTechRes.value;

        techStack.javascriptFrameworks = enhancedTech.javascriptFrameworks;
        techStack.cssFrameworks = enhancedTech.cssFrameworks;
        techStack.apiEndpoints = enhancedTech.apiEndpoints;
        techStack.headlessCms = enhancedTech.headlessCms;
        techStack.serverSideRendering = enhancedTech.serverSideRendering;
        techStack.buildTools = enhancedTech.buildTools;
        techStack.cdnProviders = enhancedTech.cdnUsage;

        if (enhancedTech.javascriptFrameworks.length > 0) {
          const jsFrameworks = enhancedTech.javascriptFrameworks
            .map(f => `${f.name}${f.version ? ` (${f.version})` : ''}`)
            .join(', ');
          emitThought('Enhanced Tech Stack',
            `${enhancedTech.javascriptFrameworks.length} JavaScript Framework(s) erkannt`,
            jsFrameworks);
        }

        if (enhancedTech.cssFrameworks.length > 0) {
          const cssFrameworks = enhancedTech.cssFrameworks
            .map(f => `${f.name}${f.version ? ` (${f.version})` : ''}`)
            .join(', ');
          emitThought('Enhanced Tech Stack',
            `${enhancedTech.cssFrameworks.length} CSS Framework(s) erkannt`,
            cssFrameworks);
        }

        if (enhancedTech.apiEndpoints.rest.length > 0 || enhancedTech.apiEndpoints.graphql) {
          const apiInfo = [
            enhancedTech.apiEndpoints.rest.length > 0 && `${enhancedTech.apiEndpoints.rest.length} REST Endpoint(s)`,
            enhancedTech.apiEndpoints.graphql && `GraphQL${enhancedTech.apiEndpoints.graphqlEndpoint ? `: ${enhancedTech.apiEndpoints.graphqlEndpoint}` : ''}`,
          ].filter(Boolean).join(', ');
          emitThought('Enhanced Tech Stack', 'APIs entdeckt', apiInfo);
        }

        if (enhancedTech.headlessCms.length > 0) {
          emitThought('Enhanced Tech Stack', 'Headless CMS erkannt', enhancedTech.headlessCms.join(', '));
        }

        if (enhancedTech.serverSideRendering) {
          emitThought('Enhanced Tech Stack', 'Server-Side Rendering', 'SSR aktiv erkannt');
        }

        if (enhancedTech.buildTools.length > 0) {
          emitThought('Enhanced Tech Stack', 'Build Tools erkannt', enhancedTech.buildTools.join(', '));
        }

        if (enhancedTech.cdnUsage.length > 0) {
          emitThought('Enhanced Tech Stack', 'CDN-Provider', enhancedTech.cdnUsage.join(', '));
        }
      }

      // Process httpx Tech Detection
      if (httpxRes.status === 'fulfilled' && httpxRes.value) {
        const httpxTech = httpxRes.value;
        const detectedTechs = httpxTech.technologies.map(t => t.name);

        emitThought('httpx Tech Detection',
          `${httpxTech.technologies.length} Technologien erkannt`,
          detectedTechs.slice(0, 10).join(', ') + (httpxTech.technologies.length > 10 ? ` (+${httpxTech.technologies.length - 10} weitere)` : ''));

        // Map httpx technologies to TechStack categories
        for (const tech of httpxTech.technologies) {
          const techName = tech.name.toLowerCase();

          // CMS - httpx hat 100% Confidence und überschreibt niedrigere Signature-Confidence
          if (techName.includes('cms') || techName.includes('drupal') || techName.includes('wordpress') ||
              techName.includes('typo3') || techName.includes('joomla') || techName.includes('kentico') ||
              techName.includes('sitecore') || techName.includes('umbraco') || techName.includes('aem') ||
              techName.includes('tridion') || techName.includes('magnolia') || techName.includes('contentful')) {
            // FIX: httpx überschreibt niedrigere Confidence (z.B. AEM durch /content/ matched mit 55%)
            const httpxConfidence = 100; // httpx ist sehr zuverlässig
            if (!techStack.cms || (techStack.cmsConfidence && techStack.cmsConfidence < httpxConfidence)) {
              techStack.cms = tech.name;
              techStack.cmsVersion = tech.version;
              techStack.cmsConfidence = httpxConfidence;
            }
          }

          // Frameworks
          if (techName.includes('react') || techName.includes('vue') || techName.includes('angular') ||
              techName.includes('jquery') || techName.includes('bootstrap') || techName.includes('tailwind')) {
            if (!techStack.libraries) techStack.libraries = [];
            if (!techStack.libraries.includes(tech.name)) {
              techStack.libraries.push(tech.name);
            }
          }

          // Backend
          if (techName.includes('.net') || techName.includes('asp') || techName.includes('php') ||
              techName.includes('java') || techName.includes('python') || techName.includes('node')) {
            if (!techStack.backend) techStack.backend = [];
            if (!techStack.backend.includes(tech.name)) {
              techStack.backend.push(tech.name);
            }
          }

          // Server
          if (techName.includes('iis') || techName.includes('nginx') || techName.includes('apache')) {
            techStack.server = tech.name;
          }

          // CDN
          if (techName.includes('cloudflare') || techName.includes('cloudfront') ||
              techName.includes('fastly') || techName.includes('akamai') ||
              techName.includes('cdn') || techName.includes('cdnjs')) {
            if (!techStack.cdn) {
              techStack.cdn = tech.name;
            }
            if (!techStack.cdnProviders) techStack.cdnProviders = [];
            if (!techStack.cdnProviders.includes(tech.name)) {
              techStack.cdnProviders.push(tech.name);
            }
          }

          // Hosting
          if (techName.includes('aws') || techName.includes('azure') || techName.includes('google cloud') ||
              techName.includes('heroku') || techName.includes('vercel') || techName.includes('netlify')) {
            techStack.hosting = tech.name;
          }

          // Analytics
          if (techName.includes('analytics') || techName.includes('google analytics') ||
              techName.includes('gtag') || techName.includes('gtm')) {
            if (!techStack.analytics) techStack.analytics = [];
            if (!techStack.analytics.includes(tech.name)) {
              techStack.analytics.push(tech.name);
            }
          }
        }

        // Store raw httpx data
        rawScanData.httpx = httpxTech;
      }

      // === QuickScan 2.0 Results Processing - NEW ===

      // Process Content Types
      if (contentTypesRes.status === 'fulfilled' && contentTypesRes.value) {
        contentTypes = contentTypesRes.value;
        emitThought('Content Classifier',
          `${contentTypes.distribution?.length || 0} Content-Typen klassifiziert`,
          `Komplexität: ${contentTypes.complexity} | Dominanter Typ: ${contentTypes.distribution?.[0]?.type || 'unbekannt'}`);
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
        emitThought('Content Classifier',
          `${uniqueTypes} Content-Typen geschätzt (URL-basiert)`,
          `Komplexität: ${quickContentEstimate.complexity}`);
      }

      // Process Migration Complexity
      if (migrationRes.status === 'fulfilled' && migrationRes.value) {
        migrationComplexity = migrationRes.value;
        emitThought('Migration Analyzer',
          `Komplexität: ${migrationComplexity.recommendation} (Score: ${migrationComplexity.score}/100)`,
          `Geschätzte PT: ${migrationComplexity.estimatedEffort?.minPT}-${migrationComplexity.estimatedEffort?.maxPT} | ${migrationComplexity.warnings?.length || 0} Warnungen`);
      }

      // Process Decision Makers
      if (decisionMakersRes.status === 'fulfilled' && decisionMakersRes.value) {
        decisionMakersResult = decisionMakersRes.value;
        const contactCount = decisionMakersResult.decisionMakers?.length || 0;
        const emailCount = decisionMakersResult.decisionMakers?.filter(d => d.email).length || 0;
        emitThought('Decision Maker Research',
          `${contactCount} Entscheidungsträger gefunden`,
          `${emailCount} E-Mails | Quellen: ${decisionMakersResult.researchQuality?.sources?.join(', ') || 'keine'}`);
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
      emitThought('Warning', 'Einige erweiterte Analysen fehlgeschlagen',
        error instanceof Error ? error.message : 'Unbekannter Fehler');
    }

    // === PHASE 5: Business Line Recommendation ===
    emitThought('Business Analyst',
      'Generiere Business Line Empfehlung...',
      'Analysiere Tech Stack, Content, Features und Company Intelligence für optimale BL-Zuordnung'
    );

    emitThought('AI Reasoning',
      'Starte AI-Analyse für Empfehlung...',
      'Berücksichtige: Technologie-Expertise, Projekt-Komplexität, Feature-Anforderungen, Unternehmensprofil'
    );

    const blRecommendation = await recommendBusinessLine({
      techStack,
      contentVolume,
      features,
      extractedRequirements: input.extractedRequirements,
      contextSection,
    });

    // Report recommendation reasoning
    emitThought('Business Analyst',
      `Empfehlung: ${blRecommendation.primaryBusinessLine}`,
      `Confidence: ${blRecommendation.confidence}%`
    );

    emitThought('AI Reasoning',
      'Begründung',
      blRecommendation.reasoning
    );

    if (blRecommendation.alternativeBusinessLines && blRecommendation.alternativeBusinessLines.length > 0) {
      const alternatives = blRecommendation.alternativeBusinessLines
        .map(alt => `${alt.name} (${alt.confidence}%)`)
        .join(', ');
      emitThought('Business Analyst', 'Alternative Business Lines', alternatives);
    }

    if (blRecommendation.requiredSkills && blRecommendation.requiredSkills.length > 0) {
      emitThought('Business Analyst',
        'Benötigte Skills',
        blRecommendation.requiredSkills.join(', ')
      );
    }

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
          // QuickScan 2.0 fields - NEW
          contentTypes,
          migrationComplexity,
          decisionMakers: decisionMakersResult,
        },
        confidence: blRecommendation.confidence,
      },
    });

    logActivity('Quick Scan erfolgreich abgeschlossen');

    // Debug-Logging for QuickScan 2.0 fields
    console.log('[QuickScan Agent] Result Summary:', {
      hasContentTypes: !!contentTypes,
      contentTypesCount: contentTypes?.distribution?.length || 0,
      hasMigrationComplexity: !!migrationComplexity,
      migrationScore: migrationComplexity?.score || null,
      hasDecisionMakers: !!decisionMakersResult,
      decisionMakersCount: decisionMakersResult?.decisionMakers?.length || 0,
      hasRawScanData: !!rawScanData,
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
      // QuickScan 2.0 fields - NEW
      contentTypes,
      migrationComplexity,
      decisionMakers: decisionMakersResult,
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
