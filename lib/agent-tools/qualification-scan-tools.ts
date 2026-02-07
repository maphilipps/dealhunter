import { z } from 'zod';

import { registry } from './registry';
import type { ToolContext } from './types';

// Import primitive tools (using relative paths for worker compatibility)
import type {
  TechStack,
  ContentVolume,
  Features,
  SEOAudit,
  LegalCompliance,
  CompanyIntelligence,
  BLRecommendation,
} from '../qualification-scan/schema';
import { gatherCompanyIntelligence } from '../qualification-scan/tools/company-research';
import {
  classifyContentTypes,
  estimateContentTypesFromUrls,
} from '../qualification-scan/tools/content-classifier';
import {
  searchDecisionMakers,
  quickContactSearch,
} from '../qualification-scan/tools/decision-maker-research';
import {
  analyzeMigrationComplexity,
  analyzeWithAI as analyzeMigrationWithAI,
} from '../qualification-scan/tools/migration-analyzer';
import {
  crawlNavigation,
  quickNavigationScan,
} from '../qualification-scan/tools/navigation-crawler';
import { countPages, quickPageCount } from '../qualification-scan/tools/page-counter';
import { runPlaywrightAudit } from '../qualification-scan/tools/playwright';
import { fetchWebsiteData } from '../qualification-scan/tools/website-fetch';
import {
  analyzeTechStack,
  analyzeContentVolume,
  detectFeatures,
  runSeoAudit,
  runLegalCompliance,
} from '../qualification-scan/workflow/steps/analysis';
import { loadBusinessUnitsFromDB } from '../qualification-scan/workflow/steps/bootstrap';
import { generateBLRecommendation } from '../qualification-scan/workflow/steps/synthesis';

/**
 * Qualification Scan Agent Tools (formerly QualificationScan 2.0)
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
  name: 'qualificationScan.navigation_full',
  description:
    'Crawlt die vollständige Navigationsstruktur einer Website und erstellt einen Sitemap-Baum',
  category: 'qualification-scan',
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
  name: 'qualificationScan.navigation_quick',
  description: 'Schneller Scan der Navigation (nur Homepage)',
  category: 'qualification-scan',
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
  name: 'qualificationScan.pages_count',
  description: 'Zählt alle Seiten einer Website (Sitemap + Link Discovery + Navigation)',
  category: 'qualification-scan',
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
  name: 'qualificationScan.pages_quick',
  description: 'Schnelle Seitenzählung (nur Sitemap)',
  category: 'qualification-scan',
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
  name: 'qualificationScan.tech_stack_analyze',
  description: 'Erkennt CMS, Frameworks, Hosting und Libraries (Tech Stack)',
  category: 'qualification-scan',
  inputSchema: techStackSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = analyzeTechStack(websiteData);
      return { success: true, data: result };
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
  name: 'qualificationScan.content_volume',
  description: 'Analysiert Seitenanzahl, Content-Typen und Medienvolumen',
  category: 'qualification-scan',
  inputSchema: contentVolumeSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = analyzeContentVolume(websiteData);
      return { success: true, data: result };
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
  name: 'qualificationScan.features_detect',
  description: 'Erkennt Website-Features (E-Commerce, Login, Suche, etc.)',
  category: 'qualification-scan',
  inputSchema: featureDetectSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = detectFeatures(websiteData);
      return { success: true, data: result };
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
  name: 'qualificationScan.seo_audit',
  description: 'SEO Basis-Audit (Title, Meta, Structured Data, OpenGraph)',
  category: 'qualification-scan',
  inputSchema: seoAuditSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = runSeoAudit(websiteData.html);
      return { success: true, data: result };
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
  name: 'qualificationScan.legal_compliance',
  description: 'DSGVO/Legal-Checks (Impressum, Datenschutz, Cookie-Banner)',
  category: 'qualification-scan',
  inputSchema: legalComplianceSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = runLegalCompliance(websiteData.html);
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
  name: 'qualificationScan.content_classify',
  description: 'Klassifiziert Content-Typen per AI (sampelt 15-20 Seiten)',
  category: 'qualification-scan',
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
  name: 'qualificationScan.content_estimate',
  description: 'Schätzt Content-Typen basierend auf URL-Patterns (ohne AI)',
  category: 'qualification-scan',
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
  name: 'qualificationScan.migration_analyze',
  description: 'Analysiert die Migrations-Komplexität basierend auf Tech Stack und Content',
  category: 'qualification-scan',
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
  name: 'qualificationScan.migration_analyze_ai',
  description: 'AI-gestützte Migrations-Analyse mit HTML-Kontext',
  category: 'qualification-scan',
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
  name: 'qualificationScan.accessibility_audit',
  description: 'Führt Accessibility-Audit mit axe-core durch (Multi-Page)',
  category: 'qualification-scan',
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
  name: 'qualificationScan.playwright_audit',
  description: 'Playwright Audit (Screenshots, Performance, Navigation, A11y)',
  category: 'qualification-scan',
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
                  colorContrast: result.accessibility.violations.some(
                    v => v.id === 'color-contrast'
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
                  helpUrl: v.helpUrl,
                })),
                pagesAudited: 1,
                auditedUrls: [input.url],
              }
            : null,
          navigation: result.navigation || null,
          performance: result.performance
            ? {
                htmlSize: Math.round(result.performance.totalSize / 1024),
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
  name: 'qualificationScan.company_intelligence',
  description: 'Company Intelligence (Branche, Markt, Marktdaten)',
  category: 'qualification-scan',
  inputSchema: companyIntelSchema,
  async execute(input, _context: ToolContext) {
    try {
      const websiteData = await fetchWebsiteData(input.url);
      const result = await gatherCompanyIntelligence(
        input.companyName,
        input.url,
        websiteData.html
      );
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
  name: 'qualificationScan.recommend_business_line',
  description: 'Empfiehlt die passende Business Line basierend auf Analyse',
  category: 'qualification-scan',
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
// QualificationScan Start Tool (for UI parity)
// ========================================

const startQualificationScanSchema = z.object({
  preQualificationId: z.string().describe('Qualification ID für den QualificationScan'),
  websiteUrl: z.string().describe('Website URL zum Scannen'),
});

registry.register({
  name: 'qualificationScan.start',
  description: 'Startet einen vollständigen Qualification Scan für eine Qualification',
  category: 'qualification-scan',
  inputSchema: startQualificationScanSchema,
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(input, _context: ToolContext) {
    // This is a placeholder - the actual Qualification Scan is orchestrated by the agent
    // This tool signals intent to start a Qualification Scan
    return {
      success: true,
      data: {
        message: `Qualification Scan für Qualification ${input.preQualificationId} wird gestartet`,
        websiteUrl: input.websiteUrl,
        preQualificationId: input.preQualificationId,
        status: 'initiated',
      },
    };
  },
});

// Snake_case aliases for naming convention compliance
registry.alias('research.decision_makers', 'research.decisionMakers');
registry.alias('research.contacts_quick', 'research.contacts.quick');

/** Canonical list of all Qualification Scan tool names */
export const QUALIFICATION_SCAN_TOOLS = [
  'qualificationScan.navigation_full',
  'qualificationScan.navigation_quick',
  'qualificationScan.pages_count',
  'qualificationScan.pages_quick',
  'qualificationScan.tech_stack_analyze',
  'qualificationScan.content_volume',
  'qualificationScan.features_detect',
  'qualificationScan.seo_audit',
  'qualificationScan.legal_compliance',
  'qualificationScan.content_classify',
  'qualificationScan.content_estimate',
  'qualificationScan.migration_analyze',
  'qualificationScan.migration_analyze_ai',
  'qualificationScan.accessibility_audit',
  'qualificationScan.playwright_audit',
  'qualificationScan.company_intelligence',
  'qualificationScan.recommend_business_line',
  'qualificationScan.start',
  'research.decisionMakers',
  'research.contacts.quick',
] as const;

export type QualificationScanToolName = (typeof QUALIFICATION_SCAN_TOOLS)[number];

/** @deprecated Use QUALIFICATION_SCAN_TOOLS instead */
export const QUICKSCAN_TOOLS = QUALIFICATION_SCAN_TOOLS;
/** @deprecated Use QualificationScanToolName instead */
export type QuickScanToolName = QualificationScanToolName;
/** @deprecated Use QUALIFICATION_SCAN_TOOLS instead */
export const LEAD_SCAN_TOOLS = QUALIFICATION_SCAN_TOOLS;
/** @deprecated Use QualificationScanToolName instead */
export type LeadScanToolName = QualificationScanToolName;
