import wappalyzer from 'simple-wappalyzer';

import { validateUrlForFetch } from '@/lib/utils/url-validation';

import type { WebsiteData } from '../workflow/types';

interface WappalyzerTechnology {
  name: string;
  categories: string[];
  version?: string;
  confidence: number;
  website?: string;
  icon?: string;
}

interface SitemapResult {
  urls: string[];
  found: boolean;
  sitemapUrl?: string;
}

type CacheEntry = {
  data: WebsiteData;
  fetchedAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const websiteCache = new Map<string, CacheEntry>();

/**
 * Fetch and parse sitemap.xml for URL count.
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

        const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/gi) || [];
        for (const match of urlMatches) {
          const urlContent = match.replace(/<\/?loc>/gi, '');
          if (urlContent.includes('sitemap') && urlContent.endsWith('.xml')) {
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

        if (urls.length > 0) break;
      }
    } catch {
      // Continue to next sitemap path
    }
  }

  return {
    urls: urls.slice(0, 5000),
    found: foundSitemapUrl !== undefined,
    sitemapUrl: foundSitemapUrl,
  };
}

async function fetchHtmlWithPlaywright(
  url: string
): Promise<{ html: string; headers: Record<string, string>; finalUrl: string }> {
  try {
    const { fetchHtmlWithPlaywright: fetchFn } = await import('./playwright');
    return fetchFn(url);
  } catch {
    return { html: '', headers: {}, finalUrl: url };
  }
}

export async function fetchWebsiteData(url: string): Promise<WebsiteData> {
  const cached = websiteCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  validateUrlForFetch(url);

  const result: WebsiteData = {
    html: '',
    headers: {},
    url,
    wappalyzerResults: [],
    sitemapUrls: [],
    sitemapFound: false,
    sitemapUrl: undefined,
  };

  try {
    const response = await fetch(url, {
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
      response.headers.forEach((value, key) => {
        result.headers[key.toLowerCase()] = value;
      });
    }
  } catch (error) {
    console.error('Simple fetch failed:', error);
  }

  if (!result.html || result.html.length < 500) {
    try {
      const playwrightResult = await fetchHtmlWithPlaywright(url);
      if (playwrightResult.html && playwrightResult.html.length > result.html.length) {
        result.html = playwrightResult.html;
        result.headers = playwrightResult.headers;
        result.url = playwrightResult.finalUrl;
      }
    } catch (playwrightError) {
      console.error('Playwright fallback failed:', playwrightError);
    }
  }

  if (result.html) {
    try {
      const wappalyzerResult = wappalyzer({
        url,
        html: result.html,
        headers: result.headers,
      });
      result.wappalyzerResults = Array.isArray(wappalyzerResult)
        ? (wappalyzerResult as WappalyzerTechnology[])
        : [];
    } catch (e) {
      console.error('Wappalyzer error:', e);
      result.wappalyzerResults = [];
    }
  }

  try {
    const sitemapResult = await fetchSitemapUrls(url);
    result.sitemapUrls = sitemapResult.urls;
    result.sitemapFound = sitemapResult.found;
    result.sitemapUrl = sitemapResult.sitemapUrl;
  } catch (sitemapError) {
    console.error('Sitemap fetch error:', sitemapError);
  }

  websiteCache.set(url, { data: result, fetchedAt: Date.now() });
  return result;
}
