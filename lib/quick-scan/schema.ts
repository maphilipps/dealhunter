import { z } from 'zod';

/**
 * Schema for tech stack detection results
 */
export const techStackSchema = z.object({
  // CMS Detection
  cms: z.string().optional().describe('Detected CMS (WordPress, Drupal, Typo3, Joomla, Custom, etc.)'),
  cmsVersion: z.string().optional().describe('CMS version if detectable'),
  cmsConfidence: z.number().min(0).max(100).optional().describe('Confidence in CMS detection (0-100)'),

  // Framework Detection
  framework: z.string().optional().describe('Frontend framework (React, Vue, Angular, jQuery, Vanilla JS, etc.)'),
  frameworkVersion: z.string().optional().describe('Framework version if detectable'),

  // Backend Detection
  backend: z.array(z.string()).optional().default([]).describe('Backend technologies detected (PHP, Node.js, Java, .NET, Python, etc.)'),

  // Hosting & Infrastructure
  hosting: z.string().optional().describe('Hosting provider (AWS, Azure, GCP, on-premise, Unknown)'),
  cdn: z.string().optional().describe('CDN provider if detected (Cloudflare, Akamai, etc.)'),
  server: z.string().optional().describe('Web server (Apache, Nginx, IIS, etc.)'),

  // Additional Technologies
  libraries: z.array(z.string()).optional().default([]).describe('JavaScript libraries and tools detected'),
  analytics: z.array(z.string()).optional().default([]).describe('Analytics tools (Google Analytics, Matomo, etc.)'),
  marketing: z.array(z.string()).optional().default([]).describe('Marketing tools (HubSpot, Mailchimp, etc.)'),

  // Overall Assessment
  overallConfidence: z.number().min(0).max(100).optional().describe('Overall confidence in tech stack detection'),
});

export type TechStack = z.infer<typeof techStackSchema>;

/**
 * Schema for content volume analysis
 */
export const contentVolumeSchema = z.object({
  // Page counts - distinguish between actual (from sitemap) and estimated
  actualPageCount: z.number().optional().describe('Actual page count from sitemap'),
  estimatedPageCount: z.number().describe('Estimated total number of pages (fallback if no sitemap)'),
  sitemapFound: z.boolean().optional().describe('Whether a sitemap was found'),
  sitemapUrl: z.string().optional().describe('URL of the sitemap if found'),

  contentTypes: z.array(z.object({
    type: z.string().describe('Content type (Blog, Product, Service, etc.)'),
    count: z.number().describe('Estimated count of this content type'),
  })).optional().default([]),
  mediaAssets: z.object({
    images: z.number().describe('Estimated number of images'),
    videos: z.number().describe('Estimated number of videos'),
    documents: z.number().describe('Estimated number of downloadable documents'),
  }).optional(),
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
  topIssues: z.array(z.object({
    type: z.string().describe('Issue type (e.g., "missing-alt", "color-contrast")'),
    count: z.number().describe('Number of occurrences'),
    severity: z.enum(['critical', 'serious', 'moderate', 'minor']).describe('Severity level'),
    description: z.string().describe('Human-readable description'),
  })).optional().describe('Top accessibility issues found'),

  // Recommendations
  recommendations: z.array(z.string()).optional().describe('Prioritized recommendations to fix issues'),
});

export type AccessibilityAudit = z.infer<typeof accessibilityAuditSchema>;

/**
 * Schema for screenshots
 */
export const screenshotsSchema = z.object({
  homepage: z.object({
    desktop: z.string().optional().describe('Desktop screenshot path/URL'),
    mobile: z.string().optional().describe('Mobile screenshot path/URL'),
  }).optional(),
  keyPages: z.array(z.object({
    url: z.string().describe('Page URL'),
    title: z.string().describe('Page title'),
    screenshot: z.string().describe('Screenshot path/URL'),
  })).optional().describe('Screenshots of key pages'),
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
  issues: z.array(z.object({
    type: z.string().describe('Issue type'),
    severity: z.enum(['error', 'warning', 'info']).describe('Severity'),
    description: z.string().describe('Description'),
  })).optional(),
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
  gdprIndicators: z.object({
    cookieConsentTool: z.string().optional().describe('Detected cookie consent tool (e.g., CookieFirst, OneTrust)'),
    analyticsCompliant: z.boolean().optional().describe('Analytics appears GDPR-compliant'),
    hasDataProcessingInfo: z.boolean().optional().describe('Has info about data processing'),
  }).optional(),

  issues: z.array(z.object({
    type: z.string().describe('Issue type'),
    severity: z.enum(['critical', 'warning', 'info']).describe('Severity'),
    description: z.string().describe('Description'),
  })).optional(),
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
  alternativeBusinessLines: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(100),
    reason: z.string(),
  })).describe('Alternative business unit recommendations'),
  requiredSkills: z.array(z.string()).describe('Key skills needed for this project'),
});

export type BLRecommendation = z.infer<typeof blRecommendationSchema>;

/**
 * Schema for navigation structure analysis
 */
export const navigationStructureSchema = z.object({
  // Main navigation
  mainNav: z.array(z.object({
    label: z.string().describe('Navigation item label'),
    url: z.string().optional().describe('Link URL'),
    children: z.array(z.object({
      label: z.string(),
      url: z.string().optional(),
    })).optional().describe('Sub-navigation items'),
  })).describe('Main navigation items'),

  // Footer navigation
  footerNav: z.array(z.object({
    label: z.string().describe('Footer section/link label'),
    url: z.string().optional().describe('Link URL'),
  })).optional().describe('Footer navigation items'),

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
  pageTypesDetected: z.array(z.string()).optional().describe('Content types inferred from navigation (Blog, Products, Services, etc.)'),
});

export type NavigationStructure = z.infer<typeof navigationStructureSchema>;

/**
 * Schema for company intelligence data
 */
export const companyIntelligenceSchema = z.object({
  // Basic company info
  basicInfo: z.object({
    name: z.string().describe('Official company name'),
    legalForm: z.string().optional().describe('Legal form (GmbH, AG, SE, etc.)'),
    registrationNumber: z.string().optional().describe('HRB or similar registration number'),
    foundedYear: z.number().optional().describe('Year company was founded'),
    headquarters: z.string().optional().describe('Headquarters location'),
    employeeCount: z.string().optional().describe('Employee count or range'),
    industry: z.string().optional().describe('Primary industry/sector'),
    website: z.string().describe('Company website URL'),
  }),

  // Financial indicators
  financials: z.object({
    revenueClass: z.enum(['startup', 'small', 'medium', 'large', 'enterprise', 'unknown']).optional()
      .describe('Revenue class estimation'),
    growthIndicators: z.array(z.string()).optional().describe('Growth signals (hiring, expansion, funding)'),
    publiclyTraded: z.boolean().optional().describe('Is company publicly traded'),
    stockSymbol: z.string().optional().describe('Stock ticker symbol if public'),
    fundingStatus: z.string().optional().describe('For startups: funding stage'),
    lastFundingAmount: z.string().optional().describe('Last funding round amount'),
  }).optional(),

  // Recent news and reputation
  newsAndReputation: z.object({
    recentNews: z.array(z.object({
      title: z.string().describe('News headline'),
      source: z.string().describe('News source'),
      date: z.string().optional().describe('Publication date'),
      url: z.string().optional().describe('Article URL'),
      sentiment: z.enum(['positive', 'neutral', 'negative']).optional().describe('Sentiment of news'),
    })).optional().describe('Recent news articles (top 5)'),
    sentimentScore: z.number().min(-1).max(1).optional().describe('Overall sentiment (-1 to 1)'),
    riskIndicators: z.array(z.string()).optional().describe('Any risk signals found'),
    positiveSignals: z.array(z.string()).optional().describe('Positive signals found'),
  }).optional(),

  // Leadership and contacts
  leadership: z.object({
    ceo: z.string().optional().describe('CEO name'),
    cto: z.string().optional().describe('CTO/IT head name'),
    cmo: z.string().optional().describe('CMO/Marketing head name'),
    otherContacts: z.array(z.object({
      name: z.string(),
      title: z.string(),
    })).optional().describe('Other known decision makers'),
  }).optional(),

  // Corporate structure
  corporateStructure: z.object({
    parentCompany: z.string().optional().describe('Parent company if applicable'),
    subsidiaries: z.array(z.string()).optional().describe('Known subsidiaries'),
    partOfGroup: z.boolean().optional().describe('Part of larger corporate group'),
    groupName: z.string().optional().describe('Corporate group name'),
  }).optional(),

  // Data quality
  dataQuality: z.object({
    confidence: z.number().min(0).max(100).describe('Overall confidence in data quality'),
    sources: z.array(z.string()).describe('Data sources used'),
    lastUpdated: z.string().describe('When this data was gathered'),
  }),
});

export type CompanyIntelligence = z.infer<typeof companyIntelligenceSchema>;

/**
 * Extended Quick Scan result schema combining all audits
 */
export const extendedQuickScanSchema = z.object({
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

export type ExtendedQuickScan = z.infer<typeof extendedQuickScanSchema>;
