/**
 * Web Search Tool for AI Agents
 *
 * Wiederverwendbares Web Search Tool für alle AI Agents.
 * Nutzt DuckDuckGo (kostenlos, ohne API Key).
 *
 * Verwendung in Agents:
 * ```ts
 * import { webSearchTool } from '@/lib/agent-tools/tools/web-search';
 *
 * const result = await streamText({
 *   model: openai('claude-haiku-4'),
 *   tools: { webSearch: webSearchTool },
 *   // ...
 * });
 * ```
 */

import { z } from 'zod';
import { tool } from 'ai';
import { searchAndContents, getContents } from '@/lib/search/web-search';

/**
 * Web Search Tool - Sucht im Web nach Informationen
 */
export const webSearchTool = tool({
  description: `Durchsuche das Web nach aktuellen Informationen.
Nutze dieses Tool für:
- Aktuelle Informationen über Technologien, Frameworks, CMS-Systeme
- Marktrecherche und Wettbewerbsanalyse
- Unternehmensrecherche und News
- Best Practices und Dokumentation
- Preise und Lizenzmodelle

Beispiel-Queries:
- "Drupal 10 features enterprise CMS 2024"
- "Contentful vs Strapi headless CMS comparison"
- "WordPress security vulnerabilities 2024"
- "Magnolia CMS pricing enterprise"`,
  inputSchema: z.object({
    query: z.string().describe('Die Suchanfrage (auf Englisch für bessere Ergebnisse)'),
    numResults: z.number().min(1).max(10).default(5).describe('Anzahl der Ergebnisse (1-10)'),
    fetchContent: z.boolean().default(false).describe('Vollständigen Seiteninhalt abrufen (langsamer, aber detaillierter)'),
  }),
  execute: async ({ query, numResults, fetchContent }: { query: string; numResults: number; fetchContent: boolean }) => {
    try {
      const results = await searchAndContents(query, {
        numResults,
        summary: fetchContent,
      });

      if (results.results.length === 0) {
        return {
          success: false,
          error: 'Keine Ergebnisse gefunden',
          results: [],
        };
      }

      return {
        success: true,
        query,
        results: results.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.text?.slice(0, 500) || '',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        results: [],
      };
    }
  },
});

/**
 * URL Content Fetch Tool - Lädt den Inhalt einer URL
 */
export const fetchUrlTool = tool({
  description: `Lädt den Textinhalt einer URL.
Nutze dieses Tool, um Details von einer Webseite zu lesen,
nachdem du sie über webSearch gefunden hast.`,
  inputSchema: z.object({
    url: z.string().url().describe('Die URL zum Abrufen'),
  }),
  execute: async ({ url }: { url: string }) => {
    try {
      const result = await getContents(url, { text: true });

      if (result.error) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        url: result.url,
        content: result.text?.slice(0, 10000) || '', // Limit to 10KB
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      };
    }
  },
});

/**
 * CMS Research Tool - Spezialisierte Suche für CMS/Technologie-Vergleiche
 */
export const cmsResearchTool = tool({
  description: `Recherchiert spezifische Informationen über CMS-Systeme und Technologien.
Nutze dieses Tool für:
- Feature-Vergleiche zwischen CMS-Systemen
- Lizenz- und Preismodelle
- Enterprise-Tauglichkeit
- Integrationsmöglichkeiten
- Community und Support`,
  inputSchema: z.object({
    technology: z.string().describe('Name der Technologie/des CMS'),
    aspect: z.enum([
      'features',      // Feature-Liste
      'pricing',       // Preise/Lizenzmodell
      'enterprise',    // Enterprise-Funktionen
      'integrations',  // Integrationsmöglichkeiten
      'security',      // Sicherheitsfunktionen
      'comparison',    // Vergleich mit Alternativen
      'reviews',       // Bewertungen und Erfahrungen
      'roadmap',       // Zukunftspläne/Roadmap
    ]).describe('Aspekt der Recherche'),
    compareWith: z.string().optional().describe('Optional: Vergleich mit anderer Technologie'),
  }),
  execute: async ({ technology, aspect, compareWith }: { technology: string; aspect: string; compareWith?: string }) => {
    const queryParts = [technology];

    switch (aspect) {
      case 'features':
        queryParts.push('features capabilities functionality 2024');
        break;
      case 'pricing':
        queryParts.push('pricing license cost enterprise');
        break;
      case 'enterprise':
        queryParts.push('enterprise features scalability large scale');
        break;
      case 'integrations':
        queryParts.push('integrations API plugins extensions');
        break;
      case 'security':
        queryParts.push('security vulnerabilities CVE audit');
        break;
      case 'comparison':
        queryParts.push(compareWith ? `vs ${compareWith} comparison` : 'alternatives comparison');
        break;
      case 'reviews':
        queryParts.push('review experience pros cons');
        break;
      case 'roadmap':
        queryParts.push('roadmap future updates planned features');
        break;
    }

    const query = queryParts.join(' ');

    try {
      const results = await searchAndContents(query, {
        numResults: 5,
        summary: true,
      });

      return {
        success: true,
        technology,
        aspect,
        compareWith,
        query,
        results: results.results.map((r) => ({
          title: r.title,
          url: r.url,
          excerpt: r.text?.slice(0, 800) || '',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        results: [],
      };
    }
  },
});

/**
 * Alle Web Search Tools als Bundle
 */
export const webSearchTools = {
  webSearch: webSearchTool,
  fetchUrl: fetchUrlTool,
  cmsResearch: cmsResearchTool,
};

export type WebSearchTools = typeof webSearchTools;
