/**
 * Website crawling utilities for Deep Migration Analysis
 * Fetches sitemaps, samples pages, and extracts HTML content
 */

import * as cheerio from 'cheerio';

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
 * Fetches and parses sitemap.xml from a website
 * Tries common sitemap locations if base sitemap.xml fails
 */
export async function fetchSitemap(websiteUrl: string): Promise<Sitemap> {
  const sitemapUrls = [
    `${websiteUrl}/sitemap.xml`,
    `${websiteUrl}/sitemap_index.xml`,
    `${websiteUrl}/sitemap-index.xml`,
    `${websiteUrl}/wp-sitemap.xml`, // WordPress default
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
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
      const $ = cheerio.load(xmlText, { xmlMode: true });

      // Check if this is a sitemap index (contains other sitemaps)
      const sitemapTags = $('sitemap loc');
      if (sitemapTags.length > 0) {
        // This is a sitemap index, fetch all referenced sitemaps
        const allUrls: string[] = [];

        for (let i = 0; i < Math.min(sitemapTags.length, 10); i++) { // Limit to 10 sitemaps
          const subSitemapUrl = $(sitemapTags[i]).text().trim();
          try {
            const subResponse = await fetch(subSitemapUrl, {
              headers: {
                'User-Agent': 'Dealhunter-DeepAnalysis/1.0 (Migration Analysis Bot)',
              },
              signal: AbortSignal.timeout(10000),
            });

            if (subResponse.ok) {
              const subXmlText = await subResponse.text();
              const sub$ = cheerio.load(subXmlText, { xmlMode: true });
              sub$('url loc').each((_, el) => {
                const url = sub$(el).text().trim();
                if (url) allUrls.push(url);
              });
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
      const urls: string[] = [];
      $('url loc').each((_, el) => {
        const url = $(el).text().trim();
        if (url) urls.push(url);
      });

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
  const byDepth = urls.reduce((acc, url) => {
    const depth = (url.split('/').length - 3); // -3 for https://domain.com/
    if (!acc[depth]) acc[depth] = [];
    acc[depth].push(url);
    return acc;
  }, {} as Record<number, string[]>);

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
