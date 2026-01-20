/**
 * Intelligent Agent Tools
 *
 * Unified interface für alle Intelligence Tools - macht jeden Agent "intelligent"
 * durch Zugriff auf Web Search, Crawling, GitHub API und mehr.
 *
 * Diese Tools werden von allen Agenten genutzt:
 * - Quick Scan Agent
 * - CMS Matching Agent
 * - BIT Evaluation Agents
 * - Company Research Agent
 */

import { z } from 'zod';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { AgentEventType } from '@/lib/streaming/event-types';

// Import existing tools
import { searchAndContents, getContents, isExaSearchAvailable } from '@/lib/search/web-search';
import { fetchGitHubRepoInfo, findGitHubUrl, KNOWN_GITHUB_REPOS } from '@/lib/search/github-api';
import { takeScreenshot } from '@/lib/quick-scan/tools/playwright';
import { crawlNavigation, quickNavigationScan } from '@/lib/quick-scan/tools/navigation-crawler';

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
  siteTree: any;
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
  crawlSite: (url: string, options?: { maxDepth?: number; maxPages?: number }) => Promise<SiteCrawlResult>;
  quickNavScan: (url: string) => Promise<{
    mainNav: Array<{ label: string; url?: string; children?: Array<{ label: string; url?: string }> }>;
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
 * Context für Tool-Erstellung
 */
export interface IntelligentToolsContext {
  emit?: EventEmitter;
  agentName?: string;
  bidId?: string;
}

// ========================================
// Tool Implementations
// ========================================

/**
 * Web Search via EXA (with DuckDuckGo fallback)
 */
async function createWebSearch(ctx: IntelligentToolsContext) {
  return async (query: string, numResults = 5): Promise<SearchResult[]> => {
    const startTime = Date.now();
    const searchProvider = isExaSearchAvailable() ? 'EXA' : 'DuckDuckGo';

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Researcher',
        message: `Suche [${searchProvider}]: "${query}"`,
        toolCalls: [{ name: 'webSearch', args: { query, numResults } }],
      },
    });

    try {
      const { results } = await searchAndContents(query, { numResults });

      const searchResults = results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.text || r.summary || '',
      }));

      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Researcher',
          message: `${searchResults.length} Ergebnisse gefunden`,
          toolCalls: [{
            name: 'webSearch',
            args: { query },
            result: { count: searchResults.length, provider: searchProvider },
            duration: Date.now() - startTime,
          }],
        },
      });

      return searchResults;
    } catch (error) {
      console.error('[Web Search] Error:', error);
      return [];
    }
  };
}

/**
 * URL Content Fetching via EXA (with fetch fallback)
 */
async function createFetchUrl(ctx: IntelligentToolsContext) {
  return async (url: string): Promise<{ content: string; error?: string }> => {
    const startTime = Date.now();

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `Lade ${new URL(url).hostname}...`,
        toolCalls: [{ name: 'fetchUrl', args: { url } }],
      },
    });

    try {
      const result = await getContents(url, { text: true });
      const content = result.text || '';

      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Crawler',
          message: `${content.length} Zeichen geladen`,
          toolCalls: [{
            name: 'fetchUrl',
            args: { url },
            result: { size: content.length },
            duration: Date.now() - startTime,
          }],
        },
      });

      return { content, error: result.error };
    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };
}

/**
 * GitHub Repository Info
 */
async function createGitHubRepo(ctx: IntelligentToolsContext) {
  return async (urlOrName: string): Promise<GitHubInfo> => {
    const startTime = Date.now();

    // Find GitHub URL if only name given
    const githubUrl = urlOrName.includes('github.com')
      ? urlOrName
      : findGitHubUrl(urlOrName);

    if (!githubUrl) {
      return { error: `No GitHub URL found for: ${urlOrName}` };
    }

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Researcher',
        message: `GitHub: ${githubUrl.replace('https://github.com/', '')}`,
        toolCalls: [{ name: 'githubRepo', args: { url: githubUrl } }],
      },
    });

    try {
      const info = await fetchGitHubRepoInfo(githubUrl);

      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Researcher',
          message: info.latestVersion
            ? `v${info.latestVersion}, ${info.githubStars} Stars`
            : 'Repository Info geladen',
          toolCalls: [{
            name: 'githubRepo',
            args: { url: githubUrl },
            result: { version: info.latestVersion, stars: info.githubStars },
            duration: Date.now() - startTime,
          }],
        },
      });

      return info;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };
}

/**
 * Single Page Crawling
 */
async function createCrawlPage(ctx: IntelligentToolsContext) {
  return async (url: string): Promise<PageContent> => {
    const startTime = Date.now();

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `Crawle ${new URL(url).pathname}...`,
        toolCalls: [{ name: 'crawlPage', args: { url } }],
      },
    });

    try {
      const fetchResult = await getContents(url, { text: true });
      const content = fetchResult.text || '';

      if (fetchResult.error) {
        return { url, html: '', links: [], error: fetchResult.error };
      }

      // Extract links from HTML
      const linkRegex = /href=["']([^"']+)["']/gi;
      const links: string[] = [];
      let match;
      while ((match = linkRegex.exec(content)) !== null) {
        links.push(match[1]);
      }

      // Extract title
      const titleMatch = /<title>([^<]+)<\/title>/i.exec(content);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      const result: PageContent = {
        url,
        html: content,
        title,
        text: content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000),
        links: links.slice(0, 100),
      };

      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Crawler',
          message: `${links.length} Links gefunden`,
          toolCalls: [{
            name: 'crawlPage',
            args: { url },
            result: { links: links.length, title },
            duration: Date.now() - startTime,
          }],
        },
      });

      return result;
    } catch (error) {
      return {
        url,
        html: '',
        links: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };
}

/**
 * Multi-Page Site Crawling
 */
async function createCrawlSite(ctx: IntelligentToolsContext) {
  return async (url: string, options?: { maxDepth?: number; maxPages?: number }): Promise<SiteCrawlResult> => {
    const startTime = Date.now();
    const maxDepth = options?.maxDepth ?? 3;
    const maxPages = options?.maxPages ?? 50;

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `Starte Site-Crawling (max ${maxPages} Seiten)...`,
        toolCalls: [{ name: 'crawlSite', args: { url, maxDepth, maxPages } }],
      },
    });

    try {
      const result = await crawlNavigation(url, { maxDepth, maxPages });

      // Fetch content for discovered URLs (sample)
      const urlsToFetch = result.discoveredUrls.slice(0, Math.min(maxPages, 50));
      const pages: PageContent[] = [];

      for (let i = 0; i < urlsToFetch.length; i++) {
        const pageUrl = urlsToFetch[i];

        if ((i + 1) % 10 === 0) {
          ctx.emit?.({
            type: AgentEventType.AGENT_PROGRESS,
            data: {
              agent: ctx.agentName || 'Crawler',
              message: `Crawle Seiten (${i + 1}/${urlsToFetch.length})...`,
            },
          });
        }

        try {
          const fetchResult = await getContents(pageUrl, { text: true });
          const content = fetchResult.text || '';
          if (content) {
            pages.push({
              url: pageUrl,
              html: content.slice(0, 50000), // Limit HTML size
              text: content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000),
              links: [],
            });
          }
        } catch {
          // Skip failed pages
        }
      }

      ctx.emit?.({
        type: AgentEventType.AGENT_PROGRESS,
        data: {
          agent: ctx.agentName || 'Crawler',
          message: `${pages.length} Seiten gecrawlt, ${result.discoveredUrls.length} URLs entdeckt`,
          toolCalls: [{
            name: 'crawlSite',
            args: { url, maxDepth, maxPages },
            result: {
              pagesLoaded: pages.length,
              urlsDiscovered: result.discoveredUrls.length,
            },
            duration: Date.now() - startTime,
          }],
        },
      });

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
  };
}

/**
 * Quick Navigation Scan
 */
async function createQuickNavScan(ctx: IntelligentToolsContext) {
  return async (url: string) => {
    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `Navigation-Scan...`,
        toolCalls: [{ name: 'quickNavScan', args: { url } }],
      },
    });

    const result = await quickNavigationScan(url);

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `${result.mainNav.length} Nav-Items, ~${result.estimatedPages} Seiten`,
      },
    });

    return result;
  };
}

/**
 * Screenshot Tool
 */
async function createScreenshot(ctx: IntelligentToolsContext) {
  return async (url: string, outputPath: string): Promise<ScreenshotResult> => {
    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Screenshot',
        message: `Screenshot von ${new URL(url).hostname}...`,
        toolCalls: [{ name: 'screenshot', args: { url } }],
      },
    });

    await takeScreenshot(url, outputPath);

    return { path: outputPath };
  };
}

/**
 * Sitemap Fetching
 */
async function createFetchSitemap(ctx: IntelligentToolsContext) {
  return async (url: string): Promise<SitemapResult> => {
    const baseUrl = url.startsWith('http') ? url : `https://${url}`;
    const sitemapPaths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml', '/page-sitemap.xml'];

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `Suche Sitemap...`,
        toolCalls: [{ name: 'fetchSitemap', args: { url } }],
      },
    });

    for (const path of sitemapPaths) {
      try {
        const sitemapUrl = new URL(path, baseUrl).toString();
        const response = await fetch(sitemapUrl, {
          headers: { 'User-Agent': 'DealHunterBot/1.0' },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const xml = await response.text();

          // Extract URLs from sitemap
          const urlRegex = /<loc>([^<]+)<\/loc>/gi;
          const urls: string[] = [];
          let match;
          while ((match = urlRegex.exec(xml)) !== null && urls.length < 10000) {
            urls.push(match[1]);
          }

          if (urls.length > 0) {
            ctx.emit?.({
              type: AgentEventType.AGENT_PROGRESS,
              data: {
                agent: ctx.agentName || 'Crawler',
                message: `Sitemap: ${urls.length} URLs gefunden`,
              },
            });

            return { urls, found: true, sitemapUrl };
          }
        }
      } catch {
        // Try next path
      }
    }

    ctx.emit?.({
      type: AgentEventType.AGENT_PROGRESS,
      data: {
        agent: ctx.agentName || 'Crawler',
        message: `Keine Sitemap gefunden`,
      },
    });

    return { urls: [], found: false };
  };
}

// ========================================
// Factory Function
// ========================================

/**
 * Create Intelligent Tools for an Agent
 *
 * Usage:
 * ```ts
 * const tools = createIntelligentTools({ emit, agentName: 'QuickScan' });
 *
 * // Web Search
 * const results = await tools.webSearch('Drupal 10 features');
 *
 * // GitHub
 * const drupalInfo = await tools.githubRepo('drupal');
 *
 * // Crawling
 * const site = await tools.crawlSite('https://example.com', { maxPages: 50 });
 * ```
 */
export function createIntelligentTools(ctx: IntelligentToolsContext = {}): IntelligentTools {
  const toolCalls: ToolCall[] = [];

  return {
    webSearch: createWebSearch(ctx) as unknown as IntelligentTools['webSearch'],
    fetchUrl: createFetchUrl(ctx) as unknown as IntelligentTools['fetchUrl'],
    githubRepo: createGitHubRepo(ctx) as unknown as IntelligentTools['githubRepo'],
    findGitHubUrl: (techName: string) => findGitHubUrl(techName),
    crawlPage: createCrawlPage(ctx) as unknown as IntelligentTools['crawlPage'],
    crawlSite: createCrawlSite(ctx) as unknown as IntelligentTools['crawlSite'],
    quickNavScan: createQuickNavScan(ctx) as unknown as IntelligentTools['quickNavScan'],
    screenshot: createScreenshot(ctx) as unknown as IntelligentTools['screenshot'],
    fetchSitemap: createFetchSitemap(ctx) as unknown as IntelligentTools['fetchSitemap'],
    trackToolCall: (call: ToolCall) => toolCalls.push(call),
    getToolCalls: () => [...toolCalls],
  };
}

// ========================================
// AI SDK Tool Wrappers
// ========================================

import { tool } from 'ai';

/**
 * Web Search Tool für AI SDK (EXA mit DuckDuckGo Fallback)
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
      snippet: r.text || r.summary || '',
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
