// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS STEPS - QuickScan 2.0 Workflow
// Steps that analyze the website data in parallel
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  TechStack,
  ContentVolume,
  Features,
  AccessibilityAudit,
  SEOAudit,
  LegalCompliance,
  PerformanceIndicators,
  NavigationStructure,
  Screenshots,
  CompanyIntelligence,
  ContentTypeDistribution,
  MigrationComplexity,
  DecisionMakersResearch,
} from '../../schema';
import { wrapTool } from '../tool-wrapper';
import type { WebsiteData } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// TECH STACK ANALYSIS STEP
// ═══════════════════════════════════════════════════════════════════════════════

interface WappalyzerTechnology {
  name: string;
  categories: string[];
  version?: string;
  confidence: number;
}

export const techStackStep = wrapTool<WebsiteData, TechStack>(
  {
    name: 'techStack',
    displayName: 'Tech Stack Analyzer',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: false,
    timeout: 30000,
  },
  (websiteData, _ctx) => {
    let cms: string | undefined;
    let cmsVersion: string | undefined;
    let cmsConfidence: number | undefined;
    let framework: string | undefined;
    let frameworkVersion: string | undefined;
    const backend: string[] = [];
    let hosting: string | undefined;
    let cdn: string | undefined;
    let server: string | undefined;
    const libraries: string[] = [];
    const analytics: string[] = [];
    const marketing: string[] = [];

    // Use Wappalyzer results from WebsiteData
    if (websiteData.wappalyzerResults && websiteData.wappalyzerResults.length > 0) {
      for (const tech of websiteData.wappalyzerResults as WappalyzerTechnology[]) {
        // Categorize technologies
        if (tech.categories.includes('CMS')) {
          if (!cms || tech.confidence > (cmsConfidence || 0)) {
            cms = tech.name;
            cmsVersion = tech.version;
            cmsConfidence = tech.confidence;
          }
        }

        if (
          tech.categories.some(c =>
            ['JavaScript frameworks', 'Frontend frameworks', 'Web frameworks'].includes(c)
          )
        ) {
          if (!framework || tech.confidence > 50) {
            framework = tech.name;
            frameworkVersion = tech.version;
          }
        }

        if (tech.categories.some(c => ['Programming languages', 'Web servers'].includes(c))) {
          backend.push(tech.name);
        }

        if (tech.categories.some(c => ['PaaS', 'Hosting', 'IaaS'].includes(c))) {
          hosting = hosting || tech.name;
        }

        if (tech.categories.includes('CDN')) {
          cdn = cdn || tech.name;
        }

        if (tech.categories.includes('Web servers')) {
          server = server || tech.name;
        }

        if (
          tech.categories.some(c =>
            ['JavaScript libraries', 'UI frameworks', 'CSS frameworks'].includes(c)
          )
        ) {
          libraries.push(tech.name);
        }

        if (tech.categories.some(c => ['Analytics', 'Tag managers', 'RUM'].includes(c))) {
          analytics.push(tech.name);
        }

        if (
          tech.categories.some(c =>
            [
              'Marketing automation',
              'Cookie compliance',
              'A/B testing',
              'Personalization',
              'Advertising',
              'Live chat',
            ].includes(c)
          )
        ) {
          marketing.push(tech.name);
        }
      }
    }

    // HTML Pattern detection for CMS
    if (websiteData.html && (!cms || (cmsConfidence || 0) < 70)) {
      const cmsPatterns = [
        {
          name: 'Drupal',
          patterns: [
            /Drupal\.settings/i,
            /drupal\.js/i,
            /\/sites\/default\/files\//i,
            /data-drupal/i,
          ],
        },
        {
          name: 'WordPress',
          patterns: [/wp-content/i, /wp-includes/i, /wp-json/i],
        },
        {
          name: 'TYPO3',
          patterns: [/typo3/i, /\/typo3conf\//i, /\/typo3temp\//i],
        },
        {
          name: 'Joomla',
          patterns: [/joomla/i, /\/components\/com_/i],
        },
      ];

      for (const cmsPattern of cmsPatterns) {
        let matchCount = 0;
        for (const pattern of cmsPattern.patterns) {
          if (pattern.test(websiteData.html)) {
            matchCount++;
          }
        }

        if (matchCount > 0) {
          const patternConfidence = Math.min(95, 50 + matchCount * 15);
          if (!cms || patternConfidence > (cmsConfidence || 0)) {
            cms = cmsPattern.name;
            cmsConfidence = patternConfidence;
          }
        }
      }
    }

    // Header-based detection
    if (websiteData.headers) {
      if (websiteData.headers['server'] && !server) {
        server = websiteData.headers['server'];
      }
      if (websiteData.headers['x-powered-by']) {
        backend.push(websiteData.headers['x-powered-by']);
      }
    }

    // Return schema-compliant TechStack (all fields are optional with defaults)
    return {
      cms,
      cmsVersion,
      cmsConfidence,
      framework,
      frameworkVersion,
      backend: backend.length > 0 ? [...new Set(backend)] : [],
      hosting,
      cdn,
      server,
      libraries: libraries.length > 0 ? [...new Set(libraries)] : [],
      analytics: analytics.length > 0 ? [...new Set(analytics)] : [],
      marketing: marketing.length > 0 ? [...new Set(marketing)] : [],
      // Schema defaults for enhanced detection fields
      javascriptFrameworks: [],
      cssFrameworks: [],
      headlessCms: [],
      buildTools: [],
      cdnProviders: [],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT VOLUME ANALYSIS STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const contentVolumeStep = wrapTool<WebsiteData, ContentVolume>(
  {
    name: 'contentVolume',
    displayName: 'Content Analyzer',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: false,
    timeout: 15000,
  },
  (websiteData, _ctx) => {
    // Use sitemap URL count if available
    const actualPageCount = websiteData.sitemapFound ? websiteData.sitemapUrls.length : undefined;

    // Estimate from HTML as fallback
    const linkRegex = /href=["']([^"']+)["']/gi;
    const links = new Set<string>();
    let match;
    while ((match = linkRegex.exec(websiteData.html)) !== null) {
      const href = match[1];
      if (href.startsWith('/') || href.startsWith('#') || !href.includes('://')) {
        links.add(href.split('#')[0].split('?')[0]);
      }
    }
    const htmlEstimate = Math.max(links.size, 1);
    const estimatedPageCount = actualPageCount ?? htmlEstimate;

    // Analyze content types from sitemap URLs
    const types: Record<string, number> = {};
    for (const url of websiteData.sitemapUrls) {
      const path = url.toLowerCase();
      if (path.includes('/blog') || path.includes('/news')) {
        types['Blog/News'] = (types['Blog/News'] || 0) + 1;
      } else if (path.includes('/product') || path.includes('/shop')) {
        types['Products'] = (types['Products'] || 0) + 1;
      } else if (path.includes('/service')) {
        types['Services'] = (types['Services'] || 0) + 1;
      } else {
        types['Pages'] = (types['Pages'] || 0) + 1;
      }
    }
    const contentTypes = Object.entries(types)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Detect languages
    const languages = new Set<string>();
    const langMatch = websiteData.html.match(/<html[^>]*lang=["']([^"']+)["']/i);
    if (langMatch) {
      languages.add(langMatch[1].split('-')[0].toUpperCase());
    }

    // Estimate complexity
    const hasEcommerce = /cart|checkout|shop/i.test(websiteData.html);
    const hasLogin = /login|signin|anmelden/i.test(websiteData.html);
    let complexityScore = 0;
    if (estimatedPageCount > 500) complexityScore += 3;
    else if (estimatedPageCount > 100) complexityScore += 2;
    else if (estimatedPageCount > 20) complexityScore += 1;
    if (hasEcommerce) complexityScore += 2;
    if (hasLogin) complexityScore += 1;

    const complexity: 'low' | 'medium' | 'high' =
      complexityScore >= 4 ? 'high' : complexityScore >= 2 ? 'medium' : 'low';

    // Count media assets
    const images = (websiteData.html.match(/<img[^>]+>/gi) || []).length;
    const videos = (websiteData.html.match(/<video[^>]+>|youtube|vimeo/gi) || []).length;
    const pdfs = (websiteData.html.match(/\.pdf["']/gi) || []).length;

    // Return schema-compliant ContentVolume
    return {
      actualPageCount,
      estimatedPageCount,
      sitemapFound: websiteData.sitemapFound,
      sitemapUrl: websiteData.sitemapUrl,
      contentTypes: contentTypes.length > 0 ? contentTypes : [],
      mediaAssets: { images, videos, documents: pdfs },
      languages: languages.size > 0 ? Array.from(languages) : [],
      complexity,
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE DETECTION STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const featuresStep = wrapTool<WebsiteData, Features>(
  {
    name: 'features',
    displayName: 'Feature Detector',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: false,
    timeout: 30000,
  },
  (websiteData, _ctx) => {
    const html = websiteData.html.toLowerCase();

    // Detect features - schema-compliant Features type
    const customFeatures: string[] = [];

    // Track additional features that go into customFeatures
    if (/event|termin|kalender|calendar|veranstaltung/i.test(html)) {
      customFeatures.push('events');
    }
    if (/job|career|karriere|stellenangebot|vacancy/i.test(html)) {
      customFeatures.push('jobs');
    }
    if (/video|youtube|vimeo|podcast|gallery|galerie/i.test(html)) {
      customFeatures.push('media');
    }

    return {
      ecommerce:
        /shop|cart|checkout|warenkorb|add.to.cart|buy.now|product|price/i.test(html) ||
        /woocommerce|shopify|magento/i.test(html),
      userAccounts: /login|signin|sign.in|register|account|my.profile|anmelden|registrieren/i.test(
        html
      ),
      multiLanguage:
        /hreflang|lang=|language.selector|\/en\/|\/de\/|\/fr\//i.test(html) ||
        (websiteData.html.match(/hreflang=/gi) || []).length > 1,
      search: /search|suche|<input[^>]*type=["']search["']/i.test(html),
      forms:
        /<form[^>]*>/gi.test(websiteData.html) ||
        /contact|kontakt|newsletter|subscribe/i.test(html),
      api: /api\.|\/api\/|graphql|rest|ajax/i.test(html),
      blog: /blog|news|artikel|beitr|post/i.test(html),
      // Schema-required fields
      mobileApp: /app.store|play.store|mobile.app|download.app/i.test(html),
      customFeatures,
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYWRIGHT AUDIT STEP
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlaywrightAuditResult {
  screenshots: Screenshots | null;
  accessibility: AccessibilityAudit | null;
  navigation: NavigationStructure | null;
  performance: PerformanceIndicators | null;
}

export const playwrightAuditStep = wrapTool<{ url: string; bidId: string }, PlaywrightAuditResult>(
  {
    name: 'playwrightAudit',
    displayName: 'Playwright',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 60000,
  },
  async (input, _ctx) => {
    const { runPlaywrightAudit } = await import('../../tools/playwright');

    const result = await runPlaywrightAudit(input.url, input.bidId, {
      takeScreenshots: true,
      runAccessibilityAudit: true,
      analyzeNavigation: true,
    });

    return {
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
            minorIssues: result.accessibility.violations.filter(v => v.impact === 'minor').length,
            checks: {
              hasAltTexts: !result.accessibility.violations.some(v => v.id === 'image-alt'),
              hasAriaLabels: !result.accessibility.violations.some(v => v.id.includes('aria')),
              hasProperHeadings: !result.accessibility.violations.some(v =>
                v.id.includes('heading')
              ),
              hasSkipLinks: result.accessibility.passes > 0,
              colorContrast: result.accessibility.violations.some(v => v.id === 'color-contrast')
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
              languageAttribute: !result.accessibility.violations.some(
                v => v.id === 'html-has-lang'
              ),
            },
            topIssues: result.accessibility.violations.slice(0, 5).map(v => ({
              type: v.id,
              count: v.nodes,
              severity: v.impact,
              description: v.description,
            })),
            recommendations: result.accessibility.violations.slice(0, 3).map(v => v.description),
          }
        : null,
      navigation: result.navigation
        ? {
            mainNav: result.navigation.mainNav.map((item: string | { label: string }) =>
              typeof item === 'string' ? { label: item } : item
            ),
            footerNav: result.navigation.footerNav?.map((item: string | { label: string }) =>
              typeof item === 'string' ? { label: item } : item
            ),
            hasSearch: result.navigation.hasSearch,
            hasBreadcrumbs: result.navigation.hasBreadcrumbs,
            hasMegaMenu: result.navigation.hasMegaMenu,
            maxDepth: result.navigation.maxDepth,
            // Access properties with optional chaining since they may not exist
            totalItems:
              (result.navigation as { totalItems?: number }).totalItems ||
              result.navigation.mainNav.length,
            hasStickyHeader: (result.navigation as { stickyHeader?: boolean }).stickyHeader,
            hasMobileMenu: (result.navigation as { mobileMenu?: boolean }).mobileMenu,
          }
        : null,
      performance: result.performance
        ? {
            htmlSize: 0,
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
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY INTELLIGENCE STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const companyIntelligenceStep = wrapTool<
  { companyName: string; url: string; html: string },
  CompanyIntelligence | null
>(
  {
    name: 'companyIntelligence',
    displayName: 'Company Intelligence',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 45000,
  },
  async (input, _ctx) => {
    if (!input.companyName) return null;

    const { gatherCompanyIntelligence } = await import('../../tools/company-research');
    return gatherCompanyIntelligence(input.companyName, input.url, input.html);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SEO AUDIT STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const seoAuditStep = wrapTool<{ html: string; url: string }, SEOAudit>(
  {
    name: 'seoAudit',
    displayName: 'SEO Audit',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 15000,
  },
  (input, _ctx) => {
    const html = input.html;

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    const metaDescription = descMatch ? descMatch[1] : undefined;

    // Count headings
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;

    // Check for structured data
    const hasStructuredData = /application\/ld\+json|itemtype=|itemscope/i.test(html);

    // Check for Open Graph
    const hasOpenGraph = /og:title|og:description|og:image/i.test(html);

    // Check canonical
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

    // Calculate score
    let score = 50;
    if (title && title.length >= 30 && title.length <= 60) score += 10;
    if (metaDescription && metaDescription.length >= 120 && metaDescription.length <= 160)
      score += 10;
    if (h1Count === 1) score += 10;
    if (hasStructuredData) score += 10;
    if (hasOpenGraph) score += 5;
    if (canonicalMatch) score += 5;

    // Check mobile viewport
    const hasMobileViewport = /viewport/i.test(html);

    // Schema-compliant SEOAudit response
    return {
      score: Math.min(100, score),
      checks: {
        hasTitle: !!title,
        titleLength: title?.length,
        hasMetaDescription: !!metaDescription,
        metaDescriptionLength: metaDescription?.length,
        hasCanonical: !!canonicalMatch,
        hasRobotsTxt: true,
        hasSitemap: true,
        hasStructuredData,
        hasOpenGraph,
        mobileViewport: hasMobileViewport,
      },
      issues: [],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// LEGAL COMPLIANCE STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const legalComplianceStep = wrapTool<{ html: string }, LegalCompliance>(
  {
    name: 'legalCompliance',
    displayName: 'Legal Compliance',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 15000,
  },
  (input, _ctx) => {
    const html = input.html.toLowerCase();

    const hasPrivacyPolicy = /privacy|datenschutz|privacybeleid/i.test(html);
    const hasImprint = /impressum|imprint|legal.notice/i.test(html);
    const hasCookieConsent = /cookie.consent|cookie.banner|cookie.notice|cookiebot|onetrust/i.test(
      html
    );
    const hasTerms = /terms|agb|nutzungsbedingungen|conditions/i.test(html);
    const hasAccessibilityStatement = /accessibility|barrierefreiheit|barrierefreiheits/i.test(
      html
    );

    // Calculate compliance score
    let score = 0;
    if (hasPrivacyPolicy) score += 30;
    if (hasImprint) score += 25;
    if (hasCookieConsent) score += 25;
    if (hasTerms) score += 20;

    // Detect cookie consent tool
    let cookieConsentTool: string | undefined;
    if (/cookiebot/i.test(html)) cookieConsentTool = 'Cookiebot';
    else if (/onetrust/i.test(html)) cookieConsentTool = 'OneTrust';
    else if (/cookiefirst/i.test(html)) cookieConsentTool = 'CookieFirst';
    else if (/cookieconsent/i.test(html)) cookieConsentTool = 'Cookie Consent';

    // Schema-compliant LegalCompliance response
    return {
      score,
      checks: {
        hasImprint,
        hasPrivacyPolicy,
        hasCookieBanner: hasCookieConsent,
        hasTermsOfService: hasTerms,
        hasAccessibilityStatement,
      },
      gdprIndicators: {
        cookieConsentTool,
        analyticsCompliant: hasCookieConsent,
        hasDataProcessingInfo: hasPrivacyPolicy,
      },
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT CLASSIFICATION STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const contentClassificationStep = wrapTool<
  { sitemapUrls: string[] },
  ContentTypeDistribution | null
>(
  {
    name: 'contentClassification',
    displayName: 'Content Classifier',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 45000,
  },
  async (input, _ctx) => {
    if (input.sitemapUrls.length < 10) return null;

    const { classifyContentTypes } = await import('../../tools/content-classifier');
    return classifyContentTypes(input.sitemapUrls, { sampleSize: 15 });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// MIGRATION COMPLEXITY STEP
// ═══════════════════════════════════════════════════════════════════════════════

export interface MigrationInput {
  techStack: TechStack;
  pageCount: number;
  features: {
    ecommerce: boolean;
    userAccounts: boolean;
    multiLanguage: boolean;
    search: boolean;
    forms: boolean;
    api: boolean;
  };
  html: string;
}

export const migrationComplexityStep = wrapTool<MigrationInput, MigrationComplexity>(
  {
    name: 'migrationComplexity',
    displayName: 'Migration Analyzer',
    phase: 'analysis',
    dependencies: ['fetchWebsite', 'techStack', 'contentVolume', 'features'],
    optional: true,
    timeout: 30000,
  },
  async (input, _ctx) => {
    const { analyzeMigrationComplexity } = await import('../../tools/migration-analyzer');
    return analyzeMigrationComplexity(input);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION MAKERS RESEARCH STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const decisionMakersStep = wrapTool<
  { companyName: string; url: string },
  DecisionMakersResearch | null
>(
  {
    name: 'decisionMakers',
    displayName: 'Decision Maker Research',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 30000,
  },
  async (input, _ctx) => {
    if (!input.companyName) return null;

    const { searchDecisionMakers } = await import('../../tools/decision-maker-research');
    return searchDecisionMakers(input.companyName, input.url);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// HTTPX TECH DETECTION STEP
// ═══════════════════════════════════════════════════════════════════════════════

export const httpxTechStep = wrapTool<{ url: string }, { technologies: Array<{ name: string }> }>(
  {
    name: 'httpxTech',
    displayName: 'httpx Tech Detection',
    phase: 'analysis',
    dependencies: ['fetchWebsite'],
    optional: true,
    timeout: 30000,
  },
  async (input, _ctx) => {
    const { runHttpxTechDetection } = await import('../../tools/playwright');
    return runHttpxTechDetection(input.url);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ALL ANALYSIS STEPS
// ═══════════════════════════════════════════════════════════════════════════════

export const analysisSteps = [
  techStackStep,
  contentVolumeStep,
  featuresStep,
  playwrightAuditStep,
  companyIntelligenceStep,
  seoAuditStep,
  legalComplianceStep,
  contentClassificationStep,
  migrationComplexityStep,
  decisionMakersStep,
  httpxTechStep,
];
