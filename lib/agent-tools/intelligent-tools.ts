/**
 * Intelligent Agent Tools
 *
 * Raw tool primitives for web search, crawling, GitHub API, and more.
 * Tools return data only — event emission is the agent orchestrator's concern.
 *
 * Preferred: createRawTools() — raw primitives without side effects
 * Deprecated: createIntelligentTools() — backward-compatible wrapper with emission
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  crawlNavigation,
  quickNavigationScan,
} from '@/lib/qualification-scan/tools/navigation-crawler';
import { takeScreenshot } from '@/lib/qualification-scan/tools/playwright';
import { fetchGitHubRepoInfo, findGitHubUrl, KNOWN_GITHUB_REPOS } from '@/lib/search/github-api';
import { searchAndContents, getContents } from '@/lib/search/web-search';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// ========================================
// Types
// ========================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface GitHubInfo {
  latestVersion?: string;
  githubStars?: number;
  lastRelease?: string;
  license?: string;
  description?: string;
  error?: string;
}

export interface PageContent {
  url: string;
  html: string;
  title?: string;
  text?: string;
  links: string[];
  error?: string;
}

export interface SiteCrawlResult {
  pages: PageContent[];
  totalUrls: number;
  siteTree: unknown;
  errors: string[];
}

export interface ScreenshotResult {
  desktop?: string;
  mobile?: string;
  path: string;
}

export interface SitemapResult {
  urls: string[];
  found: boolean;
  sitemapUrl?: string;
}

/**
 * Tool-Aufruf für Activity Stream
 */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  duration?: number;
}

/**
 * Intelligence Tools Interface - verfügbar für alle Agenten
 */
export interface IntelligentTools {
  // Web Search
  webSearch: (query: string, numResults?: number) => Promise<SearchResult[]>;
  fetchUrl: (url: string) => Promise<{ content: string; error?: string }>;

  // GitHub
  githubRepo: (urlOrName: string) => Promise<GitHubInfo>;
  findGitHubUrl: (techName: string) => string | null;

  // Crawling
  crawlPage: (url: string) => Promise<PageContent>;
  crawlSite: (
    url: string,
    options?: { maxDepth?: number; maxPages?: number }
  ) => Promise<SiteCrawlResult>;
  quickNavScan: (url: string) => Promise<{
    mainNav: Array<{
      label: string;
      url?: string;
      children?: Array<{ label: string; url?: string }>;
    }>;
    footerNav: Array<{ label: string; url?: string }>;
    hasSearch: boolean;
    hasBreadcrumbs: boolean;
    hasMegaMenu: boolean;
    estimatedPages: number;
  }>;

  // Screenshots
  screenshot: (url: string, outputPath: string) => Promise<ScreenshotResult>;

  // Sitemap
  fetchSitemap: (url: string) => Promise<SitemapResult>;

  // Activity Tracking
  trackToolCall: (call: ToolCall) => void;
  getToolCalls: () => ToolCall[];
}

/**
 * @deprecated Use createRawTools() instead. Event emission is the orchestrator's concern.
 */
export interface IntelligentToolsContext {
  emit?: EventEmitter;
  agentName?: string;
  bidId?: string;
}

// ========================================
// Raw Tool Primitives (no event emission)
// ========================================

/**
 * Web Search via OpenAI webSearchPreview.
 * Returns data only — no side effects.
 */
export async function webSearch(query: string, numResults = 5): Promise<SearchResult[]> {
  try {
    const { results } = await searchAndContents(query, { numResults });
    return results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.text || '',
    }));
  } catch (error) {
    console.error('[Web Search] Error:', error);
    return [];
  }
}

/**
 * URL Content Fetching via direct HTTP fetch.
 * Returns data only — no side effects.
 */
export async function fetchUrl(url: string): Promise<{ content: string; error?: string }> {
  try {
    const result = await getContents(url, { text: true });
    return { content: result.text || '', error: result.error };
  } catch (error) {
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GitHub Repository Info.
 * Returns data only — no side effects.
 */
export async function githubRepo(urlOrName: string): Promise<GitHubInfo> {
  const githubUrl = urlOrName.includes('github.com') ? urlOrName : findGitHubUrl(urlOrName);
  if (!githubUrl) {
    return { error: `No GitHub URL found for: ${urlOrName}` };
  }
  try {
    return await fetchGitHubRepoInfo(githubUrl);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Single Page Crawling.
 * Returns data only — no side effects.
 */
export async function crawlPage(url: string): Promise<PageContent> {
  try {
    const fetchResult = await getContents(url, { text: true });
    const content = fetchResult.text || '';

    if (fetchResult.error) {
      return { url, html: '', links: [], error: fetchResult.error };
    }

    const linkRegex = /href=["']([^"']+)["']/gi;
    const links: string[] = [];
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    const titleMatch = /<title>([^<]+)<\/title>/i.exec(content);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    return {
      url,
      html: content,
      title,
      text: content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000),
      links: links.slice(0, 100),
    };
  } catch (error) {
    return {
      url,
      html: '',
      links: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Multi-Page Site Crawling.
 * Returns data only — no side effects.
 */
export async function crawlSite(
  url: string,
  options?: { maxDepth?: number; maxPages?: number }
): Promise<SiteCrawlResult> {
  const maxDepth = options?.maxDepth ?? 3;
  const maxPages = options?.maxPages ?? 50;

  try {
    const result = await crawlNavigation(url, { maxDepth, maxPages });

    const urlsToFetch = result.discoveredUrls.slice(0, Math.min(maxPages, 50));
    const pages: PageContent[] = [];

    for (const pageUrl of urlsToFetch) {
      try {
        const fetchResult = await getContents(pageUrl, { text: true });
        const content = fetchResult.text || '';
        if (content) {
          pages.push({
            url: pageUrl,
            html: content.slice(0, 50000),
            text: content
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 5000),
            links: [],
          });
        }
      } catch {
        // Skip failed pages
      }
    }

    return {
      pages,
      totalUrls: result.discoveredUrls.length,
      siteTree: result.siteTree,
      errors: result.errors,
    };
  } catch (error) {
    return {
      pages: [],
      totalUrls: 0,
      siteTree: null,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Quick Navigation Scan.
 * Returns data only — no side effects.
 */
export async function quickNavScan(url: string) {
  return quickNavigationScan(url);
}

/**
 * Screenshot Tool.
 * Returns data only — no side effects.
 */
export async function screenshot(url: string, outputPath: string): Promise<ScreenshotResult> {
  await takeScreenshot(url, outputPath);
  return { path: outputPath };
}

/**
 * Sitemap Fetching.
 * Returns data only — no side effects.
 */
export async function fetchSitemap(url: string): Promise<SitemapResult> {
  const baseUrl = url.startsWith('http') ? url : `https://${url}`;
  const sitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap/sitemap.xml',
    '/page-sitemap.xml',
  ];

  for (const path of sitemapPaths) {
    try {
      const sitemapUrl = new URL(path, baseUrl).toString();
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'DealHunterBot/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const xml = await response.text();

        const urlRegex = /<loc>([^<]+)<\/loc>/gi;
        const urls: string[] = [];
        let match;
        while ((match = urlRegex.exec(xml)) !== null && urls.length < 10000) {
          urls.push(match[1]);
        }

        if (urls.length > 0) {
          return { urls, found: true, sitemapUrl };
        }
      }
    } catch {
      // Try next path
    }
  }

  return { urls: [], found: false };
}

/**
 * Returns the search provider name.
 */
export function getSearchProvider(): string {
  return 'OpenAI Web Search';
}

// ========================================
// Raw Tools Factory (preferred)
// ========================================

/**
 * Create raw tools — pure data primitives without event emission.
 * The agent orchestrator handles progress reporting.
 *
 * Usage:
 * ```ts
 * const tools = createRawTools();
 * const results = await tools.webSearch('Drupal 10 features');
 * const info = await tools.githubRepo('drupal');
 * ```
 */
export function createRawTools(): IntelligentTools {
  const toolCalls: ToolCall[] = [];

  return {
    webSearch,
    fetchUrl,
    githubRepo,
    crawlPage,
    crawlSite,
    quickNavScan,
    screenshot,
    fetchSitemap,
    findGitHubUrl: (techName: string) => findGitHubUrl(techName),
    trackToolCall: (call: ToolCall) => toolCalls.push(call),
    getToolCalls: () => [...toolCalls],
  };
}

// ========================================
// Deprecated Factory (backward compatible)
// ========================================

/**
 * @deprecated Use createRawTools() instead. Event emission should be handled
 * by the agent orchestrator, not embedded in tool implementations.
 *
 * This wrapper composes raw tool primitives with event emission internally.
 * Existing consumers remain unchanged.
 */
export function createIntelligentTools(ctx: IntelligentToolsContext = {}): IntelligentTools {
  const raw = createRawTools();

  // If no emit, just return raw tools (no wrapping needed)
  if (!ctx.emit) {
    return raw;
  }

  const emit = ctx.emit;
  const agent = ctx.agentName;

  return {
    ...raw,
    webSearch: async (query: string, numResults = 5) => {
      const startTime = Date.now();
      const searchProvider = getSearchProvider();
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Researcher',
          message: `Suche [${searchProvider}]: "${query}"`,
          toolCalls: [{ name: 'webSearch', args: { query, numResults } }],
        },
      });
      const results = await raw.webSearch(query, numResults);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Researcher',
          message: `${results.length} Ergebnisse gefunden`,
          toolCalls: [
            {
              name: 'webSearch',
              args: { query },
              result: { count: results.length, provider: searchProvider },
              duration: Date.now() - startTime,
            },
          ],
        },
      });
      return results;
    },
    fetchUrl: async (url: string) => {
      const startTime = Date.now();
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `Lade ${new URL(url).hostname}...`,
          toolCalls: [{ name: 'fetchUrl', args: { url } }],
        },
      });
      const result = await raw.fetchUrl(url);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `${result.content.length} Zeichen geladen`,
          toolCalls: [
            {
              name: 'fetchUrl',
              args: { url },
              result: { size: result.content.length },
              duration: Date.now() - startTime,
            },
          ],
        },
      });
      return result;
    },
    githubRepo: async (urlOrName: string) => {
      const startTime = Date.now();
      const githubUrl = urlOrName.includes('github.com') ? urlOrName : findGitHubUrl(urlOrName);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Researcher',
          message: `GitHub: ${(githubUrl || urlOrName).replace('https://github.com/', '')}`,
          toolCalls: [{ name: 'githubRepo', args: { url: githubUrl || urlOrName } }],
        },
      });
      const info = await raw.githubRepo(urlOrName);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Researcher',
          message: info.latestVersion
            ? `v${info.latestVersion}, ${info.githubStars} Stars`
            : 'Repository Info geladen',
          toolCalls: [
            {
              name: 'githubRepo',
              args: { url: githubUrl || urlOrName },
              result: { version: info.latestVersion, stars: info.githubStars },
              duration: Date.now() - startTime,
            },
          ],
        },
      });
      return info;
    },
    crawlPage: async (url: string) => {
      const startTime = Date.now();
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `Crawle ${new URL(url).pathname}...`,
          toolCalls: [{ name: 'crawlPage', args: { url } }],
        },
      });
      const result = await raw.crawlPage(url);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `${result.links.length} Links gefunden`,
          toolCalls: [
            {
              name: 'crawlPage',
              args: { url },
              result: { links: result.links.length, title: result.title },
              duration: Date.now() - startTime,
            },
          ],
        },
      });
      return result;
    },
    crawlSite: async (url: string, options?: { maxDepth?: number; maxPages?: number }) => {
      const startTime = Date.now();
      const maxPages = options?.maxPages ?? 50;
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `Starte Site-Crawling (max ${maxPages} Seiten)...`,
          toolCalls: [{ name: 'crawlSite', args: { url, ...options } }],
        },
      });
      const result = await raw.crawlSite(url, options);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `${result.pages.length} Seiten gecrawlt, ${result.totalUrls} URLs entdeckt`,
          toolCalls: [
            {
              name: 'crawlSite',
              args: { url, ...options },
              result: {
                pagesLoaded: result.pages.length,
                urlsDiscovered: result.totalUrls,
              },
              duration: Date.now() - startTime,
            },
          ],
        },
      });
      return result;
    },
    quickNavScan: async (url: string) => {
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `Navigation-Scan...`,
          toolCalls: [{ name: 'quickNavScan', args: { url } }],
        },
      });
      const result = await raw.quickNavScan(url);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `${result.mainNav.length} Nav-Items, ~${result.estimatedPages} Seiten`,
        },
      });
      return result;
    },
    screenshot: async (url: string, outputPath: string) => {
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Screenshot',
          message: `Screenshot von ${new URL(url).hostname}...`,
          toolCalls: [{ name: 'screenshot', args: { url } }],
        },
      });
      return raw.screenshot(url, outputPath);
    },
    fetchSitemap: async (url: string) => {
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: `Suche Sitemap...`,
          toolCalls: [{ name: 'fetchSitemap', args: { url } }],
        },
      });
      const result = await raw.fetchSitemap(url);
      emit({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: agent || 'Crawler',
          message: result.found
            ? `Sitemap: ${result.urls.length} URLs gefunden`
            : `Keine Sitemap gefunden`,
        },
      });
      return result;
    },
  };
}

// ========================================
// AI SDK Tool Wrappers
// ========================================

/**
 * Web Search Tool für AI SDK (OpenAI webSearchPreview)
 */
export const webSearchAITool = tool({
  description: `Durchsuche das Web nach aktuellen Informationen.
Nutze dieses Tool für:
- Technologie-Informationen (CMS, Frameworks, Versionen)
- Unternehmensrecherche
- Markt- und Wettbewerbsanalyse
- Aktuelle News und Trends`,
  inputSchema: z.object({
    query: z.string().describe('Suchanfrage'),
    numResults: z.number().min(1).max(10).default(5),
  }),
  execute: async ({ query, numResults }: { query: string; numResults: number }) => {
    const { results } = await searchAndContents(query, { numResults });
    return results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.text || '',
    }));
  },
});

/**
 * GitHub Tool für AI SDK
 */
export const githubAITool = tool({
  description: `Hole Informationen von GitHub Repositories.
Nutze dieses Tool für:
- CMS/Framework Versionen
- Letzte Release-Daten
- Repository-Aktivität (Stars, Commits)`,
  inputSchema: z.object({
    technology: z.string().describe('Name der Technologie (z.B. "drupal", "wordpress", "typo3")'),
  }),
  execute: async ({ technology }: { technology: string }) => {
    const githubUrl = findGitHubUrl(technology);
    if (!githubUrl) {
      return { error: `Keine GitHub URL für ${technology} gefunden` };
    }
    return fetchGitHubRepoInfo(githubUrl);
  },
});

/**
 * Site Crawl Tool für AI SDK
 */
export const crawlSiteAITool = tool({
  description: `Crawle eine Website um alle Seiten und deren Struktur zu entdecken.
Nutze dieses Tool für:
- Seitenanzahl ermitteln
- Site-Struktur verstehen
- Content-Typen identifizieren`,
  inputSchema: z.object({
    url: z.string().describe('Website URL'),
    maxPages: z.number().min(10).max(100).default(50),
  }),
  execute: async ({ url, maxPages }: { url: string; maxPages: number }) => {
    const result = await crawlNavigation(url, { maxPages, maxDepth: 3 });
    return {
      totalUrls: result.discoveredUrls.length,
      siteTree: result.siteTree,
      errors: result.errors.length,
    };
  },
});

/**
 * Alle AI SDK Tools als Bundle
 */
export const intelligentAITools = {
  webSearch: webSearchAITool,
  github: githubAITool,
  crawlSite: crawlSiteAITool,
};

// ========================================
// Exports
// ========================================

export { KNOWN_GITHUB_REPOS };
