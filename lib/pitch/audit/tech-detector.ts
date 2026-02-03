import * as cheerio from 'cheerio';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { getModel } from '@/lib/ai/model-config';

export const techStackSchema = z.object({
  cms: z
    .object({
      name: z.string(),
      version: z.string().nullable(),
      confidence: z.number().min(0).max(100),
      evidence: z.array(z.string()),
    })
    .nullable(),
  framework: z
    .object({
      name: z.string(),
      version: z.string().nullable(),
      confidence: z.number().min(0).max(100),
    })
    .nullable(),
  libraries: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      confidence: z.number().min(0).max(100),
    })
  ),
  analytics: z.array(z.string()),
  cdn: z.string().nullable(),
  hosting: z
    .object({
      provider: z.string().nullable(),
      evidence: z.array(z.string()),
    })
    .nullable(),
  serverTechnology: z.string().nullable(),
  overallConfidence: z.number().min(0).max(100),
});

export type TechStackResult = z.infer<typeof techStackSchema>;

/**
 * Extracts raw tech indicators from HTML and headers for AI analysis.
 */
function extractTechIndicators(html: string, headers: Record<string, string>): string {
  const $ = cheerio.load(html);
  const indicators: string[] = [];

  // Meta generators
  $('meta[name="generator"]').each((_, el) => {
    indicators.push(`Meta Generator: ${$(el).attr('content')}`);
  });

  // Script sources (first 30)
  $('script[src]')
    .slice(0, 30)
    .each((_, el) => {
      indicators.push(`Script: ${$(el).attr('src')}`);
    });

  // Stylesheet links (first 20)
  $('link[rel="stylesheet"]')
    .slice(0, 20)
    .each((_, el) => {
      indicators.push(`CSS: ${$(el).attr('href')}`);
    });

  // Data attributes on body/html
  const bodyAttrs = $('body').attr() ?? {};
  for (const [key, value] of Object.entries(bodyAttrs)) {
    if (key.startsWith('data-') || key === 'class') {
      indicators.push(`Body ${key}: ${value}`);
    }
  }

  // Inline scripts (first 500 chars each, max 5)
  $('script:not([src])')
    .slice(0, 5)
    .each((_, el) => {
      const text = $(el).text().slice(0, 500);
      if (text.trim()) {
        indicators.push(`Inline Script: ${text}`);
      }
    });

  // Response headers
  for (const key of [
    'server',
    'x-powered-by',
    'x-generator',
    'x-drupal-cache',
    'x-wordpress',
    'x-typo3',
  ]) {
    if (headers[key]) {
      indicators.push(`Header ${key}: ${headers[key]}`);
    }
  }

  return indicators.join('\n');
}

export async function detectTechStack(
  url: string,
  page: { html: string; headers: Record<string, string> }
): Promise<TechStackResult> {
  const indicators = extractTechIndicators(page.html, page.headers);

  const result = await generateText({
    model: getModel('fast'),
    output: Output.object({ schema: techStackSchema }),
    system: `Du bist ein Website-Technologie-Experte. Analysiere die technischen Indikatoren einer Website und identifiziere den Tech-Stack.`,
    prompt: `Website: ${url}\n\nTechnische Indikatoren:\n${indicators}`,
    temperature: 0.1,
    maxOutputTokens: 8000,
  });

  return result.output!;
}
