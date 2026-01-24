/**
 * Component Library Agent (DEA-147)
 *
 * Crawls customer website, captures screenshots, and analyzes UI components.
 * Uses agent-browser CLI for screenshot capture and GPT-4 Vision for component detection.
 *
 * Features:
 * - Website crawling with configurable max depth
 * - Screenshot capture of representative pages
 * - Vision-based component detection
 * - Structured component data (name, screenshot, props, usage context)
 * - Results stored in RAG for semantic retrieval
 */

import { getOpenAIDirectClient } from '@/lib/ai/config';
import { openPage, closeBrowser, screenshot, evaluate, createSession, wait } from '@/lib/browser';
import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Component {
  name: string;
  description: string;
  screenshotBase64?: string; // Base64-encoded screenshot
  estimatedProps?: Record<string, string>; // Property name → type
  usageContext: string;
  pageUrl: string;
  // adesso Calculator 2.01 fields (DEA-140)
  category:
    | 'hero'
    | 'card'
    | 'form'
    | 'navigation'
    | 'media'
    | 'layout'
    | 'content'
    | 'interactive'
    | 'other';
  complexity: 'H' | 'M' | 'L'; // High, Medium, Low
  estimatedHours: number; // Development hours estimate
  adessoMapping?: string; // Suggested adesso Paragraph (e.g., "paragraph_hero", "paragraph_card_grid")
}

export interface ComponentLibraryResult {
  success: boolean;
  components: Component[];
  pagesAnalyzed: number;
  totalComponents: number;
  confidence: number; // 0-100
  error?: string;
  sources: string[]; // URLs of analyzed pages
}

export interface AnalyzeComponentsInput {
  leadId: string;
  rfpId: string;
  websiteUrl: string;
  maxDepth?: number; // Default: 2
  maxPages?: number; // Default: 10
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze website components using Playwright + Vision AI
 *
 * Flow:
 * 1. Crawl website up to maxDepth
 * 2. Capture screenshots of representative pages
 * 3. Use GPT-4 Vision to detect components
 * 4. Extract component metadata (name, props, usage)
 * 5. Store results in RAG with agentName: 'component_library'
 *
 * @param input - Lead ID, RFP ID, and website URL
 * @returns Component library analysis results
 */
export async function analyzeComponents(
  input: AnalyzeComponentsInput
): Promise<ComponentLibraryResult> {
  const { rfpId, websiteUrl, maxDepth = 2, maxPages = 10 } = input;

  console.error(`[Component Library Agent] Starting analysis for ${websiteUrl}`);
  console.error(`[Component Library Agent] Max depth: ${maxDepth}, Max pages: ${maxPages}`);

  try {
    // 1. Crawl website
    const urls = await crawlWebsite(websiteUrl, maxDepth, maxPages);

    if (urls.length === 0) {
      const errorResult: ComponentLibraryResult = {
        success: false,
        components: [],
        pagesAnalyzed: 0,
        totalComponents: 0,
        confidence: 0,
        error: 'No pages found during crawl',
        sources: [],
      };
      await storeInRAG(rfpId, errorResult);
      return errorResult;
    }

    console.error(`[Component Library Agent] Crawled ${urls.length} pages`);

    // 2. Capture screenshots and analyze components
    const allComponents: Component[] = [];
    const session = createSession(`component-lib-${rfpId}`);

    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.error(`[Component Library Agent] Analyzing page ${i + 1}/${urls.length}: ${url}`);

        try {
          // Navigate to page
          await openPage(url, session);

          // Wait for any client-side rendering
          await wait(2000);

          // Capture screenshot (returns base64 string)
          const screenshotResult = await screenshot(session);

          // Ensure we have a valid base64 string
          const screenshotBase64 = typeof screenshotResult === 'string' ? screenshotResult : null;

          if (screenshotBase64 && screenshotBase64.length > 100) {
            // Analyze with Vision AI
            const components = await detectComponents(url, screenshotBase64);
            allComponents.push(...components);
          }
        } catch (error) {
          console.warn(`[Component Library Agent] Failed to analyze page ${url}:`, error);
          // Continue with next page
        }
      }
    } finally {
      await closeBrowser(session);
    }

    console.error(
      `[Component Library Agent] Detected ${allComponents.length} components across ${urls.length} pages`
    );

    // 3. Calculate confidence based on coverage
    const confidence = Math.min(100, (allComponents.length / urls.length) * 20);

    const result: ComponentLibraryResult = {
      success: true,
      components: allComponents,
      pagesAnalyzed: urls.length,
      totalComponents: allComponents.length,
      confidence,
      sources: urls,
    };

    // 4. Store in RAG
    await storeInRAG(rfpId, result);

    return result;
  } catch (error) {
    console.error('[Component Library Agent] Error:', error);

    const errorResult: ComponentLibraryResult = {
      success: false,
      components: [],
      pagesAnalyzed: 0,
      totalComponents: 0,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      sources: [],
    };

    await storeInRAG(rfpId, errorResult);
    return errorResult;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crawl website to discover pages
 *
 * Simple breadth-first crawl that:
 * - Stays on same domain
 * - Respects maxDepth
 * - Returns up to maxPages URLs
 */
async function crawlWebsite(
  baseUrl: string,
  maxDepth: number,
  maxPages: number
): Promise<string[]> {
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: baseUrl, depth: 0 }];
  const discovered: string[] = [];

  const session = createSession('component-crawl');

  try {
    while (queue.length > 0 && discovered.length < maxPages) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url) || depth > maxDepth) {
        continue;
      }

      visited.add(url);
      discovered.push(url);

      // Don't crawl deeper if at max depth
      if (depth >= maxDepth) {
        continue;
      }

      try {
        await openPage(url, session);
        await wait(1500);

        // Extract links via evaluate
        const baseDomain = new URL(baseUrl).hostname;
        const links = await evaluate<string[]>(
          `
          const baseDomain = "${baseDomain}";
          const baseUrl = "${baseUrl}";
          const links = [];
          document.querySelectorAll('a[href]').forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (!href) return;
            try {
              const absoluteUrl = new URL(href, baseUrl).href;
              const linkDomain = new URL(absoluteUrl).hostname;
              if (linkDomain === baseDomain) {
                links.push(absoluteUrl);
              }
            } catch {}
          });
          return [...new Set(links)];
        `,
          session
        );

        // Add links to queue
        if (links) {
          for (const link of links) {
            if (!visited.has(link) && discovered.length < maxPages) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        console.warn(`[Component Library Agent] Failed to crawl ${url}:`, error);
        // Continue with next URL
      }
    }
  } finally {
    await closeBrowser(session);
  }

  return discovered;
}

interface VisionResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Detect UI components using GPT-4 Vision
 *
 * Analyzes screenshot and returns structured component data.
 */
async function detectComponents(url: string, screenshotBase64: string): Promise<Component[]> {
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    const openaiClient: any = getOpenAIDirectClient();
    const response = (await openaiClient.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: `You are a senior UI/UX analyst at adesso SE, a leading German IT consultancy specializing in Drupal CMS implementations.

Your task is to analyze website screenshots and identify reusable UI components for the adesso Calculator 2.01 project estimation tool.

## adesso Drupal Paragraph Library
Map detected components to these standard adesso Paragraphs when applicable:
- paragraph_hero: Full-width hero sections with background image/video, headline, CTA
- paragraph_teaser_grid: Grid of teaser cards (2-4 columns)
- paragraph_card_slider: Horizontal scrolling card carousel
- paragraph_accordion: Expandable FAQ/content sections
- paragraph_tabs: Tabbed content navigation
- paragraph_media_gallery: Image/video gallery with lightbox
- paragraph_form: Contact forms, newsletter signup, search
- paragraph_cta_banner: Call-to-action banners
- paragraph_quote: Testimonials, blockquotes
- paragraph_timeline: Event timelines, process steps
- paragraph_map: Google Maps, OpenStreetMap embeds
- paragraph_download: File download lists
- paragraph_table: Data tables, comparison tables
- paragraph_video: Video embeds (YouTube, Vimeo, self-hosted)
- paragraph_text: Rich text content blocks
- paragraph_two_column: Two-column layouts
- paragraph_icon_grid: Icon + text grid layouts

## Component Categories
Categorize each component as:
- hero: Full-width hero sections
- card: Card-based layouts (teasers, products, features)
- form: Input forms, search, filters
- navigation: Menus, breadcrumbs, pagination
- media: Images, videos, galleries
- layout: Structural components (grids, columns)
- content: Text-heavy components (articles, FAQs)
- interactive: Sliders, accordions, modals
- other: Uncategorized

## Complexity Rating (for adesso Calculator)
Rate each component's implementation complexity:
- H (High): 16-24 hours - Complex interactions, animations, integrations
- M (Medium): 8-16 hours - Standard patterns with customization
- L (Low): 2-8 hours - Simple, well-documented patterns

## Output Format
Return a JSON array where each component has:
{
  "name": "Component Name",
  "description": "What it does",
  "category": "hero|card|form|navigation|media|layout|content|interactive|other",
  "complexity": "H|M|L",
  "estimatedHours": number,
  "estimatedProps": {"prop": "type"},
  "usageContext": "Where/how used",
  "adessoMapping": "paragraph_xxx or null if custom"
}

Only include components that appear to be reusable patterns. Be specific about complexity based on visual complexity, animation, and interaction requirements.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this screenshot from ${url} and identify UI components:`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })) as VisionResponse;
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    const content: string | undefined = response.choices[0]?.message?.content;

    if (!content) {
      return [];
    }

    // Parse JSON response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedContent) as Array<{
      name: string;
      description: string;
      estimatedProps?: Record<string, string>;
      usageContext: string;
      // adesso Calculator 2.01 fields (DEA-140)
      category?: Component['category'];
      complexity?: Component['complexity'];
      estimatedHours?: number;
      adessoMapping?: string;
    }>;

    return parsed.map(comp => ({
      name: comp.name,
      description: comp.description,
      estimatedProps: comp.estimatedProps,
      usageContext: comp.usageContext,
      pageUrl: url,
      screenshotBase64, // Include screenshot for gallery view
      // adesso Calculator 2.01 fields with defaults
      category: comp.category ?? 'other',
      complexity: comp.complexity ?? 'M',
      estimatedHours: comp.estimatedHours ?? 8,
      adessoMapping: comp.adessoMapping,
    }));
  } catch (error) {
    console.error('[Component Library Agent] Vision analysis failed:', error);
    return [];
  }
}

/**
 * Store component library results in RAG
 *
 * Stores:
 * 1. Component metadata as structured JSON
 * 2. Embeddings for semantic retrieval
 */
async function storeInRAG(rfpId: string, result: ComponentLibraryResult): Promise<void> {
  try {
    // Build searchable content with adesso Calculator fields
    const componentSummaries = result.components
      .map(
        (comp, idx) =>
          `Component ${idx + 1}: ${comp.name}
Category: ${comp.category}
Complexity: ${comp.complexity} (${comp.estimatedHours}h)
adesso Paragraph: ${comp.adessoMapping ?? 'custom'}
Description: ${comp.description}
Usage: ${comp.usageContext}
Page: ${comp.pageUrl}`
      )
      .join('\n\n');

    // Calculate totals for adesso Calculator
    const totalHours = result.components.reduce((sum, c) => sum + c.estimatedHours, 0);
    const complexityCounts = {
      H: result.components.filter(c => c.complexity === 'H').length,
      M: result.components.filter(c => c.complexity === 'M').length,
      L: result.components.filter(c => c.complexity === 'L').length,
    };
    const categoryCounts = result.components.reduce(
      (acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const chunkText = `Component Library Analysis (adesso Calculator 2.01)

## Summary
Total Components: ${result.totalComponents}
Pages Analyzed: ${result.pagesAnalyzed}
Confidence: ${result.confidence}%
Total Estimated Hours: ${totalHours}h

## Complexity Distribution
- High (H): ${complexityCounts.H} components
- Medium (M): ${complexityCounts.M} components
- Low (L): ${complexityCounts.L} components

## Category Distribution
${Object.entries(categoryCounts)
  .map(([cat, count]) => `- ${cat}: ${count}`)
  .join('\n')}

## Components Detail
${componentSummaries}

## Sources
${result.sources.join(', ')}`;

    // Generate embedding
    const chunks = [
      {
        chunkIndex: 0,
        content: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
        metadata: {
          startPosition: 0,
          endPosition: chunkText.length,
          type: 'section' as const,
        },
      },
    ];

    const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

    if (chunksWithEmbeddings && chunksWithEmbeddings.length > 0) {
      await db.insert(dealEmbeddings).values({
        rfpId,
        agentName: 'component_library',
        chunkType: 'analysis',
        chunkIndex: 0,
        content: chunkText,
        embedding: JSON.stringify(chunksWithEmbeddings[0].embedding),
        metadata: JSON.stringify({
          totalComponents: result.totalComponents,
          pagesAnalyzed: result.pagesAnalyzed,
          confidence: result.confidence,
          sources: result.sources,
          // adesso Calculator 2.01 aggregates (DEA-140)
          totalEstimatedHours: totalHours,
          complexityDistribution: complexityCounts,
          categoryDistribution: categoryCounts,
          // Component-level details for Calc-Sheet
          componentDetails: result.components.map(c => ({
            name: c.name,
            category: c.category,
            complexity: c.complexity,
            estimatedHours: c.estimatedHours,
            adessoMapping: c.adessoMapping,
          })),
          // Note: Screenshots are NOT stored in RAG (too large)
          // They can be regenerated on-demand or stored separately
        }),
      });

      console.error('[Component Library Agent] Stored results in RAG');
    }
  } catch (error) {
    console.error('[Component Library Agent] Failed to store in RAG:', error);
    // Don't throw - analysis still succeeded
  }
}
