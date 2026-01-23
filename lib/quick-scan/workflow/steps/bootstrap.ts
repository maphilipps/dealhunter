// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP STEPS - QuickScan 2.0 Workflow
// Steps that run at the beginning of the workflow with no dependencies
// ═══════════════════════════════════════════════════════════════════════════════

import wappalyzer from 'simple-wappalyzer';

import { wrapTool, wrapToolWithProgress } from '../tool-wrapper';
import type { WebsiteData, BusinessUnit, BootstrapInput } from '../types';

import { db } from '@/lib/db';
import { businessUnits as businessUnitsTable } from '@/lib/db/schema';
import { validateUrlForFetch } from '@/lib/utils/url-validation';


// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS UNITS SINGLETON CACHE
// ═══════════════════════════════════════════════════════════════════════════════

let cachedBusinessUnits: BusinessUnit[] | null = null;

async function loadBusinessUnitsFromDB(): Promise<BusinessUnit[]> {
  if (!cachedBusinessUnits) {
    try {
      const units = await db.select().from(businessUnitsTable);
      cachedBusinessUnits = units.map(unit => ({
        name: unit.name,
        keywords:
          typeof unit.keywords === 'string'
            ? (JSON.parse(unit.keywords) as string[])
            : (unit.keywords as string[]) || [],
      }));
      // Business units loaded successfully
    } catch (error) {
      console.error('[Bootstrap] Error loading business units from DB:', error);
      cachedBusinessUnits = [];
    }
  }
  return cachedBusinessUnits;
}

export function clearBusinessUnitsCache(): void {
  cachedBusinessUnits = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD BUSINESS UNITS STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const loadBusinessUnitsStep = wrapTool<void, BusinessUnit[]>(
  {
    name: 'loadBusinessUnits',
    displayName: 'Business Units',
    phase: 'bootstrap',
    dependencies: [],
    optional: false,
    timeout: 10000,
  },
  async (_input, _ctx) => {
    return loadBusinessUnitsFromDB();
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH WEBSITE STEP
// ═══════════════════════════════════════════════════════════════════════════════

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

// Dynamically import Playwright fallback to avoid bundling issues
async function fetchHtmlWithPlaywright(
  url: string
): Promise<{ html: string; headers: Record<string, string>; finalUrl: string }> {
  try {
    const { fetchHtmlWithPlaywright: fetchFn } = await import('../../tools/playwright');
    return fetchFn(url);
  } catch {
    return { html: '', headers: {}, finalUrl: url };
  }
}

export const fetchWebsiteStep = wrapToolWithProgress<BootstrapInput, WebsiteData>(
  {
    name: 'fetchWebsite',
    displayName: 'Website Crawler',
    phase: 'bootstrap',
    dependencies: [],
    optional: false,
    timeout: 30000,
  },
  async (input, ctx, onProgress) => {
    const fullUrl = ctx.fullUrl || input.url;

    // Validate URL
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

    onProgress('Lade Website-Inhalt...');

    try {
      // First try: Simple fetch
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
        response.headers.forEach((value, key) => {
          result.headers[key.toLowerCase()] = value;
        });
      }
    } catch (error) {
      console.error('Simple fetch failed:', error);
    }

    // Fallback: Playwright for bot-protected sites
    if (!result.html || result.html.length < 500) {
      onProgress('Verwende Playwright für geschützte Seite...');
      try {
        const playwrightResult = await fetchHtmlWithPlaywright(fullUrl);
        if (playwrightResult.html && playwrightResult.html.length > result.html.length) {
          result.html = playwrightResult.html;
          result.headers = playwrightResult.headers;
          result.url = playwrightResult.finalUrl;
        }
      } catch (playwrightError) {
        console.error('Playwright fallback failed:', playwrightError);
      }
    }

    // Run Wappalyzer analysis
    if (result.html) {
      onProgress('Analysiere Technologien mit Wappalyzer...');
      try {
        const wappalyzerResult = wappalyzer({
          url: fullUrl,
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

    // Fetch sitemap
    onProgress('Suche nach Sitemap...');
    try {
      const sitemapResult = await fetchSitemapUrls(fullUrl);
      result.sitemapUrls = sitemapResult.urls;
      result.sitemapFound = sitemapResult.found;
      result.sitemapUrl = sitemapResult.sitemapUrl;
    } catch (sitemapError) {
      console.error('Sitemap fetch error:', sitemapError);
    }

    const htmlSize = Math.round(result.html.length / 1024);
    onProgress(`Website geladen: ${htmlSize} KB HTML`);

    return result;
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ALL BOOTSTRAP STEPS
// ═══════════════════════════════════════════════════════════════════════════════

export const bootstrapSteps = [loadBusinessUnitsStep, fetchWebsiteStep];
