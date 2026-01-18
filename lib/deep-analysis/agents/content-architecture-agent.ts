/**
 * Content Architecture Analyzer Agent
 * Fetches sitemap, classifies page types, maps to Drupal Content Types
 * Expected duration: 6-10 minutes
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { ContentArchitectureSchema, type ContentArchitecture } from '../schemas';
import { fetchSitemap, samplePages, fetchPageContent, extractPageMetadata } from '../utils/crawler';

// Initialize OpenAI client with adesso AI Hub
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

// Schema for page classification
const pageClassificationSchema = z.object({
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
});

// Schema for Drupal mapping
const drupalMappingSchema = z.object({
  contentTypeMapping: z.array(
    z.object({
      pageType: z.string(),
      drupalContentType: z.string(),
      confidence: z.number().min(0).max(100),
      reasoning: z.string(),
    })
  ),
  paragraphEstimate: z.number().int().nonnegative(),
});

/**
 * Helper function to call AI and parse JSON response
 */
async function callAI<T>(systemPrompt: string, userPrompt: string, schema: z.ZodSchema<T>): Promise<T> {
  const completion = await openai.chat.completions.create({
    model: 'claude-haiku-4.5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);
  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return schema.parse(cleanedResult);
}

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

      const result = await callAI(
        'You are a page classification expert. Always respond with valid JSON. Do not include markdown code blocks.',
        `Classify this page based on its URL, title, and HTML structure:

URL: ${url}
Title: ${metadata.title || 'N/A'}
Description: ${metadata.description || 'N/A'}

HTML (first 2000 chars):
${html.substring(0, 2000)}

What type of page is this? Choose the most specific category that fits.

Respond with JSON containing:
- pageType (string: "homepage", "product", "service", "blog", "news", "landing", "contact", "about", "event", "job", or "custom"): Page type
- confidence (number 0-100): Classification confidence
- reasoning (string): Brief explanation`,
        pageClassificationSchema
      );

      pageClassifications.push({
        url,
        ...result,
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

  const mapping = await callAI(
    'You are a Drupal migration expert. Always respond with valid JSON. Do not include markdown code blocks.',
    `Map these page types to Drupal Content Types and estimate Paragraph types needed.

Website: ${websiteUrl}
Total Pages: ${totalPages}

Page Types Found:
${pageTypes.map(pt => `- ${pt.type}: ${pt.count} pages (examples: ${pt.sampleUrls.slice(0, 2).join(', ')})`).join('\n')}

Task:
1. Map each page type to a Drupal Content Type (use standard Drupal naming: "Article", "Basic Page", "Product", "Landing Page", etc.)
2. Estimate how many Paragraph types would be needed for flexible content layouts (consider variety of content structures observed)
3. Provide confidence scores (0-100) for each mapping
4. Explain your reasoning

Be conservative with estimates - only suggest custom Content Types when standard ones don't fit.

Respond with JSON containing:
- contentTypeMapping (array of objects with pageType, drupalContentType, confidence 0-100, reasoning): Mapping
- paragraphEstimate (number): Estimated Paragraph types needed`,
    drupalMappingSchema
  );

  onProgress?.('Content architecture analysis complete');

  // Step 6: Validate and return
  return ContentArchitectureSchema.parse({
    pageTypes,
    contentTypeMapping: mapping.contentTypeMapping,
    paragraphEstimate: mapping.paragraphEstimate,
    totalPages,
  });
}
