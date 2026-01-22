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

import { openai } from '../ai/providers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContentType {
  name: string; // e.g. "News Article", "Product Page", "Landing Page"
  pattern: string; // URL pattern (e.g. "/news/", "/products/")
  estimatedCount: number;
  characteristics: string[]; // e.g. ["Has publish date", "Has author"]
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
        analyzedAt: new Date().toISOString(),
        error: 'Missing or incomplete crawl data',
      };
    }

    const { websiteUrl, crawlData } = input;
    const samplePages = crawlData.samplePages || [];

    // Zod schema for AI analysis
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
        })
      ),
      navigationDepth: z.number().describe('Maximum depth of navigation hierarchy'),
      navigationBreadth: z.number().describe('Average number of navigation items per level'),
      mainNavItems: z.array(z.string()).describe('Top-level navigation items'),
      imageCount: z.number(),
      videoCount: z.number(),
      documentCount: z.number(),
    });

    // Use AI to analyze patterns in sample pages
    const { object: analysis } = await generateObject({
      model: openai('claude-haiku-4.5') as unknown as LanguageModel,
      schema: ContentArchitectureAnalysisSchema,
      prompt: `Analyze the following website structure and provide content architecture insights.

Website: ${websiteUrl}
Homepage: ${crawlData.homepage?.title || 'Unknown'}

Sample Pages (${samplePages.length} crawled):
${samplePages.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Based on the sample pages, estimate:

1. **Page Count**: How many total pages does this website likely have?
   - Consider URL patterns (/page/1, /page/2, etc.)
   - Consider pagination indicators
   - Consider site structure (blog, products, services, etc.)

2. **Content Types**: What types of pages exist?
   - Identify distinct page types (News, Blog, Product, Landing, etc.)
   - Estimate how many pages of each type
   - Identify URL patterns for each type

3. **Navigation Structure**:
   - How deep is the navigation hierarchy? (e.g., Home > Category > Subcategory = depth 3)
   - How many items per navigation level on average?
   - What are the main top-level navigation items?

4. **Content Volume**:
   - Estimate total number of images (based on typical pages)
   - Estimate total number of videos
   - Estimate total number of documents (PDFs, downloads)

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
