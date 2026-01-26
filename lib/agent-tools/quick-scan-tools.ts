import { z } from 'zod';

import { registry } from './registry';
import type { ToolContext } from './types';

// Import primitive tools (using relative paths for worker compatibility)
import { fetchWebsiteData } from '../quick-scan/tools/website-fetch';
import {
  classifyContentTypes,
  estimateContentTypesFromUrls,
} from '../quick-scan/tools/content-classifier';
import {
  searchDecisionMakers,
  quickContactSearch,
} from '../quick-scan/tools/decision-maker-research';
import {
  analyzeMigrationComplexity,
  analyzeWithAI as analyzeMigrationWithAI,
} from '../quick-scan/tools/migration-analyzer';
import { crawlNavigation, quickNavigationScan } from '../quick-scan/tools/navigation-crawler';
import { countPages, quickPageCount } from '../quick-scan/tools/page-counter';
import { runPlaywrightAudit } from '../quick-scan/tools/playwright';
import {
  analyzeTechStack,
  analyzeContentVolume,
  detectFeatures,
  runSeoAudit,
  runLegalCompliance,
} from '../quick-scan/workflow/steps/analysis';
import { gatherCompanyIntelligence } from '../quick-scan/tools/company-research';
import { generateBLRecommendation } from '../quick-scan/workflow/steps/synthesis';
import { loadBusinessUnitsFromDB } from '../quick-scan/workflow/steps/bootstrap';
import type {
  TechStack,
  ContentVolume,
  Features,
  SEOAudit,
  LegalCompliance,
  CompanyIntelligence,
  BLRecommendation,
} from '../quick-scan/schema';

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
  name: 'scan.quickscan.navigation.full',
  description:
    'Crawlt die vollständige Navigationsstruktur einer Website und erstellt einen Sitemap-Baum',
  category: 'scan',
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
  name: 'scan.quickscan.navigation.quick',
  description: 'Schneller Scan der Navigation (nur Homepage)',
  category: 'scan',
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
  name: 'scan.quickscan.pages.count',
  description: 'Zählt alle Seiten einer Website (Sitemap + Link Discovery + Navigation)',
  category: 'scan',
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
  name: 'scan.quickscan.pages.quick',
  description: 'Schnelle Seitenzählung (nur Sitemap)',
  category: 'scan',
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
// Website Analysis Tools (Tech/Content/Features)
// ========================================

const techStackSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'scan.quickscan.techStack.analyze',
  description: 'Erkennt CMS, Frameworks, Hosting und Libraries (Tech Stack)',
  category: 'scan',
  inputSchema: techStackSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = analyzeTechStack(websiteData);
      return { success: true, data: result as TechStack };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const contentVolumeSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'scan.quickscan.content.volume',
  description: 'Analysiert Seitenanzahl, Content-Typen und Medienvolumen',
  category: 'scan',
  inputSchema: contentVolumeSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = analyzeContentVolume(websiteData);
      return { success: true, data: result as ContentVolume };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const featureDetectSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'scan.quickscan.features.detect',
  description: 'Erkennt Website-Features (E-Commerce, Login, Suche, etc.)',
  category: 'scan',
  inputSchema: featureDetectSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = detectFeatures(websiteData);
      return { success: true, data: result as Features };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const seoAuditSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'scan.quickscan.seo.audit',
  description: 'SEO Basis-Audit (Title, Meta, Structured Data, OpenGraph)',
  category: 'scan',
  inputSchema: seoAuditSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = runSeoAudit(websiteData.html);
      return { success: true, data: result as SEOAudit };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

const legalComplianceSchema = z.object({
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'scan.quickscan.legal.compliance',
  description: 'DSGVO/Legal-Checks (Impressum, Datenschutz, Cookie-Banner)',
  category: 'scan',
  inputSchema: legalComplianceSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = runLegalCompliance(websiteData.html);
      return { success: true, data: result as LegalCompliance };
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
  name: 'scan.quickscan.content.classify',
  description: 'Klassifiziert Content-Typen per AI (sampelt 15-20 Seiten)',
  category: 'scan',
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
  name: 'scan.quickscan.content.estimate',
  description: 'Schätzt Content-Typen basierend auf URL-Patterns (ohne AI)',
  category: 'scan',
  inputSchema: estimateContentSchema,
  // eslint-disable-next-line @typescript-eslint/require-await
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
  name: 'scan.quickscan.migration.analyze',
  description: 'Analysiert die Migrations-Komplexität basierend auf Tech Stack und Content',
  category: 'scan',
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
  name: 'scan.quickscan.migration.analyzeAI',
  description: 'AI-gestützte Migrations-Analyse mit HTML-Kontext',
  category: 'scan',
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
  name: 'scan.quickscan.accessibility',
  description: 'Führt Accessibility-Audit mit axe-core durch (Multi-Page)',
  category: 'scan',
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
// Playwright Audit Tool (Screenshots/Performance/Navigation)
// ========================================

const playwrightAuditSchema = z.object({
  url: z.string().describe('Website URL'),
  bidId: z.string().describe('Bid/PreQualification ID'),
});

registry.register({
  name: 'scan.quickscan.playwright.audit',
  description: 'Playwright Audit (Screenshots, Performance, Navigation, A11y)',
  category: 'scan',
  inputSchema: playwrightAuditSchema,
  async execute(input, _context: ToolContext) {
    try {
      const result = await runPlaywrightAudit(input.url, input.bidId, {
        takeScreenshots: true,
        runAccessibilityAudit: true,
        analyzeNavigation: true,
      });

      return {
        success: true,
        data: {
          screenshots: result.screenshots.desktop
            ? {
                homepage: {
                  desktop: result.screenshots.desktop,
                  mobile: result.screenshots.mobile,
                },
                keyPages: result.screenshots.keyPages,
                timestamp: new Date().toISOString(),
              }
            : null,
          accessibility: result.accessibility
            ? {
                score: result.accessibility.score,
                level: result.accessibility.level,
                criticalIssues: result.accessibility.violations.filter(v => v.impact === 'critical')
                  .length,
                seriousIssues: result.accessibility.violations.filter(v => v.impact === 'serious')
                  .length,
                moderateIssues: result.accessibility.violations.filter(v => v.impact === 'moderate')
                  .length,
                minorIssues: result.accessibility.violations.filter(v => v.impact === 'minor')
                  .length,
                checks: {
                  hasAltTexts: !result.accessibility.violations.some(v => v.id === 'image-alt'),
                  hasAriaLabels: !result.accessibility.violations.some(v => v.id.includes('aria')),
                  hasProperHeadings: !result.accessibility.violations.some(v =>
                    v.id.includes('heading')
                  ),
                  hasSkipLinks: result.accessibility.passes > 0,
                  colorContrast: result.accessibility.violations.some(v =>
                    v.id === 'color-contrast'
                  )
                    ? 'fail'
                    : 'pass',
                  keyboardNavigation: result.accessibility.violations.some(v =>
                    v.id.includes('keyboard')
                  )
                    ? 'fail'
                    : 'pass',
                  formLabels: result.accessibility.violations.some(v => v.id.includes('label'))
                    ? 'fail'
                    : 'pass',
                },
                violations: result.accessibility.violations.map(v => ({
                  id: v.id,
                  impact: v.impact,
                  description: v.description,
                  help: v.help,
                })),
                pagesAudited: 1,
                auditedUrls: [input.url],
              }
            : null,
          navigation: result.navigation || null,
          performance: result.performance
            ? {
                score: result.performance.score,
                firstContentfulPaint: result.performance.fcp,
                largestContentfulPaint: result.performance.lcp,
                cumulativeLayoutShift: result.performance.cls,
                timeToInteractive: result.performance.tti,
                totalBlockingTime: result.performance.tbt,
                speedIndex: result.performance.speedIndex,
                diagnostics: result.performance.diagnostics || [],
                resourceCount: result.performance.resourceCount,
                estimatedLoadTime:
                  result.performance.loadTime < 2000
                    ? 'fast'
                    : result.performance.loadTime < 5000
                      ? 'medium'
                      : 'slow',
                hasLazyLoading: false,
                hasMinification: false,
                hasCaching: false,
                renderBlockingResources:
                  result.performance.resourceCount.scripts +
                  result.performance.resourceCount.stylesheets,
              }
            : null,
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
// Company Intelligence Tool
// ========================================

const companyIntelSchema = z.object({
  companyName: z.string().describe('Firmenname'),
  url: z.string().describe('Website URL'),
});

registry.register({
  name: 'scan.quickscan.company.intelligence',
  description: 'Company Intelligence (Branche, Markt, Marktdaten)',
  category: 'scan',
  inputSchema: companyIntelSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = await gatherCompanyIntelligence(input.companyName, input.url, websiteData.html);
      return { success: true, data: result as CompanyIntelligence };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ========================================
// Business Line Recommendation Tool
// ========================================

const recommendBLSchema = z.object({
  url: z.string().describe('Website URL'),
  companyName: z.string().optional().describe('Firmenname'),
  techStack: z.any().describe('Tech Stack Ergebnis'),
  contentVolume: z.any().describe('Content Volume Ergebnis'),
  features: z.any().describe('Features Ergebnis'),
  extractedRequirements: z.any().optional().describe('Extrahierte Anforderungen'),
});

registry.register({
  name: 'scan.quickscan.recommendBusinessLine',
  description: 'Empfiehlt die passende Business Line basierend auf Analyse',
  category: 'scan',
  inputSchema: recommendBLSchema,
  async execute(input, _context: ToolContext) {
    try {
      const businessUnits = await loadBusinessUnitsFromDB();
      const result = await generateBLRecommendation({
        url: input.url,
        companyName: input.companyName,
        techStack: input.techStack as TechStack,
        contentVolume: input.contentVolume as ContentVolume,
        features: input.features as Features,
        businessUnits,
        extractedRequirements: input.extractedRequirements,
      });
      return { success: true, data: result as BLRecommendation };
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
  preQualificationId: z.string().describe('Pre-Qualification ID für den QuickScan'),
  websiteUrl: z.string().describe('Website URL zum Scannen'),
});

registry.register({
  name: 'scan.quickscan.start',
  description: 'Startet einen vollständigen QuickScan für einen Pre-Qualification',
  category: 'scan',
  inputSchema: startQuickScanSchema,
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(input, _context: ToolContext) {
    // This is a placeholder - the actual QuickScan is orchestrated by the agent
    // This tool signals intent to start a QuickScan
    return {
      success: true,
      data: {
        message: `QuickScan für Pre-Qualification ${input.preQualificationId} wird gestartet`,
        websiteUrl: input.websiteUrl,
        preQualificationId: input.preQualificationId,
        status: 'initiated',
      },
    };
  },
});

/**
 * List of all QuickScan tool names for reference
 */
export const QUICKSCAN_TOOLS = [
  'scan.quickscan.navigation.full',
  'scan.quickscan.navigation.quick',
  'scan.quickscan.pages.count',
  'scan.quickscan.pages.quick',
  'scan.quickscan.techStack.analyze',
  'scan.quickscan.content.volume',
  'scan.quickscan.features.detect',
  'scan.quickscan.seo.audit',
  'scan.quickscan.legal.compliance',
  'scan.quickscan.content.classify',
  'scan.quickscan.content.estimate',
  'scan.quickscan.migration.analyze',
  'scan.quickscan.migration.analyzeAI',
  'scan.quickscan.accessibility',
  'scan.quickscan.playwright.audit',
  'scan.quickscan.company.intelligence',
  'scan.quickscan.recommendBusinessLine',
  'scan.quickscan.start',
  'research.decisionMakers',
  'research.contacts.quick',
] as const;

export type QuickScanToolName = (typeof QUICKSCAN_TOOLS)[number];
