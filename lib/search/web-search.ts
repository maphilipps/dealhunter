/**
 * Web Search Service
 *
 * EXA-basierte Websuche für AI Agents.
 * Fallback auf DuckDuckGo wenn kein EXA API Key vorhanden.
 */

import { searchDuckDuckGo, fetchUrlContents as fetchDuckDuckGo } from './duckduckgo-search';

import { exa, isExaAvailable } from '@/lib/exa';

// Simple circuit breaker: if EXA starts returning 402 (credits exceeded),
// stop calling it for a while to reduce noise and latency.
let exaDisabledUntilMs = 0;
function canUseExa(): boolean {
  return Date.now() >= exaDisabledUntilMs;
}

/**
 * Search results interface
 */
export interface SearchResult {
  title: string;
  url: string;
  text?: string;
  summary?: string;
  score?: number;
  publishedDate?: string;
  author?: string;
}

/**
 * Search parameters
 */
export interface SearchOptions {
  numResults?: number;
  type?: 'keyword' | 'neural' | 'auto';
  category?:
    | 'company'
    | 'research paper'
    | 'news'
    | 'pdf'
    | 'github'
    | 'tweet'
    | 'personal site'
    | 'financial report'
    | 'people';
  summary?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  contents?: {
    text?: boolean | { maxCharacters?: number };
    highlights?: boolean;
  };
}

/**
 * Search the web using EXA (preferred) or DuckDuckGo (fallback)
 */
export async function searchAndContents(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[] }> {
  const numResults = options.numResults || 5;
  let exaAttempted = false;
  let exaFailed = false;

  // Use EXA if available
  if (canUseExa() && isExaAvailable() && exa) {
    try {
      exaAttempted = true;
      const exaOptions: Record<string, unknown> = {
        numResults,
        type: options.type || 'auto',
      };

      // Add optional parameters
      if (options.category) {
        exaOptions.category = options.category;
      }
      if (options.includeDomains?.length) {
        exaOptions.includeDomains = options.includeDomains;
      }
      if (options.excludeDomains?.length) {
        exaOptions.excludeDomains = options.excludeDomains;
      }
      if (options.startPublishedDate) {
        exaOptions.startPublishedDate = options.startPublishedDate;
      }
      if (options.endPublishedDate) {
        exaOptions.endPublishedDate = options.endPublishedDate;
      }

      // Content options
      if (options.summary) {
        exaOptions.summary = true;
      }
      if (options.contents?.text) {
        exaOptions.text =
          typeof options.contents.text === 'object'
            ? options.contents.text
            : { maxCharacters: 3000 };
      } else {
        // Default: get text content
        exaOptions.text = { maxCharacters: 3000 };
      }

      const response = await exa.searchAndContents(query, exaOptions);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results: response.results.map((r: any) => ({
          title: r.title ?? '',
          url: r.url,
          text: r.text,
          summary: r.summary,
          score: r.score,
          publishedDate: r.publishedDate,
          author: r.author,
        })),
      };
    } catch (error) {
      console.error('EXA search error:', error);
      exaFailed = true;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const statusCode = (error as any)?.statusCode as number | undefined;
      if (statusCode === 402) {
        exaDisabledUntilMs = Date.now() + 10 * 60_000;
      }
      // Fall through to DuckDuckGo
    }
  }

  // Fallback: DuckDuckGo
  if (!isExaAvailable()) {
    console.log('Using DuckDuckGo fallback (EXA_API_KEY not set)');
  } else if (exaAttempted && exaFailed) {
    console.log('Using DuckDuckGo fallback (EXA failed)');
  } else {
    console.log('Using DuckDuckGo fallback');
  }
  const { results, error } = await searchDuckDuckGo(query, numResults);

  if (error) {
    console.error('DuckDuckGo search error:', error);
    return { results: [] };
  }

  // Fetch contents for each result if summary is requested
  const enrichedResults = await Promise.all(
    results.map(async result => {
      const enriched: SearchResult = {
        title: result.title,
        url: result.url,
        text: result.snippet,
      };

      if (options.summary || options.contents?.text) {
        try {
          const { content } = await fetchDuckDuckGo(result.url);
          if (content) {
            enriched.text = content.slice(0, 3000);
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
 * Get contents of a specific URL using EXA or fetch fallback
 */
export async function getContents(
  url: string,
  options: { text?: boolean; maxCharacters?: number } = {}
): Promise<{ title?: string; url: string; text?: string; error?: string }> {
  // Use EXA if available
  if (isExaAvailable() && exa) {
    try {
      const exaOptions: Record<string, unknown> = {};

      if (options.text !== false) {
        exaOptions.text = options.maxCharacters ? { maxCharacters: options.maxCharacters } : true;
      }

      const response = await exa.getContents([url], exaOptions);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = response.results[0] as any;

      if (result) {
        return {
          title: result.title ?? undefined,
          url: result.url,
          text: result.text,
        };
      }
    } catch (error) {
      console.error('EXA getContents error:', error);
      // Fall through to fetch
    }
  }

  // Fallback: Direct fetch
  const { content, error } = await fetchDuckDuckGo(url);

  if (error) {
    return { url, error };
  }

  return {
    url,
    text: options.text !== false ? content : undefined,
  };
}

/**
 * Find similar pages to a given URL (EXA only)
 */
export async function findSimilar(
  url: string,
  options: { numResults?: number; excludeSourceDomain?: boolean } = {}
): Promise<{ results: SearchResult[] }> {
  if (!isExaAvailable() || !exa) {
    console.warn('findSimilar requires EXA API key');
    return { results: [] };
  }

  try {
    const response = await exa.findSimilarAndContents(url, {
      numResults: options.numResults || 5,
      excludeSourceDomain: options.excludeSourceDomain ?? true,
      text: { maxCharacters: 2000 },
    });

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: response.results.map((r: any) => ({
        title: r.title ?? '',
        url: r.url,
        text: r.text,
        score: r.score,
      })),
    };
  } catch (error) {
    console.error('EXA findSimilar error:', error);
    return { results: [] };
  }
}

/**
 * Check if web search is available
 */
export function isWebSearchAvailable(): boolean {
  return true; // Always available (DuckDuckGo fallback)
}

/**
 * Check if EXA is available (for premium features)
 */
export function isExaSearchAvailable(): boolean {
  return isExaAvailable();
}

// Re-export for compatibility with existing code
export const webSearch = {
  searchAndContents,
  getContents,
  findSimilar,
};
