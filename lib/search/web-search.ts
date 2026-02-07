/**
 * Web Search Service
 *
 * EXA-basierte Websuche für AI Agents.
 * Fallback auf DuckDuckGo wenn kein EXA API Key vorhanden.
 */

import { searchDuckDuckGo, fetchUrlContents as fetchDuckDuckGo } from './duckduckgo-search';

import { exa, isExaAvailable } from '@/lib/exa';
import { generateText } from 'ai';

import { directOpenAI } from '@/lib/ai/config';

// Simple circuit breaker: if EXA starts returning 402 (credits exceeded),
// stop calling it for a while to reduce noise and latency.
let exaDisabledUntilMs = 0;
function canUseExa(): boolean {
  return Date.now() >= exaDisabledUntilMs;
}

// Separate circuit breaker for OpenAI web search. This prevents log spam and latency
// if credentials are misconfigured (e.g. hub/proxy tokens instead of direct OpenAI keys).
let openaiWebSearchDisabledUntilMs = 0;
function canUseOpenAIWebSearch(): boolean {
  return Date.now() >= openaiWebSearchDisabledUntilMs;
}

async function searchWithOpenAIWebSearch(
  query: string,
  options: { numResults: number }
): Promise<{ results: SearchResult[] }> {
  try {
    // Only attempt OpenAI web search when we have a *direct* OpenAI key available.
    // Using a proxy/hub token against api.openai.com leads to noisy 401s.
    if (!process.env.OPENAI_DIRECT_API_KEY) {
      return { results: [] };
    }

    // Use a small, cheap model by default. This is only used to drive the provider-executed
    // web_search tool; the actual browsing is done on OpenAI's side.
    const modelName = process.env.OPENAI_WEBSEARCH_MODEL || 'gpt-5-mini';

    const result = await generateText({
      // Important: use DIRECT OpenAI (not the AI Hub proxy), because OpenAI's web_search
      // tool is a provider-executed tool available on OpenAI's Responses API.
      model: directOpenAI(modelName),
      prompt: query,
      tools: {
        web_search: directOpenAI.tools.webSearch({
          externalWebAccess: true,
          searchContextSize: 'high',
        }),
      },
      toolChoice: { type: 'tool', toolName: 'web_search' },
      // Keep the assistant answer short; we mainly want sources.
      providerOptions: { openai: { textVerbosity: 'low' } },
      maxOutputTokens: 800,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(20_000),
    });

    const urls = (result.toolResults ?? [])
      .filter(tr => tr.toolName === 'web_search')
      .flatMap(tr => {
        // Tool output is provider-defined; keep it defensive.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const sources = (tr.output as any)?.sources as unknown;
        if (!Array.isArray(sources)) return [];
        return sources
          .map(s => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const url = (s as any)?.url as unknown;
            return typeof url === 'string' ? url : null;
          })
          .filter((u): u is string => typeof u === 'string' && u.length > 0);
      });

    const unique = Array.from(new Set(urls)).slice(0, options.numResults);
    const answerSummary = (result.text || '').trim().slice(0, 3000) || undefined;

    return {
      results: unique.map(url => {
        let title = '';
        try {
          title = new URL(url).hostname;
        } catch {
          title = '';
        }
        return {
          title,
          url,
          summary: answerSummary,
        };
      }),
    };
  } catch (error) {
    console.error('OpenAI web search error:', error);
    // If the key is invalid/misconfigured, back off for a while.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const statusCode = (error as any)?.statusCode as number | undefined;
    if (statusCode === 401 || statusCode === 403) {
      openaiWebSearchDisabledUntilMs = Date.now() + 10 * 60_000;
    }
    return { results: [] };
  }
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

  // Fallback 1: OpenAI provider-executed web search tool (if available)
  if (canUseOpenAIWebSearch() && (exaAttempted ? exaFailed : true)) {
    const openaiResults = await searchWithOpenAIWebSearch(query, { numResults });
    if (openaiResults.results.length > 0) {
      return openaiResults;
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
