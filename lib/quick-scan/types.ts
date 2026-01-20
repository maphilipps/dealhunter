/**
 * QuickScan Types - Consolidated type definitions
 * Used across facts-tab, decision-matrix-tab, and quick-scan-results components
 */

// ========================================
// Tech Stack Types
// ========================================

export interface TechStackData {
  cms?: string;
  cmsVersion?: string;
  cmsConfidence?: number;
  framework?: string;
  hosting?: string;
  cdn?: string;
  server?: string;
  backend?: string[];
  libraries?: string[];
  analytics?: string[];
  marketing?: string[];
  javascriptFrameworks?: Array<{ name: string; version?: string; confidence: number }>;
  cssFrameworks?: Array<{ name: string; version?: string; confidence: number }>;
  apiEndpoints?: {
    rest?: string[];
    graphql?: boolean;
    graphqlEndpoint?: string;
  };
  headlessCms?: string[];
  serverSideRendering?: boolean;
  buildTools?: string[];
  cdnProviders?: string[];
  overallConfidence?: number;
}

// ========================================
// Content & Features Types
// ========================================

export interface ContentVolumeData {
  estimatedPageCount?: number;
  sitemapFound?: boolean;
  contentTypes?: string[];
  mediaAssets?: {
    images?: number;
    videos?: number;
    documents?: number;
  };
  languages?: string[];
  complexity?: 'low' | 'medium' | 'high';
}

export interface FeaturesData {
  ecommerce?: boolean;
  userAccounts?: boolean;
  search?: boolean;
  multiLanguage?: boolean;
  blog?: boolean;
  forms?: boolean;
  api?: boolean;
  mobileApp?: boolean;
  customFeatures?: string[];
}

// ========================================
// Navigation Types
// ========================================

export interface NavigationItem {
  label: string;
  url?: string;
  children?: NavigationItem[];
}

export interface NavigationData {
  mainNav?: NavigationItem[];
  footerNav?: Array<{ label: string; url?: string }>;
  hasSearch?: boolean;
  hasBreadcrumbs?: boolean;
  hasMegaMenu?: boolean;
  maxDepth?: number;
  totalItems?: number;
}

// ========================================
// Audit Types
// ========================================

export interface AccessibilityAuditData {
  score: number;
  level?: 'A' | 'AA' | 'AAA' | 'fail';
  criticalIssues: number;
  seriousIssues: number;
  moderateIssues: number;
  minorIssues: number;
  checks?: {
    hasAltTexts?: boolean;
    hasAriaLabels?: boolean;
    hasProperHeadings?: boolean;
    hasSkipLinks?: boolean;
    colorContrast?: string;
    keyboardNavigation?: string;
    formLabels?: string;
    languageAttribute?: boolean;
  };
  topIssues?: Array<{ description: string }>;
  recommendations?: string[];
}

export interface SEOAuditData {
  score?: number;
  checks?: {
    hasTitle?: boolean;
    titleLength?: number;
    hasMetaDescription?: boolean;
    metaDescriptionLength?: number;
    hasCanonical?: boolean;
    hasRobotsTxt?: boolean;
    hasSitemap?: boolean;
    hasStructuredData?: boolean;
    hasOpenGraph?: boolean;
    mobileViewport?: boolean;
  };
  issues?: Array<{ description: string }>;
}

export interface LegalComplianceData {
  score: number;
  checks?: {
    hasImprint?: boolean;
    hasPrivacyPolicy?: boolean;
    hasCookieBanner?: boolean;
    hasTermsOfService?: boolean;
    hasAccessibilityStatement?: boolean;
  };
  gdprIndicators?: {
    cookieConsentTool?: string;
    analyticsCompliant?: boolean;
    hasDataProcessingInfo?: boolean;
  };
  issues?: Array<{ type: string; severity: string; description: string }>;
}

export interface PerformanceData {
  htmlSize?: number;
  resourceCount?: {
    scripts?: number;
    stylesheets?: number;
    images?: number;
    fonts?: number;
  };
  estimatedLoadTime?: 'fast' | 'medium' | 'slow';
  hasLazyLoading?: boolean;
  hasMinification?: boolean;
  hasCaching?: boolean;
  renderBlockingResources?: number;
}

// ========================================
// Screenshots & Company Types
// ========================================

export interface ScreenshotsData {
  homepage?: {
    desktop?: string;
    mobile?: string;
  };
  keyPages?: Array<{ name?: string; title?: string; path?: string; url?: string; screenshot?: string }>;
  timestamp?: string;
}

export interface CompanyIntelligenceData {
  basicInfo?: {
    name?: string;
    legalForm?: string;
    headquarters?: string;
    employeeCount?: string;
    industry?: string;
    website?: string;
    description?: string;
  };
  financials?: {
    revenueClass?: 'small' | 'medium' | 'large' | 'enterprise';
    publiclyTraded?: boolean;
  };
  newsAndReputation?: {
    recentNews?: Array<{
      title: string;
      source: string;
      date?: string;
      sentiment?: string;
    }>;
    sentimentScore?: number;
  };
  leadership?: {
    ceo?: string;
    cto?: string;
  };
  dataQuality?: {
    confidence?: number;
    sources?: string[];
    lastUpdated?: string;
  };
}

// ========================================
// QuickScan 2.0 Types
// ========================================

export interface SiteTreeNodeData {
  path: string;
  url?: string;
  count: number;
  children?: SiteTreeNodeData[];
}

export interface SiteTreeData {
  totalPages: number;
  maxDepth: number;
  crawledAt?: string;
  sources?: {
    sitemap: number;
    linkDiscovery: number;
    navigation: number;
  };
  sections?: Array<{
    path: string;
    label?: string;
    count: number;
    depth: number;
    children?: SiteTreeNodeData[];
  }>;
  navigation?: {
    mainNav?: Array<{ label: string; url?: string }>;
    footerNav?: Array<{ label: string; url?: string }>;
    breadcrumbs?: boolean;
    megaMenu?: boolean;
  };
}

export interface ContentTypesData {
  pagesAnalyzed?: number;
  distribution?: Array<{
    type: string;
    count: number;
    percentage: number;
    examples?: string[];
  }>;
  complexity?: 'simple' | 'moderate' | 'complex' | 'very_complex';
  estimatedContentTypes?: number;
  customFieldsNeeded?: number;
  recommendations?: string[];
}

export interface MigrationComplexityData {
  score: number;
  recommendation: 'easy' | 'moderate' | 'complex' | 'very_complex' | 'simple';
  factors?: {
    cmsExportability?: {
      score: number;
      hasRestApi?: boolean;
      hasXmlExport?: boolean;
      hasCli?: boolean;
      knownExportMethods?: string[];  // z.B. ["WP-CLI", "REST API", "XML Export"]
      notes?: string;
    };
    dataQuality?: {
      score: number;
      brokenLinks?: number;
      duplicateContent?: boolean;
      inconsistentStructure?: boolean;
      cleanupRequired?: 'minimal' | 'moderate' | 'significant';
      notes?: string;
    };
    contentComplexity?: {
      score: number;
      embeddedMedia?: boolean;
      customFields?: number;
      complexLayouts?: boolean;
      richTextComplexity?: 'simple' | 'moderate' | 'complex';
      notes?: string;
    };
    integrationComplexity?: {
      score: number;
      externalApis?: number;
      ssoRequired?: boolean;
      thirdPartyPlugins?: number;
      integrationList?: string[];  // Liste aller gefundenen Integrationen
      notes?: string;
    };
  };
  warnings?: string[];
  opportunities?: string[];
  estimatedEffort?: {
    minPT: number;
    maxPT: number;
    confidence: number;
    assumptions?: string[];  // Annahmen für die Schätzung
  };
}

export interface DecisionMakerData {
  name: string;
  role: string;
  linkedInUrl?: string;
  xingUrl?: string;
  email?: string;
  emailConfidence?: 'confirmed' | 'likely' | 'derived' | 'unknown' | 'high' | 'medium' | 'low';
  phone?: string;
  source: 'impressum' | 'linkedin' | 'xing' | 'website' | 'web_search' | 'derived';
}

export interface DecisionMakersData {
  decisionMakers?: DecisionMakerData[];
  genericContacts?: {
    mainEmail?: string;
    salesEmail?: string;
    techEmail?: string;
    marketingEmail?: string;
    supportEmail?: string;
    phone?: string;
    fax?: string;
  };
  researchQuality?: {
    linkedInFound?: number;
    xingFound?: number;
    emailsConfirmed?: number;
    emailsDerived?: number;
    confidence?: number;
    sources?: string[];
    lastUpdated?: string;
  };
}

// ========================================
// Business Line Types
// ========================================

export interface BlRecommendationData {
  primaryBusinessLine?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  alternativeBusinessLines?: Array<{ name: string; confidence: number }>;
  requiredSkills?: string[];
}

// ========================================
// Integrations Types
// ========================================

export interface IntegrationsData {
  analytics?: string[];
  marketing?: string[];
  payment?: string[];
  social?: string[];
  other?: string[];
}

// ========================================
// Multi-Page Analysis Types
// ========================================

export interface NavigationComponentData {
  type: 'mega_menu' | 'sticky_header' | 'mobile_menu' | 'sidebar' | 'breadcrumbs' | 'pagination' | 'standard';
  features: string[];
  itemCount?: number;
  maxDepth?: number;
}

export interface ContentBlockComponentData {
  type: 'hero' | 'cards' | 'teaser' | 'accordion' | 'tabs' | 'slider' | 'testimonials' | 'timeline' | 'grid' | 'list' | 'cta' | 'pricing' | 'faq' | 'team' | 'stats' | 'features';
  count: number;
  examples: string[];
  hasImages?: boolean;
  hasLinks?: boolean;
}

export interface FormComponentData {
  type: 'contact' | 'newsletter' | 'search' | 'login' | 'registration' | 'checkout' | 'filter' | 'generic';
  fields: number;
  hasValidation?: boolean;
  hasFileUpload?: boolean;
  hasCaptcha?: boolean;
}

export interface MediaComponentData {
  type: 'image_gallery' | 'video_embed' | 'video_player' | 'audio_player' | 'carousel' | 'lightbox' | 'background_video';
  count: number;
  providers?: string[];
}

// Drupal Mapping Hints for Website Audit Skill
export interface DrupalMappingData {
  suggestedParagraphTypes: string[];      // z.B. ["hero", "cards_grid", "accordion"]
  suggestedContentTypes: string[];        // z.B. ["article", "event", "product"]
  suggestedTaxonomies: string[];          // z.B. ["category", "tag", "location"]
  suggestedMediaTypes: string[];          // z.B. ["image", "video", "document"]
  estimatedViews: number;                 // Geschätzte Views basierend auf Listen
}

export interface ExtractedComponentsData {
  navigation: NavigationComponentData[];
  contentBlocks: ContentBlockComponentData[];
  forms: FormComponentData[];
  mediaElements: MediaComponentData[];
  interactiveElements: string[];
  // Drupal-Mapping Hints für Website Audit Skill
  drupalMapping?: DrupalMappingData;
  summary: {
    totalComponents: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    uniquePatterns: number;
    estimatedComponentTypes: number;
    // Drupal Entity Schätzungen
    estimatedDrupalEntities?: {
      contentTypes: number;
      paragraphTypes: number;
      taxonomies: number;
      views: number;
    };
  };
}

export interface MultiPageAnalysisData {
  pagesAnalyzed: number;
  analyzedUrls: string[];
  pageCategories?: Record<string, string[]>;
  detectionMethod: 'multi-page' | 'single-page' | 'httpx-fallback' | 'wappalyzer';
  analysisTimestamp: string;
}

// ========================================
// Combined Results Type
// ========================================

export interface QuickScanResultsData {
  techStack: TechStackData | Record<string, never>;
  contentVolume: ContentVolumeData | Record<string, never>;
  features: FeaturesData | Record<string, never>;
  blRecommendation: BlRecommendationData;
  // Enhanced audits
  accessibilityAudit?: AccessibilityAuditData | null;
  seoAudit?: SEOAuditData | null;
  legalCompliance?: LegalComplianceData | null;
  performanceIndicators?: PerformanceData | null;
  navigationStructure?: NavigationData | null;
  screenshots?: ScreenshotsData | null;
  companyIntelligence?: CompanyIntelligenceData | null;
  integrations?: IntegrationsData | null;
  // QuickScan 2.0
  siteTree?: SiteTreeData | null;
  contentTypes?: ContentTypesData | null;
  migrationComplexity?: MigrationComplexityData | null;
  decisionMakers?: DecisionMakersData | null;
  // Multi-Page Analysis
  extractedComponents?: ExtractedComponentsData | null;
  multiPageAnalysis?: MultiPageAnalysisData | null;
}
