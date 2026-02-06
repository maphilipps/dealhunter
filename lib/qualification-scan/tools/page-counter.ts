/**
 * Page Counter Tool using agent-browser CLI
 * Counts pages using multiple strategies: sitemap, link discovery, navigation
 */

import { openPage, closeBrowser, evaluate, createSession, wait } from '@/lib/browser';

// ========================================
// Types
// ========================================

interface PageCountResult {
  actualPageCount: number;
  sources: {
    sitemap: number;
    linkDiscovery: number;
    navigation: number;
  };
  byType: Record<string, number>;
  urls: string[];
  errors: string[];
}

interface CountOptions {
  timeout?: number;
  maxPages?: number;
}

// ========================================
// Sitemap Parsing
// ========================================

/**
 * Fetch and parse sitemap.xml
 */
async function parseSitemap(baseUrl: string, timeout: number): Promise<string[]> {
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
  ];

  const urls: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QualificationScan/2.0)',
        },
      });

      if (!response.ok) continue;

      const text = await response.text();

      // Parse sitemap XML
      const locMatches = text.matchAll(/<loc>([^<]+)<\/loc>/gi);
      for (const match of locMatches) {
        const url = match[1].trim();
        // Handle nested sitemaps
        if (url.endsWith('.xml')) {
          try {
            const nestedResponse = await fetch(url, {
              signal: AbortSignal.timeout(timeout),
            });
            if (nestedResponse.ok) {
              const nestedText = await nestedResponse.text();
              const nestedMatches = nestedText.matchAll(/<loc>([^<]+)<\/loc>/gi);
              for (const nestedMatch of nestedMatches) {
                const nestedUrl = nestedMatch[1].trim();
                if (!nestedUrl.endsWith('.xml')) {
                  urls.push(nestedUrl);
                }
              }
            }
          } catch {
            // Skip nested sitemap errors
          }
        } else {
          urls.push(url);
        }
      }

      if (urls.length > 0) break; // Found sitemap, stop trying
    } catch {
      // Try next sitemap URL
      continue;
    }
  }

  return [...new Set(urls)]; // Deduplicate
}

// ========================================
// Link Discovery
// ========================================

/**
 * Discover links from homepage using agent-browser
 */
async function discoverLinks(baseUrl: string, timeout: number): Promise<string[]> {
  const session = createSession('link-discovery');

  try {
    await openPage(baseUrl, session);
    await wait(2000);

    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname;

    const links = await evaluate<string[]>(
      `
      const domain = "${baseDomain}";
      const discovered = [];
      document.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (!href) return;

        try {
          const url = new URL(href, window.location.origin);
          // Only internal links
          if (
            url.hostname === domain ||
            url.hostname === 'www.' + domain ||
            domain === 'www.' + url.hostname
          ) {
            const cleanUrl = (url.origin + url.pathname).replace(/\\/$/, '');
            discovered.push(cleanUrl);
          }
        } catch {
          // Invalid URL, skip
        }
      });
      return discovered;
    `,
      session
    );

    await closeBrowser(session);
    return [...new Set(links || [])];
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}

/**
 * Extract navigation links using agent-browser
 */
async function extractNavigationLinks(baseUrl: string, timeout: number): Promise<string[]> {
  const session = createSession('nav-links');

  try {
    await openPage(baseUrl, session);
    await wait(2000);

    const navLinks = await evaluate<string[]>(
      `
      const links = [];

      // Main navigation
      const navSelectors = [
        'nav a',
        'header a',
        '[role="navigation"] a',
        '.main-nav a',
        '.navbar a',
        '.navigation a',
        '#main-menu a',
        '.primary-menu a',
      ];

      for (const selector of navSelectors) {
        document.querySelectorAll(selector).forEach(anchor => {
          const href = anchor.getAttribute('href');
          if (href && (href.startsWith('/') || href.startsWith(window.location.origin))) {
            try {
              const url = new URL(href, window.location.origin);
              const cleanUrl = (url.origin + url.pathname).replace(/\\/$/, '');
              links.push(cleanUrl);
            } catch {
              // Invalid URL
            }
          }
        });
      }

      // Footer navigation
      const footer = document.querySelector('footer');
      if (footer) {
        footer.querySelectorAll('a[href]').forEach(anchor => {
          const href = anchor.getAttribute('href');
          if (href && (href.startsWith('/') || href.startsWith(window.location.origin))) {
            try {
              const url = new URL(href, window.location.origin);
              const cleanUrl = (url.origin + url.pathname).replace(/\\/$/, '');
              links.push(cleanUrl);
            } catch {
              // Invalid URL
            }
          }
        });
      }

      return links;
    `,
      session
    );

    await closeBrowser(session);
    return [...new Set(navLinks || [])];
  } catch (error) {
    await closeBrowser(session);
    throw error;
  }
}

// ========================================
// URL Categorization
// ========================================

/**
 * Categorize URLs by type based on path patterns
 */
function categorizeUrls(urls: string[]): Record<string, number> {
  const typePatterns: Record<string, RegExp[]> = {
    blog: [/blog/i, /artikel/i, /article/i, /beitrag/i, /post/i, /news/i, /aktuelles/i],
    products: [/product/i, /produkt/i, /shop/i, /artikel/i, /ware/i],
    services: [/service/i, /leistung/i, /angebot/i, /dienstleistung/i],
    events: [/event/i, /veranstaltung/i, /termin/i, /seminar/i, /workshop/i, /kurs/i],
    jobs: [/job/i, /karriere/i, /career/i, /stelle/i, /bewerbung/i],
    team: [/team/i, /mitarbeiter/i, /employee/i, /person/i, /author/i, /dozent/i],
    contact: [/kontakt/i, /contact/i, /anfahrt/i],
    about: [/ueber-uns/i, /about/i, /unternehmen/i, /company/i, /wir/i],
    legal: [/impressum/i, /datenschutz/i, /privacy/i, /agb/i, /terms/i],
    faq: [/faq/i, /fragen/i, /hilfe/i, /help/i],
    media: [/media/i, /presse/i, /press/i, /download/i],
  };

  const counts: Record<string, number> = {};

  for (const url of urls) {
    let matched = false;
    for (const [type, patterns] of Object.entries(typePatterns)) {
      if (patterns.some(p => p.test(url))) {
        counts[type] = (counts[type] || 0) + 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      counts['pages'] = (counts['pages'] || 0) + 1;
    }
  }

  return counts;
}

// ========================================
// Main Functions
// ========================================

/**
 * Count pages from multiple sources
 */
export async function countPages(
  url: string,
  options: CountOptions = {}
): Promise<PageCountResult> {
  const { timeout = 30000, maxPages = 10000 } = options;

  const errors: string[] = [];
  const allUrls = new Set<string>();

  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  const sources = {
    sitemap: 0,
    linkDiscovery: 0,
    navigation: 0,
  };

  // 1. Try sitemap first (most reliable)
  try {
    const sitemapUrls = await parseSitemap(fullUrl, timeout);
    sitemapUrls.forEach(u => allUrls.add(u));
    sources.sitemap = sitemapUrls.length;
  } catch (error) {
    errors.push(`Sitemap error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // 2. Link discovery from homepage
  try {
    const discoveredUrls = await discoverLinks(fullUrl, timeout);
    const newUrls = discoveredUrls.filter(u => !allUrls.has(u));
    newUrls.forEach(u => allUrls.add(u));
    sources.linkDiscovery = newUrls.length;
  } catch (error) {
    errors.push(`Link discovery error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // 3. Navigation links
  try {
    const navUrls = await extractNavigationLinks(fullUrl, timeout);
    const newUrls = navUrls.filter(u => !allUrls.has(u));
    newUrls.forEach(u => allUrls.add(u));
    sources.navigation = newUrls.length;
  } catch (error) {
    errors.push(`Navigation error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Limit results
  const urls = Array.from(allUrls).slice(0, maxPages);
  const byType = categorizeUrls(urls);

  return {
    actualPageCount: urls.length,
    sources,
    byType,
    urls,
    errors,
  };
}

/**
 * Quick page count (sitemap only, no browser)
 */
export async function quickPageCount(url: string): Promise<{
  count: number;
  source: 'sitemap' | 'estimated';
  confidence: number;
}> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const sitemapUrls = await parseSitemap(fullUrl, 10000);
    if (sitemapUrls.length > 0) {
      return {
        count: sitemapUrls.length,
        source: 'sitemap',
        confidence: 90,
      };
    }
  } catch {
    // Sitemap not available
  }

  // Estimate based on homepage link count
  try {
    const response = await fetch(fullUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QualificationScan/2.0)',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const linkMatches = html.match(/<a[^>]+href=/gi);
      const internalLinks = linkMatches?.filter(
        link => !link.includes('http') || link.includes(new URL(fullUrl).hostname)
      );
      const estimatedCount = Math.ceil((internalLinks?.length || 20) * 5); // Rough multiplier

      return {
        count: estimatedCount,
        source: 'estimated',
        confidence: 40,
      };
    }
  } catch {
    // Fallback estimation
  }

  return {
    count: 50, // Default estimate
    source: 'estimated',
    confidence: 20,
  };
}
