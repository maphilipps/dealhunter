/**
 * Web Search Service
 *
 * Unified interface for web search using DuckDuckGo (free, no API key required).
 * Replaces EXA for cost-effective local search.
 */

import { searchDuckDuckGo, fetchUrlContents } from './duckduckgo-search';

/**
 * Search results compatible with EXA interface
 */
export interface SearchResult {
  title: string;
  url: string;
  text?: string; // Content summary
  score?: number;
  publishedDate?: string;
  author?: string;
}

/**
 * Search parameters compatible with EXA
 */
export interface SearchOptions {
  numResults?: number;
  type?: 'keyword' | 'neural';
  category?: string;
  summary?: boolean;
  contents?: {
    text?: boolean;
    markdown?: boolean;
  };
}

/**
 * Search the web using DuckDuckGo (free, no API key)
 * Compatible with EXA API for easy migration
 */
export async function searchAndContents(
  keywords: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[] }> {
  const numResults = options.numResults || 5;

  // Search DuckDuckGo
  const { results, error } = await searchDuckDuckGo(keywords, numResults);

  if (error) {
    console.error('DuckDuckGo search error:', error);
    return { results: [] };
  }

  // Fetch contents for each result if requested
  const enrichedResults = await Promise.all(
    results.map(async (result) => {
      const enriched: SearchResult = {
        title: result.title,
        url: result.url,
        text: result.snippet,
      };

      // Fetch full content if summary is requested
      if (options.summary || options.contents?.text) {
        try {
          const { content } = await fetchUrlContents(result.url);
          if (content) {
            enriched.text = content.slice(0, 2000); // Limit to 2KB
          }
        } catch {
          // Keep snippet if fetch fails
        }
      }

      return enriched;
    })
  );

  return { results: enrichedResults };
}

/**
 * Get contents of a specific URL
 * Compatible with EXA API
 */
export async function getContents(
  url: string,
  options: { text?: boolean; markdown?: boolean } = {}
): Promise<{ title?: string; url: string; text?: string; error?: string }> {
  const { content, error } = await fetchUrlContents(url);

  if (error) {
    return { url, error };
  }

  return {
    url,
    text: options.text !== false ? content : undefined,
  };
}

/**
 * Check if web search is available (always true for DuckDuckGo)
 */
export function isWebSearchAvailable(): boolean {
  return true;
}

// Re-export for compatibility with existing code
export const webSearch = {
  searchAndContents,
  getContents,
};
