import { z } from 'zod';

import { registry } from './registry';
import type { ToolContext } from './types';

// Import primitive tools
import {
  classifyContentTypes,
  estimateContentTypesFromUrls,
} from '@/lib/quick-scan/tools/content-classifier';
import {
  searchDecisionMakers,
  quickContactSearch,
} from '@/lib/quick-scan/tools/decision-maker-research';
import {
  analyzeMigrationComplexity,
  analyzeWithAI as analyzeMigrationWithAI,
} from '@/lib/quick-scan/tools/migration-analyzer';
import { crawlNavigation, quickNavigationScan } from '@/lib/quick-scan/tools/navigation-crawler';
import { countPages, quickPageCount } from '@/lib/quick-scan/tools/page-counter';
import { runPlaywrightAudit } from '@/lib/quick-scan/tools/playwright';

/**
 * QuickScan 2.0 Agent Tools
 * Composable tools for website analysis - Agent-Native architecture
 */

// ========================================
// Navigation & Structure Tools
// ========================================

const auditNavigationSchema = z.object({
  url: z.string().describe('Website URL'),
  maxDepth: z.number().optional().default(3).describe('Maximale Crawl-Tiefe'),
  maxPages: z.number().optional().default(500).describe('Maximale Anzahl zu crawlender Seiten'),
});

registry.register({
  name: 'quickscan.navigation.full',
  description:
    'Crawlt die vollständige Navigationsstruktur einer Website und erstellt einen Sitemap-Baum',
  category: 'quickscan',
  inputSchema: auditNavigationSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await crawlNavigation(input.url, {
        maxDepth: input.maxDepth,
        maxPages: input.maxPages,
      });
      return {
        success: true,
        data: {
          siteTree: result.siteTree,
          discoveredUrls: result.discoveredUrls.length,
          errors: result.errors,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const quickNavSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'quickscan.navigation.quick',
  description: 'Schneller Scan der Navigation (nur Homepage)',
  category: 'quickscan',
  inputSchema: quickNavSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await quickNavigationScan(input.url);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// Page Counting Tools
// ========================================

const countPagesSchema = z.object({
  url: z.string().describe('Website URL'),
  maxPages: z.number().optional().default(10000).describe('Maximale Anzahl zu zählender Seiten'),
});

registry.register({
  name: 'quickscan.pages.count',
  description: 'Zählt alle Seiten einer Website (Sitemap + Link Discovery + Navigation)',
  category: 'quickscan',
  inputSchema: countPagesSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await countPages(input.url, { maxPages: input.maxPages });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const quickCountSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'quickscan.pages.quick',
  description: 'Schnelle Seitenzählung (nur Sitemap)',
  category: 'quickscan',
  inputSchema: quickCountSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await quickPageCount(input.url);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// Content Classification Tools
// ========================================

const classifyContentSchema = z.object({
  urls: z.array(z.string()).describe('URLs zum Klassifizieren'),
  sampleSize: z.number().optional().default(15).describe('Anzahl zu analysierender Seiten'),
});

registry.register({
  name: 'quickscan.content.classify',
  description: 'Klassifiziert Content-Typen per AI (sampelt 15-20 Seiten)',
  category: 'quickscan',
  inputSchema: classifyContentSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await classifyContentTypes(input.urls, { sampleSize: input.sampleSize });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const estimateContentSchema = z.object({
  urls: z.array(z.string()).describe('URLs zum Analysieren'),
});

registry.register({
  name: 'quickscan.content.estimate',
  description: 'Schätzt Content-Typen basierend auf URL-Patterns (ohne AI)',
  category: 'quickscan',
  inputSchema: estimateContentSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = estimateContentTypesFromUrls(input.urls);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// Migration Analysis Tools
// ========================================

const analyzeMigrationSchema = z.object({
  techStack: z
    .object({
      cms: z.string().optional(),
      cmsVersion: z.string().optional(),
      framework: z.string().optional(),
      backend: z.array(z.string()).optional(),
      analytics: z.array(z.string()).optional(),
      marketing: z.array(z.string()).optional(),
    })
    .describe('Tech Stack Informationen'),
  pageCount: z.number().describe('Anzahl der Seiten'),
  features: z
    .object({
      ecommerce: z.boolean().optional().default(false),
      userAccounts: z.boolean().optional().default(false),
      multiLanguage: z.boolean().optional().default(false),
      search: z.boolean().optional().default(false),
      forms: z.boolean().optional().default(false),
      api: z.boolean().optional().default(false),
    })
    .optional()
    .describe('Erkannte Features'),
});

registry.register({
  name: 'quickscan.migration.analyze',
  description: 'Analysiert die Migrations-Komplexität basierend auf Tech Stack und Content',
  category: 'quickscan',
  inputSchema: analyzeMigrationSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await analyzeMigrationComplexity({
        techStack: input.techStack,
        pageCount: input.pageCount,
        features: input.features ?? {
          ecommerce: false,
          userAccounts: false,
          multiLanguage: false,
          search: false,
          forms: false,
          api: false,
        },
      });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const analyzeMigrationAISchema = z.object({
  techStack: z
    .object({
      cms: z.string().optional(),
      cmsVersion: z.string().optional(),
      framework: z.string().optional(),
      backend: z.array(z.string()).optional(),
      analytics: z.array(z.string()).optional(),
      marketing: z.array(z.string()).optional(),
    })
    .describe('Tech Stack Informationen'),
  pageCount: z.number().describe('Anzahl der Seiten'),
  features: z
    .object({
      ecommerce: z.boolean().optional().default(false),
      userAccounts: z.boolean().optional().default(false),
      multiLanguage: z.boolean().optional().default(false),
      search: z.boolean().optional().default(false),
      forms: z.boolean().optional().default(false),
      api: z.boolean().optional().default(false),
    })
    .optional(),
  html: z.string().optional().describe('HTML der Homepage für AI-Analyse'),
});

registry.register({
  name: 'quickscan.migration.analyzeAI',
  description: 'AI-gestützte Migrations-Analyse mit HTML-Kontext',
  category: 'quickscan',
  inputSchema: analyzeMigrationAISchema,
  async execute(input: z.infer<typeof analyzeMigrationAISchema>, _context: ToolContext) {
    try {
      const result = await analyzeMigrationWithAI({
        techStack: input.techStack,
        pageCount: input.pageCount,
        features: input.features ?? {
          ecommerce: false,
          userAccounts: false,
          multiLanguage: false,
          search: false,
          forms: false,
          api: false,
        },
        html: input.html,
      });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// Contact Research Tools
// ========================================

const searchDecisionMakersSchema = z.object({
  companyName: z.string().describe('Firmenname'),
  websiteUrl: z.string().describe('Website URL'),
});

registry.register({
  name: 'research.decisionMakers',
  description: 'Recherchiert Entscheider (LinkedIn, E-Mail, Impressum)',
  category: 'research',
  inputSchema: searchDecisionMakersSchema,
  async execute(input: z.infer<typeof searchDecisionMakersSchema>, _context: ToolContext) {
    try {
      const result = await searchDecisionMakers(input.companyName, input.websiteUrl);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const quickContactsSchema = z.object({
  websiteUrl: z.string().describe('Website URL'),
});

registry.register({
  name: 'research.contacts.quick',
  description: 'Schnelle Kontaktsuche (nur Impressum)',
  category: 'research',
  inputSchema: quickContactsSchema,
  async execute(input: z.infer<typeof quickContactsSchema>, _context: ToolContext) {
    try {
      const result = await quickContactSearch(input.websiteUrl);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// Accessibility Audit Tool
// ========================================

const auditAccessibilitySchema = z.object({
  url: z.string().describe('Website URL'),
  pagesToAudit: z.number().optional().default(5).describe('Anzahl zu auditierender Seiten'),
});

registry.register({
  name: 'quickscan.accessibility',
  description: 'Führt Accessibility-Audit mit axe-core durch (Multi-Page)',
  category: 'quickscan',
  inputSchema: auditAccessibilitySchema,
  async execute(input, _context: ToolContext) {
    try {
      // Get URLs to audit
      let urlsToAudit: string[] = [input.url];

      // If we have more pages, get some for multi-page audit
      if (input.pagesToAudit > 1) {
        try {
          const navResult = await quickNavigationScan(input.url);
          const navUrls = [
            ...navResult.mainNav.filter(n => n.url).map(n => n.url!),
            ...navResult.footerNav.filter(n => n.url).map(n => n.url!),
          ].slice(0, input.pagesToAudit - 1);

          // Resolve relative URLs
          const baseUrl = new URL(input.url);
          urlsToAudit = [
            input.url,
            ...navUrls
              .map(u => {
                try {
                  return new URL(u, baseUrl.origin).toString();
                } catch {
                  return null;
                }
              })
              .filter((u): u is string => u !== null),
          ].slice(0, input.pagesToAudit);
        } catch {
          // Use only homepage if navigation fails
        }
      }

      // Run audit on the URL (use a placeholder bidId for standalone audit)
      const results = await runPlaywrightAudit(input.url, 'standalone-audit', {
        takeScreenshots: false,
        runAccessibilityAudit: true,
      });

      return {
        success: true,
        data: {
          ...results,
          pagesAudited: urlsToAudit.length,
          auditedUrls: urlsToAudit,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// QuickScan Start Tool (for UI parity)
// ========================================

const startQuickScanSchema = z.object({
  rfpId: z.string().describe('RFP ID für den QuickScan'),
  websiteUrl: z.string().describe('Website URL zum Scannen'),
});

registry.register({
  name: 'quickscan.start',
  description: 'Startet einen vollständigen QuickScan für einen RFP',
  category: 'quickscan',
  inputSchema: startQuickScanSchema,
  async execute(input, _context: ToolContext) {
    // This is a placeholder - the actual QuickScan is orchestrated by the agent
    // This tool signals intent to start a QuickScan
    return {
      success: true,
      data: {
        message: `QuickScan für RFP ${input.rfpId} wird gestartet`,
        websiteUrl: input.websiteUrl,
        rfpId: input.rfpId,
        status: 'initiated',
      },
    };
  },
});

/**
 * List of all QuickScan tool names for reference
 */
export const QUICKSCAN_TOOLS = [
  'quickscan.navigation.full',
  'quickscan.navigation.quick',
  'quickscan.pages.count',
  'quickscan.pages.quick',
  'quickscan.content.classify',
  'quickscan.content.estimate',
  'quickscan.migration.analyze',
  'quickscan.migration.analyzeAI',
  'quickscan.accessibility',
  'quickscan.start',
  'research.decisionMakers',
  'research.contacts.quick',
] as const;

export type QuickScanToolName = (typeof QUICKSCAN_TOOLS)[number];
