/**
 * Content Architecture Agent
 *
 * Analyzes website content architecture:
 * - Page count estimation
 * - Content types identification
 * - Navigation structure analysis
 * - Site tree generation
 * - Content volume analysis
 */

import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { AI_TIMEOUTS } from '../ai/config';
import { openai } from '../ai/providers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContentType {
  name: string; // e.g. "News Article", "Product Page", "Landing Page"
  pattern: string; // URL pattern (e.g. "/news/", "/products/")
  estimatedCount: number;
  characteristics: string[]; // e.g. ["Has publish date", "Has author"]
  // adesso Calculator 2.01 fields (DEA-140)
  drupalContentType?: string; // Mapped Drupal content type (e.g., "article", "page", "event")
  migrationComplexity: 'H' | 'M' | 'L'; // Migration complexity rating
  estimatedHours: number; // Content type setup + migration hours
  requiredParagraphs?: string[]; // Suggested adesso Paragraphs
  hasFields?: string[]; // Detected Drupal-like fields (body, image, date, taxonomy)
}

export interface NavigationStructure {
  depth: number; // Max depth of navigation
  breadth: number; // Avg number of items per level
  mainNavItems: string[]; // Top-level nav items
}

export interface SiteTreeNode {
  url: string;
  title: string;
  level: number;
  children?: SiteTreeNode[];
}

export interface ContentVolume {
  images: number;
  videos: number;
  documents: number; // PDFs, etc.
  totalAssets: number;
}

export interface ContentArchitectureResult {
  success: boolean;

  // Page Count
  pageCount: number;
  pageCountConfidence: 'low' | 'medium' | 'high';
  pageCountMethod: string; // How it was estimated

  // Content Types
  contentTypes: ContentType[];

  // Navigation
  navigationStructure: NavigationStructure;

  // Site Tree
  siteTree: SiteTreeNode[];

  // Content Volume
  contentVolume: ContentVolume;

  // adesso Calculator 2.01 Summary (DEA-140)
  calculatorSummary: {
    totalContentTypes: number;
    totalEstimatedHours: number;
    complexityDistribution: { H: number; M: number; L: number };
    recommendedDrupalModules: string[];
    migrationRiskLevel: 'low' | 'medium' | 'high';
    migrationRiskFactors: string[];
  };

  // Metadata
  analyzedAt: string;
  error?: string;
}

export interface AnalyzeContentArchitectureInput {
  websiteUrl: string;
  crawlData: {
    homepage?: {
      url: string;
      title: string;
      description: string;
    };
    samplePages?: string[];
    crawledAt: string;
  };
  rawHTML?: string; // Homepage HTML for analysis
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze content architecture from crawl data
 *
 * Uses AI to identify patterns and estimate content volume.
 *
 * @param input - Crawl data from Full-Scan Agent
 * @returns Content architecture analysis
 */
export async function analyzeContentArchitecture(
  input: AnalyzeContentArchitectureInput
): Promise<ContentArchitectureResult> {
  console.error(`[Content Architecture Agent] Starting analysis for ${input.websiteUrl}`);

  try {
    // Validate input
    if (
      !input.crawlData ||
      !input.crawlData.samplePages ||
      input.crawlData.samplePages.length === 0
    ) {
      return {
        success: false,
        pageCount: 0,
        pageCountConfidence: 'low',
        pageCountMethod: 'No crawl data available',
        contentTypes: [],
        navigationStructure: {
          depth: 0,
          breadth: 0,
          mainNavItems: [],
        },
        siteTree: [],
        contentVolume: {
          images: 0,
          videos: 0,
          documents: 0,
          totalAssets: 0,
        },
        calculatorSummary: {
          totalContentTypes: 0,
          totalEstimatedHours: 0,
          complexityDistribution: { H: 0, M: 0, L: 0 },
          recommendedDrupalModules: [],
          migrationRiskLevel: 'low',
          migrationRiskFactors: ['No crawl data - cannot assess migration'],
        },
        analyzedAt: new Date().toISOString(),
        error: 'Missing or incomplete crawl data',
      };
    }

    const { websiteUrl, crawlData } = input;
    const samplePages = crawlData.samplePages || [];

    // Zod schema for AI analysis with adesso Calculator fields
    const ContentArchitectureAnalysisSchema = z.object({
      pageCountEstimate: z.number().describe('Estimated total number of pages on the website'),
      pageCountConfidence: z
        .enum(['low', 'medium', 'high'])
        .describe('Confidence level in page count estimate'),
      contentTypes: z.array(
        z.object({
          name: z.string(),
          pattern: z.string(),
          estimatedCount: z.number(),
          characteristics: z.array(z.string()),
          // adesso Calculator 2.01 fields
          drupalContentType: z.string().optional().describe('Mapped Drupal content type'),
          migrationComplexity: z.enum(['H', 'M', 'L']).describe('Migration complexity'),
          estimatedHours: z.number().describe('Hours for content type setup + migration'),
          requiredParagraphs: z.array(z.string()).optional().describe('Suggested paragraphs'),
          hasFields: z.array(z.string()).optional().describe('Detected fields'),
        })
      ),
      navigationDepth: z.number().describe('Maximum depth of navigation hierarchy'),
      navigationBreadth: z.number().describe('Average number of navigation items per level'),
      mainNavItems: z.array(z.string()).describe('Top-level navigation items'),
      imageCount: z.number(),
      videoCount: z.number(),
      documentCount: z.number(),
      // adesso Calculator summary
      recommendedDrupalModules: z.array(z.string()).describe('Recommended Drupal contrib modules'),
      migrationRiskLevel: z.enum(['low', 'medium', 'high']).describe('Overall migration risk'),
      migrationRiskFactors: z.array(z.string()).describe('Specific risk factors'),
    });

    // Use AI to analyze patterns in sample pages with adesso/Drupal expertise
    const { object: analysis } = await generateObject({
      model: openai('gemini-3-flash-preview') as unknown as LanguageModel,
      schema: ContentArchitectureAnalysisSchema,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(AI_TIMEOUTS.AGENT_COMPLEX),
      prompt: `You are a senior Drupal architect at adesso SE, analyzing a website for migration to Drupal.

## Context
adesso SE is a leading German IT consultancy specializing in Drupal CMS implementations.
You are preparing a content architecture analysis for the adesso Calculator 2.01 project estimation tool.

## Website to Analyze
Website: ${websiteUrl}
Homepage: ${crawlData.homepage?.title || 'Unknown'}

Sample Pages (${samplePages.length} crawled):
${samplePages.map((url, i) => `${i + 1}. ${url}`).join('\n')}

## Analysis Tasks

### 1. Page Count Estimation
- Consider URL patterns (/page/1, /page/2, etc.)
- Consider pagination indicators
- Consider site structure (blog, products, services, etc.)

### 2. Content Types → Drupal Mapping
For each distinct content type:
- **name**: Descriptive name (e.g., "News Article", "Product Page")
- **pattern**: URL pattern (e.g., "/news/", "/products/")
- **drupalContentType**: Map to standard Drupal types:
  - article (news, blog posts with author/date)
  - page (static pages)
  - event (date-based content)
  - product (e-commerce items)
  - landing_page (marketing pages with paragraphs)
  - person (team members, staff profiles)
  - location (offices, stores with address)
  - faq (question/answer pairs)
  - download (file downloads, resources)
  - webform (contact, application forms)
- **migrationComplexity**:
  - H (High): 16-24h - Complex fields, custom logic, integrations
  - M (Medium): 8-16h - Standard fields with customization
  - L (Low): 4-8h - Simple content, text-only
- **estimatedHours**: Setup + migration hours
- **requiredParagraphs**: Suggested adesso Paragraphs (paragraph_hero, paragraph_teaser_grid, etc.)
- **hasFields**: Detected fields (body, image, date, taxonomy, author, location, price)

### 3. Navigation Structure
- Depth: Max navigation hierarchy depth
- Breadth: Average items per level
- Main navigation items

### 4. Content Volume
- Images, videos, documents (PDFs)

### 5. Migration Risk Assessment
- **recommendedDrupalModules**: Contrib modules needed (paragraphs, media, metatag, pathauto, etc.)
- **migrationRiskLevel**: Overall risk (low/medium/high)
- **migrationRiskFactors**: Specific concerns (e.g., "Custom search integration", "Multi-language content", "Complex taxonomy")

## adesso Calculator Estimation Guidelines
- Simple content type (L): 4-8h (basic fields, no integrations)
- Standard content type (M): 8-16h (standard fields, basic views)
- Complex content type (H): 16-24h (custom fields, integrations, complex display)
- Add 50% for multi-language
- Add 2-4h per external integration

Provide realistic estimates based on the sample. Be conservative if uncertain.`,
    });

    console.error('[Content Architecture Agent] AI analysis completed', {
      pageCount: analysis.pageCountEstimate,
      contentTypes: analysis.contentTypes.length,
    });

    // Generate site tree from sample pages
    const siteTree = generateSiteTree(samplePages, crawlData.homepage?.title);

    return {
      success: true,
      pageCount: analysis.pageCountEstimate,
      pageCountConfidence: analysis.pageCountConfidence,
      pageCountMethod: `AI-based estimation from ${samplePages.length} sample pages`,
      contentTypes: analysis.contentTypes,
      navigationStructure: {
        depth: analysis.navigationDepth,
        breadth: analysis.navigationBreadth,
        mainNavItems: analysis.mainNavItems,
      },
      siteTree,
      contentVolume: {
        images: analysis.imageCount,
        videos: analysis.videoCount,
        documents: analysis.documentCount,
        totalAssets: analysis.imageCount + analysis.videoCount + analysis.documentCount,
      },
      // adesso Calculator 2.01 Summary (DEA-140)
      calculatorSummary: {
        totalContentTypes: analysis.contentTypes.length,
        totalEstimatedHours: analysis.contentTypes.reduce((sum, ct) => sum + ct.estimatedHours, 0),
        complexityDistribution: {
          H: analysis.contentTypes.filter(ct => ct.migrationComplexity === 'H').length,
          M: analysis.contentTypes.filter(ct => ct.migrationComplexity === 'M').length,
          L: analysis.contentTypes.filter(ct => ct.migrationComplexity === 'L').length,
        },
        recommendedDrupalModules: analysis.recommendedDrupalModules,
        migrationRiskLevel: analysis.migrationRiskLevel,
        migrationRiskFactors: analysis.migrationRiskFactors,
      },
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Content Architecture Agent] Error:', error);

    return {
      success: false,
      pageCount: 0,
      pageCountConfidence: 'low',
      pageCountMethod: 'Analysis failed',
      contentTypes: [],
      navigationStructure: {
        depth: 0,
        breadth: 0,
        mainNavItems: [],
      },
      siteTree: [],
      contentVolume: {
        images: 0,
        videos: 0,
        documents: 0,
        totalAssets: 0,
      },
      calculatorSummary: {
        totalContentTypes: 0,
        totalEstimatedHours: 0,
        complexityDistribution: { H: 0, M: 0, L: 0 },
        recommendedDrupalModules: [],
        migrationRiskLevel: 'low',
        migrationRiskFactors: ['Analysis failed - no data available'],
      },
      analyzedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate hierarchical site tree from sample pages
 *
 * Creates a tree structure based on URL paths.
 */
function generateSiteTree(samplePages: string[], homepageTitle?: string): SiteTreeNode[] {
  const tree: SiteTreeNode[] = [];

  // Add homepage as root
  if (homepageTitle) {
    tree.push({
      url: '/',
      title: homepageTitle,
      level: 0,
      children: [],
    });
  }

  // Group pages by path depth
  const pagesByDepth: Map<number, SiteTreeNode[]> = new Map();

  for (const pageUrl of samplePages) {
    try {
      const url = new URL(pageUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const depth = pathParts.length;

      const node: SiteTreeNode = {
        url: url.pathname,
        title: pathParts[pathParts.length - 1] || 'Home',
        level: depth,
      };

      if (!pagesByDepth.has(depth)) {
        pagesByDepth.set(depth, []);
      }
      pagesByDepth.get(depth)!.push(node);
    } catch {
      // Invalid URL, skip
      continue;
    }
  }

  // Add depth-1 pages as children of homepage
  const depth1Pages = pagesByDepth.get(1) || [];
  if (tree.length > 0 && depth1Pages.length > 0) {
    tree[0].children = depth1Pages.slice(0, 10); // Max 10 children for readability
  } else {
    // No homepage, add depth-1 pages as roots
    tree.push(...depth1Pages.slice(0, 10));
  }

  return tree;
}
