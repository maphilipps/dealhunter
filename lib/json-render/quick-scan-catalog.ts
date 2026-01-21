import { z } from 'zod';

/**
 * Quick Scan Component Catalog for json-render
 * Defines components AI can use to visualize Quick Scan results
 *
 * Component Categories:
 * 1. Layout: Grid, ResultCard, Section
 * 2. Metrics: Metric, ScoreCard, ProgressBar
 * 3. Tech: TechBadge, TechStack, FeatureList
 * 4. Business: Recommendation, AlternativesList, SkillsList
 * 5. Audits: AccessibilityAudit, SEOAudit, LegalCompliance, PerformanceCard
 * 6. Content: ContentStats, ContentTypeDistribution, NavigationStats, SiteTree
 * 7. Company: CompanyCard, ContactInfo, DecisionMakersList, NewsList
 * 8. Media: Screenshots
 * 9. Migration: MigrationComplexity
 */

// Component schemas
export const quickScanCatalogSchema = {
  // ========================================
  // Layout Components
  // ========================================

  ResultCard: z.object({
    title: z.string(),
    description: z.string().optional(),
    variant: z.enum(['default', 'highlight', 'warning', 'success', 'info']).optional(),
    icon: z
      .enum([
        'tech',
        'content',
        'features',
        'recommendation',
        'accessibility',
        'seo',
        'legal',
        'performance',
        'navigation',
        'company',
        'migration',
        'screenshots',
      ])
      .optional(),
    collapsible: z.boolean().optional(),
    defaultOpen: z.boolean().optional(),
  }),

  Grid: z.object({
    columns: z.number().optional(),
    gap: z.enum(['sm', 'md', 'lg']).optional(),
  }),

  Section: z.object({
    title: z.string(),
    description: z.string().optional(),
    badge: z.string().optional(),
    badgeVariant: z.enum(['default', 'secondary', 'destructive', 'outline']).optional(),
  }),

  // ========================================
  // Metric Components
  // ========================================

  Metric: z.object({
    label: z.string(),
    value: z.string(),
    subValue: z.string().optional(),
    trend: z.enum(['up', 'down', 'neutral']).optional(),
  }),

  ScoreCard: z.object({
    label: z.string(),
    score: z.number(),
    maxScore: z.number().optional(),
    variant: z.enum(['default', 'success', 'warning', 'danger']).optional(),
    showProgress: z.boolean().optional(),
  }),

  ProgressBar: z.object({
    label: z.string(),
    value: z.number(),
    max: z.number().optional(),
    showValue: z.boolean().optional(),
    variant: z.enum(['default', 'success', 'warning', 'danger']).optional(),
  }),

  // ========================================
  // Tech Components
  // ========================================

  TechBadge: z.object({
    name: z.string(),
    version: z.string().optional(),
    confidence: z.number().optional(),
    category: z
      .enum(['cms', 'framework', 'backend', 'hosting', 'library', 'tool', 'analytics', 'cdn'])
      .optional(),
  }),

  TechStack: z.object({
    title: z.string().optional(),
    technologies: z.array(
      z.object({
        name: z.string(),
        version: z.string().optional(),
        confidence: z.number().optional(),
        category: z.string().optional(),
      })
    ),
  }),

  FeatureList: z.object({
    title: z.string().optional(),
    features: z.array(
      z.object({
        name: z.string(),
        detected: z.boolean(),
        details: z.string().optional(),
      })
    ),
  }),

  // ========================================
  // Business Components
  // ========================================

  Recommendation: z.object({
    businessUnit: z.string(),
    confidence: z.number(),
    reasoning: z.string(),
  }),

  AlternativesList: z.object({
    title: z.string().optional(),
    alternatives: z.array(
      z.object({
        name: z.string(),
        confidence: z.number(),
        reason: z.string(),
      })
    ),
  }),

  SkillsList: z.object({
    title: z.string().optional(),
    skills: z.array(z.string()),
  }),

  // ========================================
  // Audit Components
  // ========================================

  AccessibilityAudit: z.object({
    score: z.number(),
    level: z.enum(['A', 'AA', 'AAA', 'fail']).optional(),
    issues: z.object({
      critical: z.number(),
      serious: z.number(),
      moderate: z.number(),
      minor: z.number(),
    }),
    checks: z
      .array(
        z.object({
          name: z.string(),
          passed: z.boolean(),
        })
      )
      .optional(),
  }),

  SEOAudit: z.object({
    score: z.number().optional(),
    checks: z.array(
      z.object({
        name: z.string(),
        passed: z.boolean(),
      })
    ),
  }),

  LegalCompliance: z.object({
    score: z.number(),
    checks: z.array(
      z.object({
        name: z.string(),
        passed: z.boolean(),
      })
    ),
    cookieTool: z.string().optional(),
  }),

  PerformanceCard: z.object({
    loadTime: z.enum(['fast', 'medium', 'slow']).optional(),
    resources: z
      .object({
        scripts: z.number().optional(),
        stylesheets: z.number().optional(),
        images: z.number().optional(),
        fonts: z.number().optional(),
      })
      .optional(),
    optimizations: z
      .array(
        z.object({
          name: z.string(),
          enabled: z.boolean(),
        })
      )
      .optional(),
  }),

  // ========================================
  // Content Components
  // ========================================

  ContentStats: z.object({
    pageCount: z.number().optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional(),
    languages: z.array(z.string()).optional(),
    contentTypes: z
      .array(
        z.object({
          type: z.string(),
          count: z.number(),
        })
      )
      .optional(),
    media: z
      .object({
        images: z.number().optional(),
        videos: z.number().optional(),
        documents: z.number().optional(),
      })
      .optional(),
  }),

  ContentTypeDistribution: z.object({
    title: z.string().optional(),
    types: z.array(
      z.object({
        type: z.string(),
        count: z.number(),
        percentage: z.number(),
      })
    ),
    recommendations: z.array(z.string()).optional(),
  }),

  NavigationStats: z.object({
    totalItems: z.number(),
    maxDepth: z.number(),
    features: z
      .object({
        search: z.boolean().optional(),
        breadcrumbs: z.boolean().optional(),
        megaMenu: z.boolean().optional(),
      })
      .optional(),
    mainNavItems: z.array(z.string()).optional(),
  }),

  SiteTree: z.object({
    totalPages: z.number(),
    maxDepth: z.number(),
    sources: z
      .object({
        sitemap: z.number().optional(),
        linkDiscovery: z.number().optional(),
      })
      .optional(),
    sections: z
      .array(
        z.object({
          path: z.string(),
          count: z.number(),
          children: z
            .array(
              z.object({
                path: z.string(),
                count: z.number(),
              })
            )
            .optional(),
        })
      )
      .optional(),
  }),

  // ========================================
  // Company Components
  // ========================================

  CompanyCard: z.object({
    name: z.string(),
    industry: z.string().optional(),
    size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
    location: z.string().optional(),
    employeeCount: z.string().optional(),
    revenue: z.string().optional(),
  }),

  ContactInfo: z.object({
    name: z.string(),
    title: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),

  DecisionMakersList: z.object({
    title: z.string().optional(),
    contacts: z.array(
      z.object({
        name: z.string(),
        role: z.string(),
        email: z.string().optional(),
        emailConfidence: z.enum(['confirmed', 'likely', 'derived', 'unknown']).optional(),
        phone: z.string().optional(),
        linkedInUrl: z.string().optional(),
        source: z.string().optional(),
      })
    ),
    researchQuality: z
      .object({
        linkedInFound: z.number().optional(),
        emailsConfirmed: z.number().optional(),
        emailsDerived: z.number().optional(),
      })
      .optional(),
  }),

  NewsItem: z.object({
    title: z.string(),
    source: z.string().optional(),
    date: z.string().optional(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    summary: z.string().optional(),
  }),

  NewsList: z.object({
    title: z.string().optional(),
    items: z.array(
      z.object({
        title: z.string(),
        source: z.string().optional(),
        date: z.string().optional(),
        sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
        summary: z.string().optional(),
      })
    ),
  }),

  // ========================================
  // Media Components
  // ========================================

  Screenshots: z.object({
    desktop: z.string().optional(),
    mobile: z.string().optional(),
    timestamp: z.string().optional(),
  }),

  // ========================================
  // Migration Components
  // ========================================

  MigrationComplexity: z.object({
    score: z.number(),
    recommendation: z.enum(['easy', 'moderate', 'complex', 'very_complex']).optional(),
    factors: z
      .array(
        z.object({
          name: z.string(),
          score: z.number(),
          notes: z.string().optional(),
        })
      )
      .optional(),
    estimatedEffort: z
      .object({
        minPT: z.number(),
        maxPT: z.number(),
        confidence: z.number(),
      })
      .optional(),
  }),

  // ========================================
  // Questions Components
  // ========================================

  QuestionChecklist: z.object({
    title: z.string().optional(),
    projectType: z.enum(['migration', 'greenfield', 'relaunch']).optional(),
    questions: z.array(
      z.object({
        id: z.number(),
        question: z.string(),
        answered: z.boolean(),
        answer: z.string().optional(),
      })
    ),
    summary: z
      .object({
        answered: z.number(),
        total: z.number(),
      })
      .optional(),
  }),
};

// Component descriptions for AI
export const quickScanComponentDescriptions = {
  // Layout
  ResultCard:
    'Container card for grouping related information with optional icon, styling, and collapsible behavior',
  Grid: 'Layout container for arranging children in columns',
  Section: 'Section header with title, description, and optional badge',
  // Metrics
  Metric: 'Single metric display with label, value, and optional trend indicator',
  ScoreCard: 'Score display with progress bar visualization (0-100)',
  ProgressBar: 'Horizontal progress bar with label and value',
  // Tech
  TechBadge: 'Badge showing a detected technology with version and confidence',
  TechStack: 'List of technologies grouped by category',
  FeatureList: 'Checklist showing detected vs not detected features',
  // Business
  Recommendation: 'Primary business line recommendation with confidence and reasoning',
  AlternativesList: 'List of alternative business line recommendations',
  SkillsList: 'List of required skills/competencies',
  // Audits
  AccessibilityAudit: 'Accessibility audit results with score, WCAG level, and issue counts',
  SEOAudit: 'SEO audit results with score and check list',
  LegalCompliance: 'Legal/DSGVO compliance score with check list',
  PerformanceCard: 'Performance metrics including load time and resource counts',
  // Content
  ContentStats: 'Content volume statistics including page count, complexity, languages, media',
  ContentTypeDistribution: 'Content type breakdown with percentages and recommendations',
  NavigationStats: 'Navigation structure metrics with item counts and features',
  SiteTree: 'Hierarchical site structure visualization',
  // Company
  CompanyCard: 'Company information card with name, industry, size, location',
  ContactInfo: 'Contact person information with name, title, email, phone',
  DecisionMakersList: 'List of decision makers with contact details and research quality',
  NewsItem: 'Single news article with title, source, date, sentiment',
  NewsList: 'List of news items with sentiment indicators',
  // Media
  Screenshots: 'Desktop and mobile screenshot display',
  // Migration
  MigrationComplexity: 'Migration complexity analysis with factors and effort estimate',
  // Questions
  QuestionChecklist:
    '10 Questions checklist with progress and answered/unanswered status per question',
};

// System prompt for AI
export const QUICK_SCAN_VISUALIZATION_SYSTEM_PROMPT = `You are a visualization expert that creates UI layouts for Quick Scan results.
You output JSONL patches to build a UI tree from predefined components.

AVAILABLE COMPONENTS:
${Object.keys(quickScanComponentDescriptions).join(', ')}

COMPONENT CATEGORIES & DETAILS:

**LAYOUT:**
- ResultCard: { title, description?, variant?: "default"|"highlight"|"warning"|"success"|"info", icon?: "tech"|"content"|"features"|"recommendation"|"accessibility"|"seo"|"legal"|"performance"|"navigation"|"company"|"migration"|"screenshots", collapsible?, defaultOpen? } - Container card (HAS CHILDREN)
- Grid: { columns?: number, gap?: "sm"|"md"|"lg" } - Layout grid (HAS CHILDREN)
- Section: { title, description?, badge?, badgeVariant? } - Section header

**METRICS:**
- Metric: { label, value, subValue?, trend?: "up"|"down"|"neutral" } - Single metric
- ScoreCard: { label, score: number, maxScore?, variant?: "default"|"success"|"warning"|"danger", showProgress? } - Score with progress
- ProgressBar: { label, value: number, max?, showValue?, variant? } - Progress bar

**TECH:**
- TechBadge: { name, version?, confidence?, category?: "cms"|"framework"|"backend"|"hosting"|"library"|"tool"|"analytics"|"cdn" }
- TechStack: { title?, technologies: [{name, version?, confidence?, category?}] } - Technology list
- FeatureList: { title?, features: [{name, detected: boolean, details?}] } - Feature checklist

**BUSINESS:**
- Recommendation: { businessUnit, confidence: number, reasoning } - BL recommendation
- AlternativesList: { title?, alternatives: [{name, confidence, reason}] } - Alternative BLs
- SkillsList: { title?, skills: [string] } - Required skills

**AUDITS:**
- AccessibilityAudit: { score, level?: "A"|"AA"|"AAA"|"fail", issues: {critical, serious, moderate, minor}, checks?: [{name, passed}] }
- SEOAudit: { score?, checks: [{name, passed}] }
- LegalCompliance: { score, checks: [{name, passed}], cookieTool? }
- PerformanceCard: { loadTime?: "fast"|"medium"|"slow", resources?: {scripts?, stylesheets?, images?, fonts?}, optimizations?: [{name, enabled}] }

**CONTENT:**
- ContentStats: { pageCount?, complexity?, languages?, contentTypes?, media?: {images?, videos?, documents?} }
- ContentTypeDistribution: { title?, types: [{type, count, percentage}], recommendations? }
- NavigationStats: { totalItems, maxDepth, features?: {search?, breadcrumbs?, megaMenu?}, mainNavItems? }
- SiteTree: { totalPages, maxDepth, sources?: {sitemap?, linkDiscovery?}, sections?: [{path, count, children?}] }

**COMPANY:**
- CompanyCard: { name, industry?, size?, location?, employeeCount?, revenue? }
- ContactInfo: { name, title?, email?, phone? }
- DecisionMakersList: { title?, contacts: [{name, role, email?, emailConfidence?, phone?, linkedInUrl?, source?}], researchQuality? }
- NewsList: { title?, items: [{title, source?, date?, sentiment?, summary?}] }

**MEDIA:**
- Screenshots: { desktop?, mobile?, timestamp? }

**MIGRATION:**
- MigrationComplexity: { score, recommendation?, factors?: [{name, score, notes?}], estimatedEffort?: {minPT, maxPT, confidence} }

**QUESTIONS:**
- QuestionChecklist: { title?, projectType?: "migration"|"greenfield"|"relaunch", questions: [{id, question, answered, answer?}], summary?: {answered, total} }

OUTPUT FORMAT (JSONL):
{"op":"set","path":"/root","value":"main-grid"}
{"op":"add","path":"/elements/main-grid","value":{"key":"main-grid","type":"Grid","props":{"columns":1,"gap":"md"},"children":["card-1"]}}

RULES:
1. First set /root to the root element's key
2. Add each element with /elements/{key}
3. Only ResultCard, Grid, Section can have children
4. Use meaningful keys (e.g., "tech-section", "accessibility-audit")

BEST PRACTICES:
- Use Grid as root for responsive layouts
- Group related data in ResultCards
- Show most important info first (BL Recommendation)
- Use ScoreCard for audit scores
- Use FeatureList for boolean checks
- Use ContentTypeDistribution for data breakdowns`;

export type QuickScanCatalogComponents = keyof typeof quickScanCatalogSchema;
