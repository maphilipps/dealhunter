import { chromium, type Browser } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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
    resourceCount: {
      scripts: number;
      stylesheets: number;
      images: number;
      fonts: number;
      total: number;
    };
    totalSize: number;
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

/**
 * Run comprehensive Playwright audit including screenshots, accessibility, and performance
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
    runAccessibilityAudit = true,
    analyzeNavigation = true,
    keyPages = [],
  } = options;

  let browser: Browser | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    // Track performance metrics
    const performanceMetrics = {
      loadTime: 0,
      domContentLoaded: 0,
      firstPaint: undefined as number | undefined,
      resourceCount: { scripts: 0, stylesheets: 0, images: 0, fonts: 0, total: 0 },
      totalSize: 0,
    };

    // Track resources
    const resources: Array<{ type: string; size: number }> = [];

    page.on('response', async (response) => {
      try {
        const headers = response.headers();
        const contentType = headers['content-type'] || '';
        const contentLength = parseInt(headers['content-length'] || '0', 10);

        let resourceType = 'other';
        if (contentType.includes('javascript')) resourceType = 'script';
        else if (contentType.includes('css')) resourceType = 'stylesheet';
        else if (contentType.includes('image')) resourceType = 'image';
        else if (contentType.includes('font')) resourceType = 'font';

        resources.push({ type: resourceType, size: contentLength });
      } catch {
        // Ignore errors from response processing
      }
    });

    // Navigate with timing
    const startTime = Date.now();
    await page.goto(fullUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    performanceMetrics.loadTime = Date.now() - startTime;

    // Get performance timing from browser using modern Navigation Timing API
    const timing = await page.evaluate(() => {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const navEntry = navEntries[0];
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find((e) => e.name === 'first-paint')?.startTime;

      return {
        domContentLoaded: navEntry ? navEntry.domContentLoadedEventEnd - navEntry.startTime : 0,
        firstPaint,
      };
    });
    performanceMetrics.domContentLoaded = timing.domContentLoaded;
    performanceMetrics.firstPaint = timing.firstPaint;

    // Calculate resource counts
    for (const resource of resources) {
      performanceMetrics.totalSize += resource.size;
      performanceMetrics.resourceCount.total++;
      if (resource.type === 'script') performanceMetrics.resourceCount.scripts++;
      else if (resource.type === 'stylesheet') performanceMetrics.resourceCount.stylesheets++;
      else if (resource.type === 'image') performanceMetrics.resourceCount.images++;
      else if (resource.type === 'font') performanceMetrics.resourceCount.fonts++;
    }

    const result: PlaywrightAuditResult = {
      screenshots: {
        keyPages: [],
      },
      accessibility: {
        score: 100,
        level: 'AAA',
        violations: [],
        passes: 0,
        incomplete: 0,
      },
      performance: performanceMetrics,
      navigation: {
        mainNav: [],
        footerNav: [],
        hasSearch: false,
        hasBreadcrumbs: false,
        hasMegaMenu: false,
        maxDepth: 1,
      },
    };

    // Take screenshots
    if (takeScreenshots) {
      const screenshotDir = join(process.cwd(), 'public', 'screenshots', 'quickscan', bidId);
      await mkdir(screenshotDir, { recursive: true });

      // Desktop screenshot (1920x1080)
      const desktopPath = join(screenshotDir, 'desktop.png');
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.screenshot({ path: desktopPath, fullPage: false });
      result.screenshots.desktop = `/screenshots/quickscan/${bidId}/desktop.png`;

      // Mobile screenshot (375x812 - iPhone X)
      const mobilePath = join(screenshotDir, 'mobile.png');
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: mobilePath, fullPage: false });
      result.screenshots.mobile = `/screenshots/quickscan/${bidId}/mobile.png`;

      // Reset viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Take screenshots of key pages (max 5)
      for (let i = 0; i < Math.min(keyPages.length, 5); i++) {
        const keyPageUrl = keyPages[i];
        try {
          const absoluteUrl = keyPageUrl.startsWith('http')
            ? keyPageUrl
            : new URL(keyPageUrl, fullUrl).toString();

          await page.goto(absoluteUrl, { waitUntil: 'networkidle', timeout: 15000 });
          const title = await page.title();
          const filename = `page_${i + 1}.png`;
          const pagePath = join(screenshotDir, filename);
          await page.screenshot({ path: pagePath, fullPage: false });

          result.screenshots.keyPages.push({
            url: absoluteUrl,
            title,
            screenshot: `/screenshots/quickscan/${bidId}/${filename}`,
          });
        } catch {
          // Skip failed key page screenshots
        }
      }

      // Navigate back to main page for remaining audits
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    }

    // Run accessibility audit with axe-core
    if (runAccessibilityAudit) {
      try {
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
          .analyze();

        // Map violations
        result.accessibility.violations = axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor',
          description: v.description,
          nodes: v.nodes.length,
          helpUrl: v.helpUrl,
        }));

        result.accessibility.passes = axeResults.passes.length;
        result.accessibility.incomplete = axeResults.incomplete.length;

        // Calculate score (100 - penalties)
        const criticalCount = result.accessibility.violations.filter((v) => v.impact === 'critical').length;
        const seriousCount = result.accessibility.violations.filter((v) => v.impact === 'serious').length;
        const moderateCount = result.accessibility.violations.filter((v) => v.impact === 'moderate').length;
        const minorCount = result.accessibility.violations.filter((v) => v.impact === 'minor').length;

        const penalty = criticalCount * 15 + seriousCount * 8 + moderateCount * 3 + minorCount * 1;
        result.accessibility.score = Math.max(0, Math.min(100, 100 - penalty));

        // Determine WCAG level
        if (criticalCount > 0) {
          result.accessibility.level = 'fail';
        } else if (seriousCount > 0) {
          result.accessibility.level = 'A';
        } else if (moderateCount > 0) {
          result.accessibility.level = 'AA';
        } else {
          result.accessibility.level = 'AAA';
        }
      } catch (error) {
        console.error('Axe-core audit failed:', error);
        // Keep default values
      }
    }

    // Analyze navigation structure
    if (analyzeNavigation) {
      const navData = await page.evaluate(() => {
        const mainNavItems: string[] = [];
        const footerNavItems: string[] = [];

        // Find main navigation
        const navElements = document.querySelectorAll('nav, [role="navigation"], header nav, .main-nav, .navbar');
        navElements.forEach((nav) => {
          const links = nav.querySelectorAll('a');
          links.forEach((link) => {
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
          links.forEach((link) => {
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
      });

      result.navigation = navData;
    }

    await browser.close();
    return result;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Take a single screenshot of a URL
 */
export async function takeScreenshot(
  url: string,
  outputPath: string,
  viewport: { width: number; height: number } = { width: 1920, height: 1080 }
): Promise<string> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: outputPath, fullPage: false });

    await browser.close();
    return outputPath;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Run accessibility audit only
 */
export async function runAccessibilityAuditOnly(url: string): Promise<PlaywrightAuditResult['accessibility']> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    const violations = axeResults.violations.map((v) => ({
      id: v.id,
      impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor',
      description: v.description,
      nodes: v.nodes.length,
      helpUrl: v.helpUrl,
    }));

    const criticalCount = violations.filter((v) => v.impact === 'critical').length;
    const seriousCount = violations.filter((v) => v.impact === 'serious').length;
    const moderateCount = violations.filter((v) => v.impact === 'moderate').length;
    const minorCount = violations.filter((v) => v.impact === 'minor').length;

    const penalty = criticalCount * 15 + seriousCount * 8 + moderateCount * 3 + minorCount * 1;
    const score = Math.max(0, Math.min(100, 100 - penalty));

    let level: 'A' | 'AA' | 'AAA' | 'fail' = 'AAA';
    if (criticalCount > 0) level = 'fail';
    else if (seriousCount > 0) level = 'A';
    else if (moderateCount > 0) level = 'AA';

    await browser.close();

    return {
      score,
      level,
      violations,
      passes: axeResults.passes.length,
      incomplete: axeResults.incomplete.length,
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}
