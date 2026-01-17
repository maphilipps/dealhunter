/**
 * Content Architecture Analyzer Agent
 * Fetches sitemap, classifies page types, maps to Drupal Content Types
 * Expected duration: 6-10 minutes
 */

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { ContentArchitectureSchema, type ContentArchitecture } from '../schemas';
import { fetchSitemap, samplePages, fetchPageContent, extractPageMetadata } from '../utils/crawler';

export async function analyzeContentArchitecture(
  websiteUrl: string,
  onProgress?: (message: string) => void
): Promise<ContentArchitecture> {
  onProgress?.('Fetching sitemap...');

  // Step 1: Fetch sitemap
  const sitemap = await fetchSitemap(websiteUrl);
  const totalPages = sitemap.total;

  onProgress?.(`Found ${totalPages} pages in sitemap`);

  // Step 2: Sample 50 representative pages
  const sampleCount = Math.min(50, totalPages);
  onProgress?.(`Sampling ${sampleCount} pages from ${totalPages} total...`);
  const sampleUrls = samplePages(sitemap.urls, sampleCount);

  // Step 3: Classify each sampled page using LLM
  onProgress?.('Classifying page types with AI...');

  const pageClassifications: Array<{
    url: string;
    pageType: string;
    confidence: number;
    reasoning: string;
  }> = [];

  for (let i = 0; i < sampleUrls.length; i++) {
    const url = sampleUrls[i];
    onProgress?.(`Classifying page ${i + 1}/${sampleUrls.length}: ${new URL(url).pathname}`);

    try {
      const html = await fetchPageContent(url);
      const metadata = extractPageMetadata(html);

      const { object } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: z.object({
          pageType: z.enum([
            'homepage',
            'product',
            'service',
            'blog',
            'news',
            'landing',
            'contact',
            'about',
            'event',
            'job',
            'custom',
          ]),
          confidence: z.number().min(0).max(100),
          reasoning: z.string(),
        }),
        prompt: `Classify this page based on its URL, title, and HTML structure:

URL: ${url}
Title: ${metadata.title || 'N/A'}
Description: ${metadata.description || 'N/A'}

HTML (first 2000 chars):
${html.substring(0, 2000)}

What type of page is this? Choose the most specific category that fits.`,
      });

      pageClassifications.push({
        url,
        ...object,
      });
    } catch (error) {
      console.warn(`Failed to classify page ${url}:`, error);
      // Skip failed pages
    }
  }

  onProgress?.(`Classified ${pageClassifications.length} pages`);

  // Step 4: Group by page type and extrapolate counts
  const pageTypeCounts: Record<string, { urls: string[]; count: number }> = {};

  for (const classification of pageClassifications) {
    if (!pageTypeCounts[classification.pageType]) {
      pageTypeCounts[classification.pageType] = { urls: [], count: 0 };
    }
    pageTypeCounts[classification.pageType].urls.push(classification.url);
  }

  // Extrapolate counts based on sample
  const pageTypes = Object.entries(pageTypeCounts).map(([type, data]) => ({
    type,
    count: Math.round((data.urls.length / sampleUrls.length) * totalPages),
    sampleUrls: data.urls.slice(0, 3), // Keep first 3 as examples
  }));

  // Step 5: Map page types to Drupal Content Types using LLM
  onProgress?.('Mapping to Drupal Content Types...');

  const { object: mapping } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({
      contentTypeMapping: z.array(
        z.object({
          pageType: z.string(),
          drupalContentType: z.string(),
          confidence: z.number().min(0).max(100),
          reasoning: z.string(),
        })
      ),
      paragraphEstimate: z.number().int().nonnegative(),
    }),
    prompt: `You are a Drupal migration expert. Map these page types to Drupal Content Types and estimate Paragraph types needed.

Website: ${websiteUrl}
Total Pages: ${totalPages}

Page Types Found:
${pageTypes.map(pt => `- ${pt.type}: ${pt.count} pages (examples: ${pt.sampleUrls.slice(0, 2).join(', ')})`).join('\n')}

Task:
1. Map each page type to a Drupal Content Type (use standard Drupal naming: "Article", "Basic Page", "Product", "Landing Page", etc.)
2. Estimate how many Paragraph types would be needed for flexible content layouts (consider variety of content structures observed)
3. Provide confidence scores (0-100) for each mapping
4. Explain your reasoning

Be conservative with estimates - only suggest custom Content Types when standard ones don't fit.`,
  });

  onProgress?.('Content architecture analysis complete');

  // Step 6: Validate and return
  return ContentArchitectureSchema.parse({
    pageTypes,
    contentTypeMapping: mapping.contentTypeMapping,
    paragraphEstimate: mapping.paragraphEstimate,
    totalPages,
  });
}
