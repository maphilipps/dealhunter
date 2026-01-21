/**
 * DuckDuckGo Local Search
 *
 * Kostenlose Web-Suche ohne API Key.
 * Verwendet DuckDuckGo HTML-Seite und extrahiert Ergebnisse.
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResponse {
  results: SearchResult[];
  error?: string;
}

interface ContentResponse {
  content: string;
  error?: string;
}

/**
 * Search DuckDuckGo locally without API key
 * Scrapes the HTML results page for search results
 */
export async function searchDuckDuckGo(query: string, numResults = 5): Promise<SearchResponse> {
  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealHunterBot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { results: [], error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const results = parseSearchResults(html, numResults);

    return { results };
  } catch (error) {
    return {
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse search results from DuckDuckGo HTML
 */
function parseSearchResults(html: string, numResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Simple regex-based parsing (more robust than full HTML parser for this use case)
  const resultPattern = /<class[^>]*result[^>]*>[\s\S]*?<\/div>/gi;
  const titlePattern = /<a[^>]*class="result__a[^"]*"[^>]*>([^<]+)<\/a>/i;
  const urlPattern = /<a[^>]*class="result__url[^"]*"[^>]*href="([^"]+)"/i;
  const snippetPattern = /<a[^>]*class="result__snippet[^"]*"[^>]*>([^<]+)<\/a>/i;

  let match;
  let count = 0;

  while ((match = resultPattern.exec(html)) !== null && count < numResults) {
    const resultHtml = match[0];

    const titleMatch = titlePattern.exec(resultHtml);
    const urlMatch = urlPattern.exec(resultHtml);
    const snippetMatch = snippetPattern.exec(resultHtml);

    if (titleMatch && urlMatch) {
      results.push({
        title: cleanText(titleMatch[1]),
        url: decodeURIComponent(urlMatch[1].replace(/\/l\/\?uddg=/, '')),
        snippet: snippetMatch ? cleanText(snippetMatch[1]) : '',
      });
      count++;
    }

    // Reset regex for next match
    titlePattern.lastIndex = 0;
    urlPattern.lastIndex = 0;
    snippetPattern.lastIndex = 0;
  }

  return results;
}

/**
 * Clean text from HTML entities and extra whitespace
 */
function cleanText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get contents of a URL (for fetching full page content)
 * Simplified version without Playwright for better performance
 */
export async function fetchUrlContents(url: string): Promise<ContentResponse> {
  try {
    // Validate URL
    const validUrl = new URL(url);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return { content: '', error: 'Only HTTP/HTTPS URLs are allowed' };
    }

    const response = await fetch(validUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealHunterBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { content: '', error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // Extract text content (simple regex-based approach)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit to 50KB to prevent memory issues
    return { content: textContent.slice(0, 50000) };
  } catch (error) {
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
