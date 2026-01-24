/**
 * Website Crawler using agent-browser CLI
 * Crawls and scrapes multiple pages for deep analysis
 */

import {
  openPage,
  closeBrowser,
  getPageContent,
  screenshot,
  setViewport,
  evaluate,
  createSession,
  wait,
  type BrowserSession,
} from '@/lib/browser';
import { dismissCookieBanner } from '@/lib/browser/cookie-banner';

import { fetchSitemap } from './sitemap';
import { detectTechnologies, mergeTechIndicators } from './tech-detection';
import type {
  ScrapedPage,
  ScrapeResult,
  ScrapeOptions,
  PageStructure,
  ExternalRequest,
  TechIndicator,
} from './types';

const DEFAULT_OPTIONS: ScrapeOptions = {
  maxPages: 30,
  maxDepth: 3,
  includeScreenshots: true,
  includeMobile: false,
  timeout: 30000,
};

export async function scrapeSite(
  url: string,
  options: ScrapeOptions = {},
  onPageScraped?: (page: ScrapedPage) => Promise<void>
): Promise<ScrapeResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  const pages: ScrapedPage[] = [];
  const errors: string[] = [];
  const visited = new Set<string>();
  const allTechIndicators: TechIndicator[][] = [];

  const session = createSession('scraper');

  try {
    // Normalize URL for deduplication
    const normalizeUrl = (u: string): string => {
      try {
        const parsed = new URL(u);
        let normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`;
        if (parsed.search) normalized += parsed.search;
        return normalized || u;
      } catch {
        return u;
      }
    };

    // Try sitemap first
    const sitemapResult = await fetchSitemap(url);
    const sitemapUrls = sitemapResult.urls;
    let urlsToScrape: string[] = [];

    if (sitemapUrls.length > 0) {
      // Deduplicate sitemap URLs
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const sitemapUrl of sitemapUrls) {
        const normalized = normalizeUrl(sitemapUrl);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          deduped.push(sitemapUrl);
        }
      }
      console.log(`[Scraper] Sitemap: ${sitemapUrls.length} URLs, ${deduped.length} unique`);
      urlsToScrape = deduped.slice(0, opts.maxPages!);
    } else {
      // Fallback: crawl from homepage
      urlsToScrape = [url];
    }

    // Scrape pages
    for (const pageUrl of urlsToScrape) {
      const normalizedPageUrl = normalizeUrl(pageUrl);
      if (visited.has(normalizedPageUrl) || pages.length >= opts.maxPages!) continue;
      visited.add(normalizedPageUrl);

      try {
        const scrapedPage = await scrapePage(session, pageUrl, opts);
        pages.push(scrapedPage);

        // Collect tech indicators
        allTechIndicators.push(scrapedPage.techIndicators);

        // Callback for live RAG embedding
        if (onPageScraped) {
          await onPageScraped(scrapedPage);
        }

        // If no sitemap, extract links for crawling
        if (sitemapUrls.length === 0) {
          const links = extractInternalLinks(scrapedPage.html, url);
          for (const link of links) {
            const normalizedLink = normalizeUrl(link);
            if (!visited.has(normalizedLink) && urlsToScrape.length < opts.maxPages!) {
              urlsToScrape.push(link);
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to scrape ${pageUrl}: ${err}`);
      }
    }

    await closeBrowser(session);

    return {
      success: errors.length === 0,
      pages,
      sitemapFound: sitemapUrls.length > 0,
      techStack: mergeTechIndicators(allTechIndicators),
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}

async function scrapePage(
  session: BrowserSession,
  url: string,
  opts: ScrapeOptions
): Promise<ScrapedPage> {
  // Open page
  await openPage(url, session);
  await wait(2000);

  // Dismiss cookie banner
  await dismissCookieBanner(session);

  // Get page content
  const content = await getPageContent(session);
  const html = content?.html || '';
  const title = content?.title || '';

  // Get text content
  const text = (await evaluate<string>(`document.body?.innerText || ''`, session)) || '';

  // Extract structure
  const structure = await extractPageStructure(session);

  // Tech detection from HTML
  const techIndicators = detectTechnologies({ html });

  // Screenshot
  let screenshotBase64: string | undefined;
  if (opts.includeScreenshots) {
    const screenshotResult = await screenshot(session);
    if (typeof screenshotResult === 'string' && screenshotResult.length > 100) {
      screenshotBase64 = screenshotResult;
    }
  }

  // Mobile screenshot
  let screenshotMobile: string | undefined;
  if (opts.includeMobile) {
    await setViewport({ width: 375, height: 812, ...session });
    await wait(500);
    const mobileResult = await screenshot(session);
    if (typeof mobileResult === 'string' && mobileResult.length > 100) {
      screenshotMobile = mobileResult;
    }
    await setViewport({ width: 1920, height: 1080, ...session });
  }

  // External requests detection via evaluate
  const externalRequests = await detectExternalRequests(session, url);

  return {
    url,
    title,
    html,
    text,
    screenshot: screenshotBase64,
    screenshotMobile,
    structure,
    techIndicators,
    externalRequests,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Detect external requests by analyzing script/link tags and network patterns
 */
async function detectExternalRequests(
  session: BrowserSession,
  baseUrl: string
): Promise<ExternalRequest[]> {
  const baseHost = new URL(baseUrl).hostname;

  const requests = await evaluate<Array<{ url: string; type: string }>>(
    `
    const baseHost = "${baseHost}";
    const requests = [];

    // Check script tags
    document.querySelectorAll('script[src]').forEach(script => {
      try {
        const url = new URL(script.src);
        if (url.hostname !== baseHost) {
          requests.push({ url: url.href, type: 'script' });
        }
      } catch {}
    });

    // Check link tags (CSS, etc.)
    document.querySelectorAll('link[href]').forEach(link => {
      try {
        const url = new URL(link.href);
        if (url.hostname !== baseHost) {
          requests.push({ url: url.href, type: 'stylesheet' });
        }
      } catch {}
    });

    // Check image sources
    document.querySelectorAll('img[src]').forEach(img => {
      try {
        const url = new URL(img.src);
        if (url.hostname !== baseHost) {
          requests.push({ url: url.href, type: 'image' });
        }
      } catch {}
    });

    // Check iframe sources
    document.querySelectorAll('iframe[src]').forEach(iframe => {
      try {
        const url = new URL(iframe.src);
        if (url.hostname !== baseHost) {
          requests.push({ url: url.href, type: 'iframe' });
        }
      } catch {}
    });

    return requests;
  `,
    session
  );

  if (!requests) return [];

  return requests.map(req => ({
    url: req.url,
    type: categorizeRequest(req.type, new URL(req.url).hostname),
    domain: new URL(req.url).hostname,
  }));
}

function categorizeRequest(
  resourceType: string,
  domain: string
): 'script' | 'api' | 'tracking' | 'cdn' | 'other' {
  // Tracking domains
  const trackingDomains = [
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com',
    'hotjar.com',
    'matomo',
    'piwik',
    'analytics',
    'tracking',
  ];

  if (trackingDomains.some(t => domain.includes(t))) {
    return 'tracking';
  }

  // CDN domains
  const cdnDomains = [
    'cloudflare',
    'cdn',
    'cloudfront',
    'akamai',
    'fastly',
    'jsdelivr',
    'unpkg',
    'cdnjs',
  ];

  if (cdnDomains.some(c => domain.includes(c))) {
    return 'cdn';
  }

  // By resource type
  if (resourceType === 'script') return 'script';
  if (resourceType === 'fetch' || resourceType === 'xhr') return 'api';

  return 'other';
}

async function extractPageStructure(session: BrowserSession): Promise<PageStructure> {
  const structure = await evaluate<PageStructure>(
    `
    // Extract headings
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim() || '',
    }));

    // Extract navigation
    const navigation = [];

    const header = document.querySelector('header nav, nav[role="navigation"], .main-nav');
    if (header) {
      navigation.push({
        type: 'header',
        links: Array.from(header.querySelectorAll('a'))
          .map(a => a.getAttribute('href') || '')
          .filter(Boolean),
      });
    }

    const footer = document.querySelector('footer nav, footer .nav, footer ul');
    if (footer) {
      navigation.push({
        type: 'footer',
        links: Array.from(footer.querySelectorAll('a'))
          .map(a => a.getAttribute('href') || '')
          .filter(Boolean),
      });
    }

    const sidebar = document.querySelector('aside nav, .sidebar nav, [role="complementary"] nav');
    if (sidebar) {
      navigation.push({
        type: 'sidebar',
        links: Array.from(sidebar.querySelectorAll('a'))
          .map(a => a.getAttribute('href') || '')
          .filter(Boolean),
      });
    }

    // Extract major sections
    const sections = Array.from(document.querySelectorAll('section, article, main, [role="main"]'))
      .slice(0, 20)
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        className: el.className || undefined,
        id: el.id || undefined,
      }));

    // Extract forms
    const forms = Array.from(document.querySelectorAll('form'))
      .slice(0, 10)
      .map(form => ({
        action: form.action || undefined,
        method: form.method || undefined,
        inputs: Array.from(form.querySelectorAll('input, select, textarea'))
          .map(input => input.getAttribute('name') || input.getAttribute('type') || 'unknown')
          .filter(Boolean),
      }));

    // Extract iframes
    const iframes = Array.from(document.querySelectorAll('iframe'))
      .slice(0, 20)
      .map(iframe => ({ src: iframe.src }))
      .filter(i => i.src);

    return {
      headings,
      navigation,
      sections,
      forms,
      images: document.querySelectorAll('img').length,
      videos: document.querySelectorAll(
        'video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]'
      ).length,
      iframes,
    };
  `,
    session
  );

  return (
    structure || {
      headings: [],
      navigation: [],
      sections: [],
      forms: [],
      images: 0,
      videos: 0,
      iframes: [],
    }
  );
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const linkRegex = /href=["']([^"']+)["']/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const linkUrl = new URL(match[1], baseUrl);
      // Only internal links, skip anchors and common non-page extensions
      if (
        linkUrl.hostname === base.hostname &&
        !links.includes(linkUrl.href) &&
        !linkUrl.href.includes('#') &&
        !linkUrl.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json)$/i)
      ) {
        links.push(linkUrl.href);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return links.slice(0, 50);
}
