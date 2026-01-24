interface SitemapResult {
  urls: string[];
  source: 'sitemap.xml' | 'sitemap_index.xml' | 'robots.txt' | null;
}

async function fetchWithTimeout(url: string, timeout: number = 5000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok ? response : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function parseSitemapXml(xml: string): string[] {
  const urls: string[] = [];

  const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  for (const match of locMatches) {
    urls.push(match[1].trim());
  }

  return urls;
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const response = await fetchWithTimeout(sitemapUrl);
  if (!response) return [];

  const xml = await response.text();
  const urls = parseSitemapXml(xml);

  const sitemapUrls = urls.filter(url => url.endsWith('.xml') || url.includes('sitemap'));

  if (sitemapUrls.length > 0 && sitemapUrls.length === urls.length) {
    const allUrls: string[] = [];
    for (const subSitemapUrl of sitemapUrls.slice(0, 10)) {
      const subUrls = await fetchSitemapUrls(subSitemapUrl);
      allUrls.push(...subUrls);
    }
    return allUrls;
  }

  return urls;
}

function parseSitemapFromRobots(robotsTxt: string): string | null {
  const lines = robotsTxt.split('\n');
  for (const line of lines) {
    const match = line.match(/^Sitemap:\s*(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

export async function fetchSitemap(baseUrl: string): Promise<SitemapResult> {
  const base = baseUrl.replace(/\/$/, '');

  const sitemapXmlUrl = `${base}/sitemap.xml`;
  let urls = await fetchSitemapUrls(sitemapXmlUrl);
  if (urls.length > 0) {
    return { urls, source: 'sitemap.xml' };
  }

  const sitemapIndexUrl = `${base}/sitemap_index.xml`;
  urls = await fetchSitemapUrls(sitemapIndexUrl);
  if (urls.length > 0) {
    return { urls, source: 'sitemap_index.xml' };
  }

  const robotsUrl = `${base}/robots.txt`;
  const robotsResponse = await fetchWithTimeout(robotsUrl);
  if (robotsResponse) {
    const robotsTxt = await robotsResponse.text();
    const sitemapUrl = parseSitemapFromRobots(robotsTxt);
    if (sitemapUrl) {
      urls = await fetchSitemapUrls(sitemapUrl);
      if (urls.length > 0) {
        return { urls, source: 'robots.txt' };
      }
    }
  }

  return { urls: [], source: null };
}
