/**
 * Website crawling utilities for Deep Migration Analysis
 * Fetches sitemaps, samples pages, and extracts HTML content
 */

import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import { isAllowedUrl, validateUrlResolution } from './url-validator';
import { validateXml } from './xml-validator';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface Sitemap {
  urls: string[];
  total: number;
}

/**
 * Parses sitemap XML using safe parser
 * @param xmlText - XML content to parse
 * @returns Parsed sitemap data
 */
function parseSitemapXml(xmlText: string): any {
  // SECURITY: Validate XML before parsing to prevent XXE attacks
  validateXml(xmlText);

  // SECURITY: Use fast-xml-parser with entity processing disabled
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false, // CRITICAL: Disable external entity processing
    allowBooleanAttributes: true,
    parseTagValue: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  return parser.parse(xmlText);
}

/**
 * Extracts URLs from parsed sitemap data
 * @param result - Parsed XML result
 * @returns Array of URL strings
 */
function extractUrlsFromSitemap(result: any): string[] {
  const urls: string[] = [];

  // Handle urlset format (regular sitemap)
  if (result.urlset && result.urlset.url) {
    const urlEntries = Array.isArray(result.urlset.url)
      ? result.urlset.url
      : [result.urlset.url];

    for (const entry of urlEntries) {
      if (entry.loc) {
        urls.push(String(entry.loc).trim());
      }
    }
  }

  return urls.filter(Boolean);
}

/**
 * Extracts sitemap URLs from sitemap index
 * @param result - Parsed XML result
 * @returns Array of sitemap URL strings
 */
function extractSitemapsFromIndex(result: any): string[] {
  const sitemaps: string[] = [];

  // Handle sitemapindex format
  if (result.sitemapindex && result.sitemapindex.sitemap) {
    const sitemapEntries = Array.isArray(result.sitemapindex.sitemap)
      ? result.sitemapindex.sitemap
      : [result.sitemapindex.sitemap];

    for (const entry of sitemapEntries) {
      if (entry.loc) {
        sitemaps.push(String(entry.loc).trim());
      }
    }
  }

  return sitemaps.filter(Boolean);
}

/**
 * Fetches and parses sitemap.xml from a website
 * Tries common sitemap locations if base sitemap.xml fails
 */
export async function fetchSitemap(websiteUrl: string): Promise<Sitemap> {
  // SSRF Protection: Validate base URL
  if (!isAllowedUrl(websiteUrl)) {
    throw new Error('Invalid URL: URL not allowed for security reasons');
  }

  if (!(await validateUrlResolution(websiteUrl))) {
    throw new Error('Invalid URL: Resolves to private IP address');
  }

  const sitemapUrls = [
    `${websiteUrl}/sitemap.xml`,
    `${websiteUrl}/sitemap_index.xml`,
    `${websiteUrl}/sitemap-index.xml`,
    `${websiteUrl}/wp-sitemap.xml`, // WordPress default
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      // Each sitemap URL is derived from validated base URL, so it's safe
      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        continue; // Try next URL
      }

      const xmlText = await response.text();

      // SECURITY: Parse with XXE protection
      const result = parseSitemapXml(xmlText);

      // Check if this is a sitemap index (contains other sitemaps)
      const sitemapUrls = extractSitemapsFromIndex(result);
      if (sitemapUrls.length > 0) {
        // This is a sitemap index, fetch all referenced sitemaps
        const allUrls: string[] = [];

        for (let i = 0; i < Math.min(sitemapUrls.length, 10); i++) {
          // Limit to 10 sitemaps
          const subSitemapUrl = sitemapUrls[i];
          try {
            // SSRF Protection: Validate sub-sitemap URLs from sitemap index
            if (!isAllowedUrl(subSitemapUrl)) {
              console.warn(`Skipping invalid sub-sitemap URL: ${subSitemapUrl}`);
              continue;
            }

            const subResponse = await fetch(subSitemapUrl, {
              headers: {
                'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
              },
              signal: AbortSignal.timeout(10000),
            });

            if (subResponse.ok) {
              const subXmlText = await subResponse.text();

              // SECURITY: Parse with XXE protection
              const subResult = parseSitemapXml(subXmlText);
              const subUrls = extractUrlsFromSitemap(subResult);
              allUrls.push(...subUrls);
            }
          } catch (error) {
            console.warn(`Failed to fetch sub-sitemap ${subSitemapUrl}:`, error);
          }
        }

        return {
          urls: allUrls,
          total: allUrls.length,
        };
      }

      // Regular sitemap with URLs
      const urls = extractUrlsFromSitemap(result);

      if (urls.length > 0) {
        return {
          urls,
          total: urls.length,
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch sitemap ${sitemapUrl}:`, error);
    }
  }

  throw new Error('No sitemap found. Tried: ' + sitemapUrls.join(', '));
}

/**
 * Samples N representative pages from a list of URLs
 * Uses stratified sampling to get diverse page types
 */
export function samplePages(urls: string[], count: number): string[] {
  if (urls.length <= count) {
    return urls;
  }

  // Stratified sampling: group by path depth and sample from each
  const byDepth = urls.reduce(
    (acc, url) => {
      const depth = url.split('/').length - 3; // -3 for https://domain.com/
      if (!acc[depth]) acc[depth] = [];
      acc[depth].push(url);
      return acc;
    },
    {} as Record<number, string[]>,
  );

  const depths = Object.keys(byDepth).map(Number).sort();
  const samplesPerDepth = Math.ceil(count / depths.length);

  const sampled: string[] = [];
  for (const depth of depths) {
    const depthUrls = byDepth[depth];
    const step = Math.ceil(depthUrls.length / samplesPerDepth);

    for (let i = 0; i < depthUrls.length && sampled.length < count; i += step) {
      sampled.push(depthUrls[i]);
    }
  }

  return sampled.slice(0, count);
}

/**
 * Fetches HTML content from a URL
 * Returns first 10KB to avoid large payloads
 */
export async function fetchPageContent(url: string): Promise<string> {
  // SSRF Protection: Validate URL before fetching
  if (!isAllowedUrl(url)) {
    throw new Error('Invalid URL: URL not allowed for security reasons');
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Return first 10KB (enough for page type classification)
    return html.substring(0, 10000);
  } catch (error) {
    console.warn(`Failed to fetch page ${url}:`, error);
    throw error;
  }
}

/**
 * Extracts title and meta description from HTML
 */
export function extractPageMetadata(html: string): {
  title?: string;
  description?: string;
} {
  const $ = cheerio.load(html);

  return {
    title: $('title').first().text().trim() || undefined,
    description: $('meta[name="description"]').attr('content')?.trim() || undefined,
  };
}
