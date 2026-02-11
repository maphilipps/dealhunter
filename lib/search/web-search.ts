/**
 * Web Search Service
 *
 * - searchAndContents(): OpenAI Responses API with webSearchPreview via AI Hub (LiteLLM)
 * - getContents(): Direct HTTP fetch (returns raw page content, not AI summaries)
 *
 * Uses the Responses API (/responses) instead of Chat Completions (/chat/completions)
 * because LiteLLM only supports web_search_preview on the Responses endpoint.
 * API key is loaded from DB (ai_provider_configs) with env var fallback.
 */

import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { generateText, stepCountIs } from 'ai';

import { AI_TIMEOUTS } from '@/lib/ai/config';
import { getModelConfigAsync, getProviderCredentials } from '@/lib/ai/model-config';

// Cached provider instance — recreated when API key changes
let _cached: { provider: OpenAIProvider; keyTail: string } | null = null;

async function getWebSearchProvider(): Promise<OpenAIProvider> {
  const creds = await getProviderCredentials('ai-hub');
  if (!creds.apiKey) throw new Error('AI Hub API key not configured');

  const keyTail = creds.apiKey.slice(-8);
  if (_cached?.keyTail === keyTail) return _cached.provider;

  const provider = createOpenAI({ apiKey: creds.apiKey, baseURL: creds.baseURL });
  _cached = { provider, keyTail };
  return provider;
}

/**
 * Search results interface
 */
export interface SearchResult {
  title: string;
  url: string;
  text?: string;
}

/**
 * Search parameters
 */
export interface SearchOptions {
  numResults?: number;
  includeDomains?: string[];
}

/**
 * Search the web using OpenAI Responses API with webSearchPreview via AI Hub.
 * API key loaded from DB (ai_provider_configs), falls back to env vars.
 */
export async function searchAndContents(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; error?: string }> {
  const numResults = options.numResults ?? 5;

  try {
    const provider = await getWebSearchProvider();
    const config = await getModelConfigAsync('web-search');

    let enrichedQuery = query;
    if (options.includeDomains?.length) {
      enrichedQuery += ` site:${options.includeDomains.join(' OR site:')}`;
    }

    // provider('model') uses the Responses API (/responses endpoint)
    // provider.chat('model') uses Chat Completions — which does NOT support web search on LiteLLM
    const { text, sources } = await generateText({
      model: provider(config.modelName),
      tools: {
        web_search_preview: provider.tools.webSearchPreview({
          searchContextSize: 'low',
        }),
      },
      system:
        'You are a web search assistant. Search the web and return a comprehensive summary of findings. Include key facts, numbers, and details.',
      prompt: `Search for: ${enrichedQuery}\n\nReturn up to ${numResults} relevant results.`,
      stopWhen: stepCountIs(3),
      abortSignal: AbortSignal.timeout(AI_TIMEOUTS.AGENT_SIMPLE),
    });

    const urlSources = sources.filter(s => s.sourceType === 'url');

    if (!urlSources.length) {
      return {
        results: text ? [{ title: 'Web Search Result', url: '', text }] : [],
      };
    }

    return {
      results: urlSources.map(s => ({
        title: s.title ?? '',
        url: s.url,
        text,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown search error';
    console.error('[Web Search] Responses API webSearchPreview error:', message);
    return { results: [], error: message };
  }
}

/**
 * Get raw contents of a specific URL via direct HTTP fetch.
 * Returns actual page text, NOT an AI summary.
 */
export async function getContents(
  url: string,
  options: { text?: boolean; maxCharacters?: number } = {}
): Promise<{ title?: string; url: string; text?: string; error?: string }> {
  try {
    const validUrl = new URL(url);
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      return { url, error: 'Only HTTP/HTTPS URLs are allowed' };
    }

    const response = await fetch(validUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealHunterBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { url, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const maxChars = options.maxCharacters ?? 50_000;

    // Extract title from HTML
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract text content by stripping scripts, styles, and tags
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

    return {
      title,
      url,
      text: textContent.slice(0, maxChars),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Web Search] getContents error:', message);
    return { url, error: message };
  }
}

/**
 * Check if web search is available
 */
export function isWebSearchAvailable(): boolean {
  return true;
}

/**
 * @deprecated No longer relevant — OpenAI webSearchPreview is always used
 */
export function isExaSearchAvailable(): boolean {
  return false;
}

// Re-export for compatibility with existing code
export const webSearch = {
  searchAndContents,
  getContents,
};
