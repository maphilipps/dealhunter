/**
 * Browser-based auditing tools using agent-browser CLI
 * Provides screenshots, accessibility audits, and performance metrics
 */

import { mkdir } from 'fs/promises';
import { join } from 'path';

import {
  openPage,
  closeBrowser,
  screenshot,
  setViewport,
  evaluate,
  getPageContent,
  createSession,
  wait,
  type BrowserSession,
} from '@/lib/browser';
import { runAccessibilityAudit } from '@/lib/browser/accessibility';
import { dismissCookieBanner } from '@/lib/browser/cookie-banner';
import { getPerformanceMetrics } from '@/lib/browser/performance';

// ========================================
// Types
// ========================================

export interface PlaywrightAuditResult {
  screenshots: {
    desktop?: string;
    mobile?: string;
    keyPages: Array<{ url: string; title: string; screenshot: string }>;
  };
  accessibility: {
    score: number;
    level: 'A' | 'AA' | 'AAA' | 'fail';
    violations: Array<{
      id: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      nodes: number;
      helpUrl: string;
    }>;
    passes: number;
    incomplete: number;
  };
  performance: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    ttfb?: number;
    inp?: number;
    fcp?: number;
    resourceCount: {
      scripts: number;
      stylesheets: number;
      images: number;
      fonts: number;
      total: number;
    };
    totalSize: number;
    ratings?: {
      lcp: 'good' | 'needs-improvement' | 'poor' | null;
      cls: 'good' | 'needs-improvement' | 'poor' | null;
      fid: 'good' | 'needs-improvement' | 'poor' | null;
      inp: 'good' | 'needs-improvement' | 'poor' | null;
      ttfb: 'good' | 'needs-improvement' | 'poor' | null;
    };
  };
  navigation: {
    mainNav: string[];
    footerNav: string[];
    hasSearch: boolean;
    hasBreadcrumbs: boolean;
    hasMegaMenu: boolean;
    maxDepth: number;
  };
}

// ========================================
// HTML Fetching
// ========================================

/**
 * Fetch HTML from a URL using agent-browser
 * Used as fallback when simple fetch() fails due to bot protection
 */
export async function fetchHtmlWithPlaywright(url: string): Promise<{
  html: string;
  headers: Record<string, string>;
  finalUrl: string;
}> {
  const session = createSession('fetch');

  try {
    const opened = await openPage(url, session);
    if (!opened) {
      return { html: '', headers: {}, finalUrl: url };
    }

    // Wait for page to stabilize
    await wait(2000);

    // Dismiss cookie banner
    await dismissCookieBanner(session);

    // Get page content
    const content = await getPageContent(session);

    await closeBrowser(session);

    if (!content) {
      return { html: '', headers: {}, finalUrl: url };
    }

    return {
      html: content.html,
      headers: {}, // agent-browser doesn't expose response headers directly
      finalUrl: content.url,
    };
  } catch (error) {
    await closeBrowser(session);
    console.error('[agent-browser] Fetch error:', error);
    return { html: '', headers: {}, finalUrl: url };
  }
}

// ========================================
// Comprehensive Audit
// ========================================

/**
 * Run comprehensive audit including screenshots, accessibility, and performance
 */
export async function runPlaywrightAudit(
  url: string,
  bidId: string,
  options: {
    takeScreenshots?: boolean;
    runAccessibilityAudit?: boolean;
    analyzeNavigation?: boolean;
    keyPages?: string[];
  } = {}
): Promise<PlaywrightAuditResult> {
  const {
    takeScreenshots = true,
    runAccessibilityAudit: doA11y = true,
    analyzeNavigation = true,
    keyPages = [],
  } = options;

  const session = createSession(`audit-${bidId}`);
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  // Initialize result
  const result: PlaywrightAuditResult = {
    screenshots: { keyPages: [] },
    accessibility: {
      score: 100,
      level: 'AAA',
      violations: [],
      passes: 0,
      incomplete: 0,
    },
    performance: {
      loadTime: 0,
      domContentLoaded: 0,
      resourceCount: { scripts: 0, stylesheets: 0, images: 0, fonts: 0, total: 0 },
      totalSize: 0,
      ratings: {
        lcp: null,
        cls: null,
        fid: null,
        inp: null,
        ttfb: null,
      },
    },
    navigation: {
      mainNav: [],
      footerNav: [],
      hasSearch: false,
      hasBreadcrumbs: false,
      hasMegaMenu: false,
      maxDepth: 1,
    },
  };

  try {
    // Open page
    const startTime = Date.now();
    const opened = await openPage(fullUrl, session);
    if (!opened) {
      throw new Error('Failed to open page');
    }

    // Wait for page load
    await wait(3000);
    result.performance.loadTime = Date.now() - startTime;

    // Dismiss cookie banner
    await dismissCookieBanner(session);

    // Get performance metrics
    const perfMetrics = await getPerformanceMetrics(session);
    result.performance = {
      ...result.performance,
      domContentLoaded: perfMetrics.domContentLoaded,
      firstPaint: perfMetrics.firstPaint,
      lcp: perfMetrics.vitals.lcp,
      fcp: perfMetrics.vitals.fcp,
      cls: perfMetrics.vitals.cls,
      ttfb: perfMetrics.vitals.ttfb,
      inp: perfMetrics.vitals.inp,
      resourceCount: perfMetrics.resourceCount,
      totalSize: perfMetrics.totalSize,
      ratings: {
        lcp: perfMetrics.ratings.lcp,
        cls: perfMetrics.ratings.cls,
        fid: null, // Deprecated
        inp: perfMetrics.ratings.inp,
        ttfb: perfMetrics.ratings.ttfb,
      },
    };

    // Take screenshots
    if (takeScreenshots) {
      const screenshotDir = join(process.cwd(), 'public', 'screenshots', 'quickscan', bidId);
      await mkdir(screenshotDir, { recursive: true });

      // Desktop screenshot (1920x1080)
      await setViewport({ width: 1920, height: 1080, ...session });
      const desktopPath = join(screenshotDir, 'desktop.png');
      await screenshot({ ...session, filePath: desktopPath, fullPage: true });
      result.screenshots.desktop = `/screenshots/quickscan/${bidId}/desktop.png`;

      // Mobile screenshot (375x812)
      await setViewport({ width: 375, height: 812, ...session });
      await wait(500); // Allow reflow
      const mobilePath = join(screenshotDir, 'mobile.png');
      await screenshot({ ...session, filePath: mobilePath, fullPage: true });
      result.screenshots.mobile = `/screenshots/quickscan/${bidId}/mobile.png`;

      // Reset viewport
      await setViewport({ width: 1920, height: 1080, ...session });

      // Screenshot key pages (max 5)
      for (let i = 0; i < Math.min(keyPages.length, 5); i++) {
        const keyPageUrl = keyPages[i];
        try {
          const absoluteUrl = keyPageUrl.startsWith('http')
            ? keyPageUrl
            : new URL(keyPageUrl, fullUrl).toString();

          await openPage(absoluteUrl, session);
          await wait(2000);
          await dismissCookieBanner(session);

          const content = await getPageContent(session);
          const title = content?.title || '';

          const filename = `page_${i + 1}.png`;
          const pagePath = join(screenshotDir, filename);
          await screenshot({ ...session, filePath: pagePath, fullPage: true });

          result.screenshots.keyPages.push({
            url: absoluteUrl,
            title,
            screenshot: `/screenshots/quickscan/${bidId}/${filename}`,
          });
        } catch {
          // Skip failed key page screenshots
        }
      }

      // Navigate back to main page
      await openPage(fullUrl, session);
      await wait(1000);
    }

    // Analyze navigation structure
    if (analyzeNavigation) {
      const navData = await analyzeNavigationStructure(session);
      if (navData) {
        result.navigation = navData;
      }
    }

    await closeBrowser(session);

    // Run accessibility audit separately (uses Lighthouse CLI)
    if (doA11y) {
      try {
        const a11yResult = await runAccessibilityAudit(fullUrl);
        result.accessibility = {
          score: a11yResult.score,
          level: a11yResult.level,
          violations: a11yResult.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: 1, // Lighthouse doesn't provide node count
            helpUrl: v.helpUrl || '',
          })),
          passes: a11yResult.passes,
          incomplete: a11yResult.incomplete,
        };
      } catch (error) {
        console.error('[Accessibility] Audit failed:', error);
      }
    }

    return result;
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}

// ========================================
// Individual Functions
// ========================================

/**
 * Take a single screenshot
 */
export async function takeScreenshot(
  url: string,
  outputPath: string,
  viewport: { width: number; height: number } = { width: 1920, height: 1080 },
  fullPage: boolean = true
): Promise<string> {
  const session = createSession('screenshot');

  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    await openPage(fullUrl, session);
    await wait(2000);
    await dismissCookieBanner(session);

    await setViewport({ ...viewport, ...session });
    await screenshot({ ...session, filePath: outputPath, fullPage });

    await closeBrowser(session);
    return outputPath;
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}

/**
 * Run accessibility audit only
 */
export async function runAccessibilityAuditOnly(
  url: string
): Promise<PlaywrightAuditResult['accessibility']> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const a11yResult = await runAccessibilityAudit(fullUrl);

    return {
      score: a11yResult.score,
      level: a11yResult.level,
      violations: a11yResult.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: 1,
        helpUrl: v.helpUrl || '',
      })),
      passes: a11yResult.passes,
      incomplete: a11yResult.incomplete,
    };
  } catch (error) {
    console.error('[Accessibility] Audit failed:', error);
    throw error;
  }
}

// ========================================
// Navigation Analysis
// ========================================

/**
 * Analyze navigation structure via browser evaluate
 */
async function analyzeNavigationStructure(
  session: BrowserSession
): Promise<PlaywrightAuditResult['navigation'] | null> {
  return evaluate<PlaywrightAuditResult['navigation']>(
    `
    const mainNavItems = [];
    const footerNavItems = [];

    // Find main navigation
    const navElements = document.querySelectorAll(
      'nav, [role="navigation"], header nav, .main-nav, .navbar'
    );
    navElements.forEach(nav => {
      const links = nav.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.length < 50 && !mainNavItems.includes(text)) {
          mainNavItems.push(text);
        }
      });
    });

    // Find footer navigation
    const footer = document.querySelector('footer');
    if (footer) {
      const links = footer.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim();
        if (text && text.length < 50 && !footerNavItems.includes(text)) {
          footerNavItems.push(text);
        }
      });
    }

    // Check for search
    const hasSearch =
      document.querySelector('input[type="search"]') !== null ||
      document.querySelector('[role="search"]') !== null ||
      document.querySelector('.search, .searchbox, #search') !== null;

    // Check for breadcrumbs
    const hasBreadcrumbs =
      document.querySelector('[aria-label*="breadcrumb" i]') !== null ||
      document.querySelector('.breadcrumb, .breadcrumbs') !== null ||
      document.querySelector('[itemtype*="BreadcrumbList"]') !== null;

    // Check for mega menu
    const hasMegaMenu =
      document.querySelector('.mega-menu, .megamenu') !== null ||
      document.querySelectorAll('nav ul ul').length > 3;

    // Calculate max navigation depth
    let maxDepth = 1;
    const nestedLists = document.querySelectorAll('nav ul ul');
    if (nestedLists.length > 0) maxDepth = 2;
    const deepNested = document.querySelectorAll('nav ul ul ul');
    if (deepNested.length > 0) maxDepth = 3;

    return {
      mainNav: mainNavItems.slice(0, 20),
      footerNav: footerNavItems.slice(0, 30),
      hasSearch,
      hasBreadcrumbs,
      hasMegaMenu,
      maxDepth,
    };
  `,
    session
  );
}

// ========================================
// Tech Detection (Stubs)
// ========================================

export interface HttpxTechResult {
  technologies: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  headers: Record<string, string>;
  statusCode: number;
}

/**
 * Run httpx-based tech detection (stub)
 */
export function runHttpxTechDetection(_url: string): Promise<HttpxTechResult> {
  return Promise.resolve({
    technologies: [],
    headers: {},
    statusCode: 200,
  });
}

// ========================================
// Key Page Identification
// ========================================

/** Common page patterns for key pages to screenshot */
const KEY_PAGE_PATTERNS = [
  { pattern: /\/(kontakt|contact|about|ueber-uns|uber-uns)/i, label: 'Kontakt/Über uns' },
  { pattern: /\/(produkt|product|leistung|service|angebot)/i, label: 'Produkte/Leistungen' },
  { pattern: /\/(blog|news|aktuell|presse|press)/i, label: 'Blog/News' },
  { pattern: /\/(karriere|career|jobs|stellenangebot)/i, label: 'Karriere' },
  { pattern: /\/(referenz|reference|projekt|portfolio|case)/i, label: 'Referenzen' },
  { pattern: /\/(shop|store|warenkorb|cart)/i, label: 'Shop' },
  { pattern: /\/(faq|hilfe|help|support)/i, label: 'FAQ/Support' },
  { pattern: /\/(impressum|imprint|datenschutz|privacy)/i, label: 'Rechtliches' },
];

/**
 * Identify key pages from navigation links and sitemap URLs.
 * Returns up to 5 representative URLs for screenshots.
 */
export function identifyKeyPages(
  baseUrl: string,
  navLinks: string[],
  sitemapUrls: string[] = []
): string[] {
  const allUrls = [...navLinks, ...sitemapUrls.slice(0, 50)];
  const seen = new Set<string>();
  const keyPages: string[] = [];

  for (const pattern of KEY_PAGE_PATTERNS) {
    if (keyPages.length >= 5) break;

    for (const urlOrPath of allUrls) {
      if (keyPages.length >= 5) break;

      const fullUrl = urlOrPath.startsWith('http')
        ? urlOrPath
        : `${baseUrl.replace(/\/$/, '')}/${urlOrPath.replace(/^\//, '')}`;

      if (seen.has(fullUrl)) continue;

      if (pattern.pattern.test(urlOrPath)) {
        seen.add(fullUrl);
        keyPages.push(fullUrl);
        break; // One match per pattern category
      }
    }
  }

  return keyPages;
}

export interface EnhancedTechStackResult {
  cms?: {
    name: string;
    version?: string;
    confidence: number;
  };
  framework?: {
    name: string;
    version?: string;
    confidence: number;
  };
  hosting?: string;
  cdn?: string;
  analytics: string[];
  marketing: string[];
  libraries: Array<{
    name: string;
    version?: string;
    confidence: number;
  }>;
}

/**
 * Enhanced tech stack detection (stub)
 */
export function detectEnhancedTechStack(_url: string): Promise<EnhancedTechStackResult> {
  return Promise.resolve({
    analytics: [],
    marketing: [],
    libraries: [],
  });
}
