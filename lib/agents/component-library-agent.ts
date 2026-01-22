/**
 * Component Library Agent (DEA-147)
 *
 * Crawls customer website, captures screenshots, and analyzes UI components.
 * Uses Playwright for screenshot capture and GPT-4 Vision for component detection.
 *
 * Features:
 * - Website crawling with configurable max depth
 * - Screenshot capture of representative pages
 * - Vision-based component detection
 * - Structured component data (name, screenshot, props, usage context)
 * - Results stored in RAG for semantic retrieval
 */

import { chromium } from 'playwright';

import { getOpenAIDirectClient } from '@/lib/ai/config';
import { db } from '@/lib/db';
import { rfpEmbeddings } from '@/lib/db/schema';
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

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Dealhunter-Component-Library/1.0',
      viewport: { width: 1920, height: 1080 },
    });

    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.error(`[Component Library Agent] Analyzing page ${i + 1}/${urls.length}: ${url}`);

        try {
          const page = await context.newPage();

          // Navigate with timeout
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000,
          });

          // Wait for any client-side rendering
          await page.waitForTimeout(2000);

          // Capture screenshot
          const screenshotBuffer = await page.screenshot({
            fullPage: false, // Viewport only for performance
            type: 'png',
          });

          const screenshotBase64 = screenshotBuffer.toString('base64');

          // Analyze with Vision AI
          const components = await detectComponents(url, screenshotBase64);

          allComponents.push(...components);

          await page.close();
        } catch (error) {
          console.warn(`[Component Library Agent] Failed to analyze page ${url}:`, error);
          // Continue with next page
        }
      }
    } finally {
      await browser.close();
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

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
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

        // Extract links
        const links = await page.$$eval(
          'a[href]',
          (anchors, baseUrlArg) => {
            const baseDomain = new URL(baseUrlArg).hostname;
            return anchors
              .map(a => {
                const href = a.getAttribute('href');
                if (!href) return null;

                try {
                  const absoluteUrl = new URL(href, baseUrlArg).href;
                  const linkDomain = new URL(absoluteUrl).hostname;

                  // Only include same-domain links
                  if (linkDomain === baseDomain) {
                    return absoluteUrl;
                  }
                } catch {
                  return null;
                }

                return null;
              })
              .filter((link): link is string => link !== null);
          },
          baseUrl
        );

        // Add links to queue
        for (const link of links) {
          if (!visited.has(link) && discovered.length < maxPages) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }

        await page.close();
      } catch (error) {
        console.warn(`[Component Library Agent] Failed to crawl ${url}:`, error);
        // Continue with next URL
      }
    }
  } finally {
    await browser.close();
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
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a UI component analyzer. Analyze the screenshot and identify distinct UI components.

For each component:
1. Name: Descriptive name (e.g., "Hero Banner", "Product Card", "Navigation Menu")
2. Description: What the component does
3. Estimated Props: Key properties it might accept (e.g., {"title": "string", "image": "url"})
4. Usage Context: Where/how it's used

Return a JSON array of components. Only include components that appear to be reusable patterns.`,
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
    }>;

    return parsed.map(comp => ({
      ...comp,
      pageUrl: url,
      screenshotBase64, // Include screenshot for gallery view
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
    // Build searchable content
    const componentSummaries = result.components
      .map(
        (comp, idx) =>
          `Component ${idx + 1}: ${comp.name}\nDescription: ${comp.description}\nUsage: ${comp.usageContext}\nPage: ${comp.pageUrl}\n`
      )
      .join('\n\n');

    const chunkText = `Component Library Analysis

Total Components: ${result.totalComponents}
Pages Analyzed: ${result.pagesAnalyzed}
Confidence: ${result.confidence}%

${componentSummaries}

Sources: ${result.sources.join(', ')}`;

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
      await db.insert(rfpEmbeddings).values({
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
