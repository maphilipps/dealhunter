import { z } from 'zod';

/**
 * Schema for tech stack detection results
 */
export const techStackSchema = z.object({
  // CMS Detection
  cms: z
    .string()
    .optional()
    .describe('Detected CMS (WordPress, Drupal, Typo3, Joomla, Custom, etc.)'),
  cmsVersion: z.string().optional().describe('CMS version if detectable'),
  cmsConfidence: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Confidence in CMS detection (0-100)'),

  // Framework Detection
  framework: z
    .string()
    .optional()
    .describe('Frontend framework (React, Vue, Angular, jQuery, Vanilla JS, etc.)'),
  frameworkVersion: z.string().optional().describe('Framework version if detectable'),

  // Backend Detection
  backend: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Backend technologies detected (PHP, Node.js, Java, .NET, Python, etc.)'),

  // Hosting & Infrastructure
  hosting: z
    .string()
    .optional()
    .describe('Hosting provider (AWS, Azure, GCP, on-premise, Unknown)'),
  cdn: z.string().optional().describe('CDN provider if detected (Cloudflare, Akamai, etc.)'),
  server: z.string().optional().describe('Web server (Apache, Nginx, IIS, etc.)'),

  // Additional Technologies
  libraries: z
    .array(z.string())
    .optional()
    .default([])
    .describe('JavaScript libraries and tools detected'),
  analytics: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Analytics tools (Google Analytics, Matomo, etc.)'),
  marketing: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Marketing tools (HubSpot, Mailchimp, etc.)'),

  // Enhanced Detection (from Playwright)
  javascriptFrameworks: z
    .array(
      z.object({
        name: z.string(),
        version: z.string().optional(),
        confidence: z.number(),
      })
    )
    .optional()
    .default([])
    .describe('JavaScript frameworks with version detection'),
  cssFrameworks: z
    .array(
      z.object({
        name: z.string(),
        version: z.string().optional(),
        confidence: z.number(),
      })
    )
    .optional()
    .default([])
    .describe('CSS frameworks with version detection'),
  apiEndpoints: z
    .object({
      rest: z.array(z.string()).optional().default([]),
      graphql: z.boolean().default(false),
      graphqlEndpoint: z.string().optional(),
    })
    .optional()
    .describe('API endpoints discovered'),
  headlessCms: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Headless CMS detected (Contentful, Sanity, etc.)'),
  serverSideRendering: z.boolean().optional().describe('Whether SSR is detected'),
  buildTools: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Build tools detected (Webpack, Vite, etc.)'),
  cdnProviders: z.array(z.string()).optional().default([]).describe('CDN providers detected'),

  // Overall Assessment
  overallConfidence: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Overall confidence in tech stack detection'),
});

export type TechStack = z.infer<typeof techStackSchema>;

/**
 * Schema for content volume analysis
 */
export const contentVolumeSchema = z.object({
  // Page counts - distinguish between actual (from sitemap) and estimated
  actualPageCount: z.number().optional().describe('Actual page count from sitemap'),
  estimatedPageCount: z
    .number()
    .describe('Estimated total number of pages (fallback if no sitemap)'),
  sitemapFound: z.boolean().optional().describe('Whether a sitemap was found'),
  sitemapUrl: z.string().optional().describe('URL of the sitemap if found'),

  contentTypes: z
    .array(
      z.object({
        type: z.string().describe('Content type (Blog, Product, Service, etc.)'),
        count: z.number().describe('Estimated count of this content type'),
      })
    )
    .optional()
    .default([]),
  mediaAssets: z
    .object({
      images: z.number().describe('Estimated number of images'),
      videos: z.number().describe('Estimated number of videos'),
      documents: z.number().describe('Estimated number of downloadable documents'),
    })
    .optional(),
  languages: z.array(z.string()).optional().default([]).describe('Detected languages'),
  complexity: z.enum(['low', 'medium', 'high']).optional().describe('Overall content complexity'),
});

export type ContentVolume = z.infer<typeof contentVolumeSchema>;

/**
 * Schema for accessibility audit results
 */
export const accessibilityAuditSchema = z.object({
  // Overall score
  score: z.number().min(0).max(100).describe('Overall accessibility score (0-100)'),
  level: z.enum(['A', 'AA', 'AAA', 'fail']).describe('WCAG compliance level achieved'),

  // Issue counts by severity
  criticalIssues: z.number().describe('Number of critical accessibility issues'),
  seriousIssues: z.number().describe('Number of serious issues'),
  moderateIssues: z.number().describe('Number of moderate issues'),
  minorIssues: z.number().describe('Number of minor issues'),

  // Specific checks
  checks: z.object({
    hasAltTexts: z.boolean().describe('Images have alt texts'),
    hasAriaLabels: z.boolean().describe('Interactive elements have ARIA labels'),
    hasProperHeadings: z.boolean().describe('Heading hierarchy is correct'),
    hasSkipLinks: z.boolean().describe('Skip navigation links present'),
    colorContrast: z.enum(['pass', 'warning', 'fail']).describe('Color contrast check result'),
    keyboardNavigation: z.enum(['pass', 'warning', 'fail']).describe('Keyboard navigation support'),
    formLabels: z.enum(['pass', 'warning', 'fail', 'n/a']).describe('Form labels present'),
    languageAttribute: z.boolean().describe('HTML lang attribute present'),
  }),

  // Top issues found
  topIssues: z
    .array(
      z.object({
        type: z.string().describe('Issue type (e.g., "missing-alt", "color-contrast")'),
        count: z.number().describe('Number of occurrences'),
        severity: z.enum(['critical', 'serious', 'moderate', 'minor']).describe('Severity level'),
        description: z.string().describe('Human-readable description'),
      })
    )
    .optional()
    .describe('Top accessibility issues found'),

  // Recommendations
  recommendations: z
    .array(z.string())
    .optional()
    .describe('Prioritized recommendations to fix issues'),
});

export type AccessibilityAudit = z.infer<typeof accessibilityAuditSchema>;

/**
 * Schema for screenshots
 */
export const screenshotsSchema = z.object({
  homepage: z
    .object({
      desktop: z.string().optional().describe('Desktop screenshot path/URL'),
      mobile: z.string().optional().describe('Mobile screenshot path/URL'),
    })
    .optional(),
  keyPages: z
    .array(
      z.object({
        url: z.string().describe('Page URL'),
        title: z.string().describe('Page title'),
        screenshot: z.string().describe('Screenshot path/URL'),
      })
    )
    .optional()
    .describe('Screenshots of key pages'),
  timestamp: z.string().describe('When screenshots were taken'),
});

export type Screenshots = z.infer<typeof screenshotsSchema>;

/**
 * Schema for SEO audit results
 */
export const seoAuditSchema = z.object({
  score: z.number().min(0).max(100).describe('Overall SEO score'),

  // Basic SEO checks
  checks: z.object({
    hasTitle: z.boolean().describe('Page has title tag'),
    titleLength: z.number().optional().describe('Title length in characters'),
    hasMetaDescription: z.boolean().describe('Has meta description'),
    metaDescriptionLength: z.number().optional().describe('Meta description length'),
    hasCanonical: z.boolean().describe('Has canonical URL'),
    hasRobotsTxt: z.boolean().describe('robots.txt exists'),
    hasSitemap: z.boolean().describe('sitemap.xml exists'),
    hasStructuredData: z.boolean().describe('Has JSON-LD or schema.org markup'),
    hasOpenGraph: z.boolean().describe('Has Open Graph tags'),
    mobileViewport: z.boolean().describe('Has mobile viewport meta tag'),
  }),

  // Issues found
  issues: z
    .array(
      z.object({
        type: z.string().describe('Issue type'),
        severity: z.enum(['error', 'warning', 'info']).describe('Severity'),
        description: z.string().describe('Description'),
      })
    )
    .optional(),
});

export type SEOAudit = z.infer<typeof seoAuditSchema>;

/**
 * Schema for legal compliance check
 */
export const legalComplianceSchema = z.object({
  score: z.number().min(0).max(100).describe('Overall compliance score'),

  checks: z.object({
    hasImprint: z.boolean().describe('Has imprint/impressum page'),
    hasPrivacyPolicy: z.boolean().describe('Has privacy policy/Datenschutz'),
    hasCookieBanner: z.boolean().describe('Has cookie consent banner'),
    hasTermsOfService: z.boolean().describe('Has terms of service/AGB'),
    hasAccessibilityStatement: z.boolean().describe('Has accessibility statement'),
  }),

  // GDPR-specific
  gdprIndicators: z
    .object({
      cookieConsentTool: z
        .string()
        .optional()
        .describe('Detected cookie consent tool (e.g., CookieFirst, OneTrust)'),
      analyticsCompliant: z.boolean().optional().describe('Analytics appears GDPR-compliant'),
      hasDataProcessingInfo: z.boolean().optional().describe('Has info about data processing'),
    })
    .optional(),

  issues: z
    .array(
      z.object({
        type: z.string().describe('Issue type'),
        severity: z.enum(['critical', 'warning', 'info']).describe('Severity'),
        description: z.string().describe('Description'),
      })
    )
    .optional(),
});

export type LegalCompliance = z.infer<typeof legalComplianceSchema>;

/**
 * Schema for performance indicators
 */
export const performanceIndicatorsSchema = z.object({
  // Basic metrics from HTML analysis
  htmlSize: z.number().describe('HTML size in KB'),
  resourceCount: z.object({
    scripts: z.number().describe('Number of script tags'),
    stylesheets: z.number().describe('Number of stylesheet links'),
    images: z.number().describe('Number of images'),
    fonts: z.number().describe('Number of font files'),
  }),

  // Estimated performance
  estimatedLoadTime: z.enum(['fast', 'medium', 'slow']).describe('Estimated load time'),
  hasLazyLoading: z.boolean().describe('Uses lazy loading for images'),
  hasMinification: z.boolean().describe('Resources appear minified'),
  hasCaching: z.boolean().describe('Cache headers present'),

  // Blocking resources
  renderBlockingResources: z.number().describe('Number of render-blocking resources'),
});

export type PerformanceIndicators = z.infer<typeof performanceIndicatorsSchema>;

/**
 * Schema for feature detection
 */
export const featuresSchema = z.object({
  ecommerce: z.boolean().describe('Has e-commerce functionality'),
  userAccounts: z.boolean().describe('Has user account system'),
  search: z.boolean().describe('Has search functionality'),
  multiLanguage: z.boolean().describe('Multi-language support'),
  blog: z.boolean().describe('Has blog/news section'),
  forms: z.boolean().describe('Has contact forms or other forms'),
  api: z.boolean().describe('Has API endpoints detected'),
  mobileApp: z.boolean().describe('Has mobile app integration'),
  customFeatures: z.array(z.string()).describe('Other notable features detected'),
});

export type Features = z.infer<typeof featuresSchema>;

/**
 * Schema for business unit recommendation
 */
export const blRecommendationSchema = z.object({
  primaryBusinessLine: z.string().describe('Primary recommended business unit'),
  confidence: z.number().min(0).max(100).describe('Confidence in recommendation (0-100)'),
  reasoning: z.string().describe('Explanation for the recommendation'),
  alternativeBusinessLines: z
    .array(
      z.object({
        name: z.string(),
        confidence: z.number().min(0).max(100),
        reason: z.string(),
      })
    )
    .describe('Alternative business unit recommendations'),
  requiredSkills: z.array(z.string()).describe('Key skills needed for this project'),
});

export type BLRecommendation = z.infer<typeof blRecommendationSchema>;

/**
 * Schema for navigation structure analysis
 */
export const navigationStructureSchema = z.object({
  // Main navigation
  mainNav: z
    .array(
      z.object({
        label: z.string().describe('Navigation item label'),
        url: z.string().optional().describe('Link URL'),
        children: z
          .array(
            z.object({
              label: z.string(),
              url: z.string().optional(),
            })
          )
          .optional()
          .describe('Sub-navigation items'),
      })
    )
    .describe('Main navigation items'),

  // Footer navigation
  footerNav: z
    .array(
      z.object({
        label: z.string().describe('Footer section/link label'),
        url: z.string().optional().describe('Link URL'),
      })
    )
    .optional()
    .describe('Footer navigation items'),

  // Navigation features
  hasSearch: z.boolean().describe('Has search functionality'),
  hasBreadcrumbs: z.boolean().describe('Uses breadcrumb navigation'),
  hasMegaMenu: z.boolean().describe('Has mega menu pattern'),
  hasStickyHeader: z.boolean().optional().describe('Header stays visible on scroll'),
  hasMobileMenu: z.boolean().optional().describe('Has mobile hamburger menu'),

  // Complexity metrics
  maxDepth: z.number().min(1).max(10).describe('Maximum navigation depth'),
  totalItems: z.number().describe('Total navigation items count'),

  // Page types detected from navigation
  pageTypesDetected: z
    .array(z.string())
    .optional()
    .describe('Content types inferred from navigation (Blog, Products, Services, etc.)'),
});

export type NavigationStructure = z.infer<typeof navigationStructureSchema>;

/**
 * Schema for company intelligence data
 */
export const companyIntelligenceSchema = z.object({
  // Basic company info
  basicInfo: z.object({
    name: z.string().describe('Official company name'),
    legalForm: z.string().nullish().describe('Legal form (GmbH, AG, SE, etc.)'),
    registrationNumber: z.string().nullish().describe('HRB or similar registration number'),
    foundedYear: z.coerce.number().nullish().describe('Year company was founded'),
    headquarters: z.string().nullish().describe('Headquarters location'),
    employeeCount: z.string().nullish().describe('Employee count or range'),
    industry: z.string().nullish().describe('Primary industry/sector'),
    website: z.string().describe('Company website URL'),
  }),

  // Financial indicators
  financials: z
    .object({
      revenueClass: z
        .enum(['startup', 'small', 'medium', 'large', 'enterprise', 'unknown'])
        .nullish()
        .describe('Revenue class estimation'),
      growthIndicators: z
        .array(z.string())
        .nullish()
        .describe('Growth signals (hiring, expansion, funding)'),
      publiclyTraded: z.boolean().nullish().describe('Is company publicly traded'),
      stockSymbol: z.string().nullish().describe('Stock ticker symbol if public'),
      fundingStatus: z.string().nullish().describe('For startups: funding stage'),
      lastFundingAmount: z.string().nullish().describe('Last funding round amount'),
    })
    .optional(),

  // Recent news and reputation
  newsAndReputation: z
    .object({
      recentNews: z
        .array(
          z.object({
            title: z.string().describe('News headline'),
            source: z.string().describe('News source'),
            date: z.string().nullish().describe('Publication date'),
            url: z.string().nullish().describe('Article URL'),
            sentiment: z
              .enum(['positive', 'neutral', 'negative'])
              .nullish()
              .describe('Sentiment of news'),
          })
        )
        .nullish()
        .describe('Recent news articles (top 5)'),
      sentimentScore: z.coerce
        .number()
        .min(-1)
        .max(1)
        .nullish()
        .describe('Overall sentiment (-1 to 1)'),
      riskIndicators: z.array(z.string()).nullish().describe('Any risk signals found'),
      positiveSignals: z.array(z.string()).nullish().describe('Positive signals found'),
    })
    .optional(),

  // Leadership and contacts
  leadership: z
    .object({
      ceo: z.string().nullish().describe('CEO name'),
      cto: z.string().nullish().describe('CTO/IT head name'),
      cmo: z.string().nullish().describe('CMO/Marketing head name'),
      otherContacts: z
        .array(
          z.object({
            name: z.string(),
            title: z.string(),
          })
        )
        .nullish()
        .describe('Other known decision makers'),
    })
    .optional(),

  // Corporate structure
  corporateStructure: z
    .object({
      parentCompany: z.string().nullish().describe('Parent company if applicable'),
      subsidiaries: z.array(z.string()).nullish().describe('Known subsidiaries'),
      partOfGroup: z.boolean().nullish().describe('Part of larger corporate group'),
      groupName: z.string().nullish().describe('Corporate group name'),
    })
    .optional(),

  // Stock data (for publicly traded companies)
  stockData: z
    .object({
      currentPrice: z.coerce.number().nullish().describe('Current stock price'),
      currency: z.string().nullish().describe('Currency (EUR, USD, etc.)'),
      priceChange30d: z.coerce.number().nullish().describe('Price change % over 30 days'),
      priceChange1y: z.coerce.number().nullish().describe('Price change % over 1 year'),
      marketCap: z.string().nullish().describe('Market capitalization (e.g., "1.2B EUR")'),
      exchange: z.string().nullish().describe('Stock exchange (XETRA, NYSE, etc.)'),
      fiftyTwoWeekHigh: z.coerce.number().nullish().describe('52-week high price'),
      fiftyTwoWeekLow: z.coerce.number().nullish().describe('52-week low price'),
    })
    .nullish()
    .describe('Stock market data for publicly traded companies'),

  // Market position & trends
  marketPosition: z
    .object({
      marketShare: z.string().nullish().describe('Market share (e.g., "~15% in DACH")'),
      competitors: z.array(z.string()).nullish().describe('Main competitors'),
      industryTrends: z.array(z.string()).nullish().describe('Current industry trends'),
      growthRate: z.string().nullish().describe('Growth rate (e.g., "YoY 12%")'),
      marketSegment: z.string().nullish().describe('Market segment/positioning'),
    })
    .optional()
    .describe('Market position and competitive landscape'),

  // Digital presence & reputation
  digitalPresence: z
    .object({
      linkedInFollowers: z.coerce.number().nullish().describe('LinkedIn company page followers'),
      twitterFollowers: z.coerce.number().nullish().describe('Twitter/X followers'),
      glassdoorRating: z.coerce.number().nullish().describe('Glassdoor rating (0-5)'),
      kunuRating: z.coerce.number().nullish().describe('Kununu rating (0-5)'),
      trustpilotRating: z.coerce.number().nullish().describe('Trustpilot rating (0-5)'),
      glassdoorReviewCount: z.coerce.number().nullish().describe('Number of Glassdoor reviews'),
      kunuReviewCount: z.coerce.number().nullish().describe('Number of Kununu reviews'),
    })
    .optional()
    .describe('Digital presence and online reputation'),

  // Technology footprint (B2B relevant)
  techFootprint: z
    .object({
      crmSystem: z.string().nullish().describe('CRM system (Salesforce, HubSpot, etc.)'),
      marketingTools: z.array(z.string()).nullish().describe('Marketing automation tools detected'),
      cloudProvider: z.string().nullish().describe('Cloud provider (AWS, Azure, GCP)'),
      ecommerceplatform: z.string().nullish().describe('E-commerce platform (Shopify, etc.)'),
      analyticsTools: z.array(z.string()).nullish().describe('Analytics and tracking tools'),
    })
    .optional()
    .describe('Technology stack and tools in use'),

  // Data quality
  dataQuality: z.object({
    confidence: z.coerce.number().min(0).max(100).describe('Overall confidence in data quality'),
    sources: z.array(z.string()).describe('Data sources used'),
    lastUpdated: z.string().describe('When this data was gathered'),
  }),
});

export type CompanyIntelligence = z.infer<typeof companyIntelligenceSchema>;

/**
 * Extended Quick Scan result schema combining all audits
 */
export const extendedQualificationScanSchema = z.object({
  // Existing fields
  techStack: techStackSchema,
  contentVolume: contentVolumeSchema,
  features: featuresSchema,
  blRecommendation: blRecommendationSchema,

  // New enhanced fields
  navigationStructure: navigationStructureSchema.optional(),
  accessibilityAudit: accessibilityAuditSchema.optional(),
  seoAudit: seoAuditSchema.optional(),
  legalCompliance: legalComplianceSchema.optional(),
  performanceIndicators: performanceIndicatorsSchema.optional(),
  screenshots: screenshotsSchema.optional(),
  companyIntelligence: companyIntelligenceSchema.optional(),
});

export type ExtendedQualificationScan = z.infer<typeof extendedQualificationScanSchema>;

// ========================================
// QualificationScan 2.0: Extended Schemas
// ========================================

/**
 * Schema for site tree structure (full sitemap with hierarchy)
 */
export const siteTreeNodeSchema: z.ZodType<SiteTreeNode> = z.lazy(() =>
  z.object({
    path: z.string().describe('URL path segment'),
    url: z.string().optional().describe('Full URL if this is a page'),
    count: z.number().describe('Number of pages at this path and below'),
    children: z.array(siteTreeNodeSchema).optional().describe('Child nodes'),
  })
);

export interface SiteTreeNode {
  path: string;
  url?: string;
  count: number;
  children?: SiteTreeNode[];
}

export const siteTreeSchema = z.object({
  totalPages: z.number().describe('Total number of discovered pages'),
  maxDepth: z.number().describe('Maximum depth of the site structure'),
  crawledAt: z.string().describe('Timestamp of the crawl'),
  sources: z.object({
    sitemap: z.number().describe('Pages found in sitemap'),
    linkDiscovery: z.number().describe('Pages found via link crawling'),
    navigation: z.number().describe('Pages found in navigation'),
  }),
  sections: z
    .array(
      z.object({
        path: z.string().describe('Section root path'),
        label: z.string().optional().describe('Section label from navigation'),
        count: z.number().describe('Number of pages in this section'),
        depth: z.number().describe('Section depth level'),
        children: z.array(siteTreeNodeSchema).optional(),
      })
    )
    .describe('Top-level site sections'),
  navigation: z.object({
    mainNav: z.array(
      z.object({
        label: z.string(),
        url: z.string().optional(),
        children: z
          .array(
            z.object({
              label: z.string(),
              url: z.string().optional(),
            })
          )
          .optional(),
      })
    ),
    footerNav: z.array(
      z.object({
        label: z.string(),
        url: z.string().optional(),
      })
    ),
    breadcrumbs: z.boolean().describe('Uses breadcrumb navigation'),
    megaMenu: z.boolean().describe('Has mega menu pattern'),
    stickyHeader: z.boolean().optional().describe('Header stays visible on scroll'),
    mobileMenu: z.boolean().optional().describe('Has mobile hamburger menu'),
  }),
});

export type SiteTree = z.infer<typeof siteTreeSchema>;

/**
 * Schema for content type distribution (AI-classified page types)
 */
export const contentTypeDistributionSchema = z.object({
  pagesAnalyzed: z.number().describe('Number of pages sampled for classification'),
  distribution: z.array(
    z.object({
      type: z
        .enum([
          'homepage',
          'product',
          'service',
          'blog',
          'news',
          'event',
          'job',
          'person',
          'contact',
          'about',
          'landing',
          'category',
          'search',
          'legal',
          'faq',
          'download',
          'form',
          'custom',
        ])
        .describe('Page type'),
      count: z.number().describe('Number of pages of this type'),
      percentage: z.number().describe('Percentage of total (0-100)'),
      examples: z.array(z.string()).optional().describe('Example URLs'),
    })
  ),
  complexity: z
    .enum(['simple', 'moderate', 'complex', 'very_complex'])
    .describe('Content structure complexity'),
  estimatedContentTypes: z.number().describe('Estimated number of distinct content types for CMS'),
  customFieldsNeeded: z.number().optional().describe('Estimated custom fields for CMS migration'),
  recommendations: z.array(z.string()).optional().describe('Content architecture recommendations'),
});

export type ContentTypeDistribution = z.infer<typeof contentTypeDistributionSchema>;

/**
 * Schema for migration complexity assessment
 */
export const migrationComplexitySchema = z.object({
  score: z
    .number()
    .min(0)
    .max(100)
    .describe('Migration complexity score (0=easy, 100=very complex)'),
  recommendation: z
    .enum(['easy', 'moderate', 'complex', 'very_complex'])
    .describe('Overall recommendation'),
  factors: z.object({
    cmsExportability: z
      .object({
        score: z.number().min(0).max(100),
        hasRestApi: z.boolean(),
        hasXmlExport: z.boolean(),
        hasCli: z.boolean(),
        knownExportMethods: z.array(z.string()).optional().describe('Available export methods'),
        notes: z.string().optional(),
      })
      .describe('How easy is it to export data from the current CMS'),
    dataQuality: z
      .object({
        score: z.number().min(0).max(100),
        brokenLinks: z.number().optional(),
        duplicateContent: z.boolean().optional(),
        inconsistentStructure: z.boolean(),
        cleanupRequired: z
          .enum(['minimal', 'moderate', 'significant'])
          .optional()
          .describe('Cleanup level required'),
        notes: z.string().optional(),
      })
      .describe('Quality of existing content and data'),
    contentComplexity: z
      .object({
        score: z.number().min(0).max(100),
        embeddedMedia: z.boolean(),
        customFields: z.number().optional(),
        complexLayouts: z.boolean(),
        richTextComplexity: z
          .enum(['simple', 'moderate', 'complex'])
          .optional()
          .describe('Rich text complexity'),
        notes: z.string().optional(),
      })
      .describe('Complexity of content structure'),
    integrationComplexity: z
      .object({
        score: z.number().min(0).max(100),
        externalApis: z.number(),
        ssoRequired: z.boolean(),
        thirdPartyPlugins: z.number().optional(),
        integrationList: z.array(z.string()).optional().describe('List of detected integrations'),
        notes: z.string().optional(),
      })
      .describe('External integrations to migrate'),
  }),
  warnings: z.array(z.string()).describe('Migration warnings and risks'),
  opportunities: z
    .array(z.string())
    .optional()
    .describe('Opportunities for improvement during migration'),
  estimatedEffort: z
    .object({
      minPT: z.number().describe('Minimum person-days'),
      maxPT: z.number().describe('Maximum person-days'),
      confidence: z.number().min(0).max(100).describe('Confidence in estimate'),
      assumptions: z.array(z.string()).optional().describe('Assumptions for the estimate'),
    })
    .optional(),
});

export type MigrationComplexity = z.infer<typeof migrationComplexitySchema>;

/**
 * Schema for decision maker / contact research
 */
export const decisionMakerSchema = z.object({
  name: z.string().describe('Full name'),
  role: z.string().describe('Job title/role'),
  linkedInUrl: z.string().url().optional().describe('LinkedIn profile URL'),
  xingUrl: z.string().url().optional().describe('Xing profile URL'),
  email: z.string().email().optional().describe('Email address'),
  emailConfidence: z
    .enum(['confirmed', 'likely', 'derived', 'unknown'])
    .optional()
    .describe('Confidence in email correctness'),
  phone: z.string().optional().describe('Phone number'),
  source: z
    .enum(['impressum', 'linkedin', 'xing', 'website', 'web_search', 'derived', 'team_page'])
    .describe('Where this contact was found'),
});

export type DecisionMaker = z.infer<typeof decisionMakerSchema>;

export const decisionMakersResearchSchema = z.object({
  decisionMakers: z.array(decisionMakerSchema).describe('Key decision makers found'),
  genericContacts: z
    .object({
      mainEmail: z.string().email().optional().describe('General contact email'),
      salesEmail: z.string().email().optional().describe('Sales contact email'),
      techEmail: z.string().email().optional().describe('Technical contact email'),
      marketingEmail: z.string().email().optional().describe('Marketing contact email'),
      supportEmail: z.string().email().optional().describe('Support contact email'),
      phone: z.string().optional().describe('Main phone number'),
      fax: z.string().optional().describe('Fax number'),
    })
    .optional(),
  researchQuality: z.object({
    linkedInFound: z.number().describe('Number of LinkedIn profiles found'),
    xingFound: z.number().optional().describe('Number of Xing profiles found'),
    emailsConfirmed: z.number().describe('Number of confirmed emails'),
    emailsDerived: z.number().describe('Number of derived/guessed emails'),
    confidence: z.number().min(0).max(100).describe('Overall confidence in research quality'),
    sources: z.array(z.string()).describe('Sources used for research'),
    lastUpdated: z.string().describe('Timestamp of research'),
  }),
});

export type DecisionMakersResearch = z.infer<typeof decisionMakersResearchSchema>;

/**
 * Schema for enhanced accessibility audit (multi-page with axe-core)
 */
export const enhancedAccessibilityAuditSchema = z.object({
  wcagLevel: z.enum(['A', 'AA', 'AAA', 'fail']).describe('Achieved WCAG compliance level'),
  targetLevel: z.enum(['A', 'AA', 'AAA']).describe('Target WCAG level'),
  score: z.number().min(0).max(100).describe('Overall accessibility score'),
  pagesAudited: z.number().describe('Number of pages audited'),
  auditMethod: z.enum(['html_parsing', 'axe_core', 'manual']).describe('Audit method used'),
  violations: z.object({
    critical: z.number(),
    serious: z.number(),
    moderate: z.number(),
    minor: z.number(),
    total: z.number(),
  }),
  topIssues: z
    .array(
      z.object({
        rule: z.string().describe('axe-core rule ID'),
        count: z.number().describe('Number of occurrences'),
        impact: z.enum(['critical', 'serious', 'moderate', 'minor']),
        description: z.string(),
        helpUrl: z.string().optional(),
        affectedPages: z.array(z.string()).optional().describe('URLs where this issue was found'),
      })
    )
    .describe('Most common accessibility issues'),
  passingRules: z.number().describe('Number of passing accessibility rules'),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(['high', 'medium', 'low']),
        issue: z.string(),
        recommendation: z.string(),
        wcagCriteria: z.string().optional(),
      })
    )
    .optional(),
});

export type EnhancedAccessibilityAudit = z.infer<typeof enhancedAccessibilityAuditSchema>;

/**
 * Extended Quick Scan 2.0 result schema
 */
export const extendedQualificationScan2Schema = z.object({
  // Existing fields
  techStack: techStackSchema,
  contentVolume: contentVolumeSchema,
  features: featuresSchema,
  blRecommendation: blRecommendationSchema,

  // Original enhanced fields
  navigationStructure: navigationStructureSchema.optional(),
  accessibilityAudit: accessibilityAuditSchema.optional(),
  seoAudit: seoAuditSchema.optional(),
  legalCompliance: legalComplianceSchema.optional(),
  performanceIndicators: performanceIndicatorsSchema.optional(),
  screenshots: screenshotsSchema.optional(),
  companyIntelligence: companyIntelligenceSchema.optional(),

  // NEW QualificationScan 2.0 fields
  siteTree: siteTreeSchema.optional().describe('Full sitemap structure with hierarchy'),
  contentTypes: contentTypeDistributionSchema.optional().describe('AI-classified content types'),
  migrationComplexity: migrationComplexitySchema
    .optional()
    .describe('Migration complexity assessment'),
  decisionMakers: decisionMakersResearchSchema.optional().describe('Decision makers and contacts'),
  enhancedAccessibility: enhancedAccessibilityAuditSchema
    .optional()
    .describe('Multi-page axe-core audit'),
});

export type ExtendedQualificationScan2 = z.infer<typeof extendedQualificationScan2Schema>;

// ========================================
// Multi-Page Analysis Schemas
// ========================================

/**
 * Schema for navigation component detection
 */
export const navigationComponentSchema = z.object({
  type: z
    .enum([
      'mega_menu',
      'sticky_header',
      'mobile_menu',
      'sidebar',
      'breadcrumbs',
      'pagination',
      'standard',
    ])
    .describe('Navigation component type'),
  features: z
    .array(z.string())
    .describe('Additional features like search, language switcher, cart'),
  itemCount: z.number().optional().describe('Number of navigation items'),
  maxDepth: z.number().optional().describe('Maximum navigation depth'),
});

export type NavigationComponent = z.infer<typeof navigationComponentSchema>;

/**
 * Schema for content block detection
 */
export const contentBlockComponentSchema = z.object({
  type: z
    .enum([
      'hero',
      'cards',
      'teaser',
      'accordion',
      'tabs',
      'slider',
      'testimonials',
      'timeline',
      'grid',
      'list',
      'cta',
      'pricing',
      'faq',
      'team',
      'stats',
      'features',
    ])
    .describe('Content block type'),
  count: z.number().describe('Number of occurrences across analyzed pages'),
  examples: z.array(z.string()).describe('CSS class or ID examples'),
  hasImages: z.boolean().optional().describe('Contains images'),
  hasLinks: z.boolean().optional().describe('Contains links'),
});

export type ContentBlockComponent = z.infer<typeof contentBlockComponentSchema>;

/**
 * Schema for form component detection
 */
export const formComponentSchema = z.object({
  type: z
    .enum([
      'contact',
      'newsletter',
      'search',
      'login',
      'registration',
      'checkout',
      'filter',
      'generic',
    ])
    .describe('Form type'),
  fields: z.number().describe('Number of form fields'),
  hasValidation: z.boolean().optional().describe('Has client-side validation'),
  hasFileUpload: z.boolean().optional().describe('Has file upload field'),
  hasCaptcha: z.boolean().optional().describe('Has CAPTCHA protection'),
});

export type FormComponent = z.infer<typeof formComponentSchema>;

/**
 * Schema for media element detection
 */
export const mediaComponentSchema = z.object({
  type: z
    .enum([
      'image_gallery',
      'video_embed',
      'video_player',
      'audio_player',
      'carousel',
      'lightbox',
      'background_video',
    ])
    .describe('Media element type'),
  count: z.number().describe('Number of occurrences'),
  providers: z.array(z.string()).optional().describe('Video providers like YouTube, Vimeo'),
});

export type MediaComponent = z.infer<typeof mediaComponentSchema>;

/**
 * Schema for extracted UI components summary
 */
export const extractedComponentsSchema = z.object({
  navigation: z.array(navigationComponentSchema).describe('Navigation components found'),
  contentBlocks: z.array(contentBlockComponentSchema).describe('Content block patterns found'),
  forms: z.array(formComponentSchema).describe('Form types found'),
  mediaElements: z.array(mediaComponentSchema).describe('Media elements found'),
  interactiveElements: z
    .array(z.string())
    .describe('Interactive elements like modals, tooltips, maps'),
  summary: z.object({
    totalComponents: z.number().describe('Total components found'),
    complexity: z
      .enum(['simple', 'moderate', 'complex', 'very_complex'])
      .describe('UI complexity assessment'),
    uniquePatterns: z.number().describe('Number of unique component patterns'),
    estimatedComponentTypes: z.number().describe('Estimated CMS component types needed'),
  }),
});

export type ExtractedComponents = z.infer<typeof extractedComponentsSchema>;

/**
 * Schema for multi-page analysis metadata
 */
export const multiPageAnalysisSchema = z.object({
  pagesAnalyzed: z.number().describe('Number of pages analyzed'),
  analyzedUrls: z.array(z.string()).describe('URLs that were analyzed'),
  pageCategories: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe('URLs grouped by category'),
  detectionMethod: z
    .enum(['multi-page', 'single-page', 'httpx-fallback'])
    .describe('Tech detection method used'),
  analysisTimestamp: z.string().describe('When analysis was performed'),
});

export type MultiPageAnalysis = z.infer<typeof multiPageAnalysisSchema>;
