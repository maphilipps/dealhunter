/**
 * Website Crawler
 *
 * Crawls websites using agent-browser MCP (Playwright-based)
 * for tech stack detection and content analysis.
 */

import { analyzePageContent, detectTechStack, type TechStack } from './tech-stack-detection';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CrawlResult {
  success: boolean;
  techStack: TechStack | null;
  error?: string;
  homepage?: {
    url: string;
    title: string;
    description: string;
  };
  samplePages?: string[];
  crawledAt: string;
}

export interface CrawlOptions {
  maxPages?: number; // Max sample pages to crawl (default: 10)
  timeout?: number; // Timeout per page in ms (default: 30000)
  session?: string; // Browser session name
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRAWLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crawl website and detect tech stack
 *
 * Uses agent-browser MCP for reliable browser automation.
 *
 * @param websiteUrl - Website URL to crawl
 * @param options - Crawl options
 * @returns Crawl result with tech stack and errors
 */
export async function crawlWebsite(
  websiteUrl: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const { maxPages = 10, timeout = 30000 } = options;

  console.error(`[Crawler] Starting crawl for ${websiteUrl}`);

  try {
    // Validate URL
    const url = normalizeUrl(websiteUrl);

    // Step 1: Open homepage
    console.error(`[Crawler] Opening homepage: ${url}`);

    // Note: In a real implementation, this would use the agent-browser MCP
    // For now, we'll use fetch as a fallback until MCP integration is complete

    const homepageResult = await fetchPageWithFallback(url, timeout);

    if (!homepageResult.success) {
      return {
        success: false,
        techStack: null,
        error: homepageResult.error || 'Failed to fetch homepage',
        crawledAt: new Date().toISOString(),
      };
    }

    // Step 2: Analyze homepage for tech stack
    const pageAnalysis = analyzePageContent(
      homepageResult.html || '',
      homepageResult.headers || {}
    );

    const techStack = detectTechStack(pageAnalysis);

    console.error(`[Crawler] Tech stack detected:`, {
      cms: techStack.cms,
      framework: techStack.framework,
      confidence: techStack.confidence,
    });

    // Step 3: Extract sample pages from homepage
    const samplePages = extractSamplePages(homepageResult.html || '', url, maxPages);

    console.error(`[Crawler] Found ${samplePages.length} sample pages`);

    // Step 4: Extract homepage metadata
    const homepage = {
      url,
      title: extractTitle(homepageResult.html || ''),
      description: extractDescription(homepageResult.html || ''),
    };

    return {
      success: true,
      techStack,
      homepage,
      samplePages,
      crawledAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Crawler] Error:', error);
    return {
      success: false,
      techStack: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      crawledAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize URL (add https:// if missing)
 */
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Fetch page using native fetch as fallback
 *
 * In production, this should use agent-browser MCP for better reliability
 * and JavaScript execution. This is a temporary implementation.
 */
async function fetchPageWithFallback(
  url: string,
  timeout: number
): Promise<{
  success: boolean;
  html?: string;
  headers?: Record<string, string>;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealhunterBot/1.0; +https://dealhunter.adesso.de)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Convert Headers object to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      success: true,
      html,
      headers,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Timeout after ${timeout}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Unknown error',
    };
  }
}

/**
 * Extract sample pages from HTML
 */
function extractSamplePages(html: string, baseUrl: string, maxPages: number): string[] {
  const pages: string[] = [];
  const linkRegex = /<a[^>]*href=["']([^"']+)["']/gi;
  const matches = Array.from(html.matchAll(linkRegex));

  const baseUrlObj = new URL(baseUrl);

  for (const match of matches) {
    if (pages.length >= maxPages) break;

    try {
      const href = match[1];

      // Skip anchors, mailto, tel, javascript
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      ) {
        continue;
      }

      // Resolve relative URLs
      const absoluteUrl = new URL(href, baseUrl);

      // Only include same-origin links
      if (absoluteUrl.origin !== baseUrlObj.origin) {
        continue;
      }

      // Skip duplicates and homepage
      if (!pages.includes(absoluteUrl.href) && absoluteUrl.href !== baseUrl) {
        pages.push(absoluteUrl.href);
      }
    } catch {
      // Invalid URL, skip
      continue;
    }
  }

  return pages.slice(0, maxPages);
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Extract description from meta tags
 */
function extractDescription(html: string): string {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  return match ? match[1].trim() : '';
}
