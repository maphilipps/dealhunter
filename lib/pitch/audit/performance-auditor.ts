import { generateText, Output } from 'ai';
import { z } from 'zod';

import { getModel } from '@/lib/ai/model-config';

export const performanceSchema = z.object({
  scores: z.object({
    overall: z.number().min(0).max(100),
    lcp: z.object({
      value: z.string(),
      rating: z.enum(['good', 'needs_improvement', 'poor']),
    }),
    cls: z.object({
      value: z.string(),
      rating: z.enum(['good', 'needs_improvement', 'poor']),
    }),
    ttfb: z.object({
      value: z.string(),
      rating: z.enum(['good', 'needs_improvement', 'poor']),
    }),
    fid: z.object({
      value: z.string(),
      rating: z.enum(['good', 'needs_improvement', 'poor']),
    }),
  }),
  findings: z.array(
    z.object({
      category: z.enum([
        'images',
        'scripts',
        'css',
        'fonts',
        'caching',
        'compression',
        'rendering',
        'network',
      ]),
      issue: z.string(),
      impact: z.enum(['low', 'medium', 'high']),
      recommendation: z.string(),
    })
  ),
  resourceSummary: z.object({
    totalScripts: z.number(),
    totalStylesheets: z.number(),
    totalImages: z.number(),
    hasLazyLoading: z.boolean(),
    hasMinification: z.boolean(),
    hasCompression: z.boolean(),
  }),
  confidence: z.number().min(0).max(100),
});

export type PerformanceResult = z.infer<typeof performanceSchema>;

/**
 * Fetches PageSpeed Insights data (public API, no key needed for basic usage).
 * Falls back to null on failure.
 */
async function fetchPageSpeedData(url: string): Promise<string | null> {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    const audits = data.lighthouseResult?.audits ?? {};
    const metrics = data.lighthouseResult?.categories?.performance ?? {};

    const summary: string[] = [];
    summary.push(`Performance Score: ${Math.round((metrics.score ?? 0) * 100)}/100`);

    for (const key of [
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
      'first-contentful-paint',
      'speed-index',
      'interactive',
    ]) {
      const audit = audits[key];
      if (audit) {
        summary.push(
          `${audit.title}: ${audit.displayValue} (${audit.score !== null ? Math.round(audit.score * 100) : 'n/a'})`
        );
      }
    }

    return summary.join('\n');
  } catch (error) {
    console.warn(
      '[PageSpeed] Failed to fetch data:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function extractPerformanceIndicators(html: string): string {
  const indicators: string[] = [];
  const scriptCount = (html.match(/<script[\s>]/gi) ?? []).length;
  const styleCount = (html.match(/<link[^>]+stylesheet/gi) ?? []).length;
  const imgCount = (html.match(/<img[\s>]/gi) ?? []).length;
  const lazyCount = (html.match(/loading=["']lazy["']/gi) ?? []).length;

  indicators.push(`Scripts: ${scriptCount}, Stylesheets: ${styleCount}, Images: ${imgCount}`);
  indicators.push(`Lazy-loaded images: ${lazyCount}/${imgCount}`);
  indicators.push(`HTML size: ${Math.round(html.length / 1024)}KB`);

  if (html.includes('.min.js') || html.includes('.min.css')) {
    indicators.push('Minified assets detected');
  }
  if (html.includes('preload') || html.includes('prefetch')) {
    indicators.push('Resource hints detected (preload/prefetch)');
  }

  return indicators.join('\n');
}

export async function auditPerformance(
  url: string,
  page: { html: string }
): Promise<PerformanceResult> {
  const pageSpeedData = await fetchPageSpeedData(url);
  const { html } = page;

  const htmlIndicators = extractPerformanceIndicators(html);
  const context = pageSpeedData
    ? `PageSpeed Insights:\n${pageSpeedData}\n\nHTML-Analyse:\n${htmlIndicators}`
    : `(PageSpeed API nicht verfügbar — Analyse nur auf HTML-Basis)\n\nHTML-Analyse:\n${htmlIndicators}`;

  const result = await generateText({
    model: getModel('fast'),
    output: Output.object({ schema: performanceSchema }),
    system: `Du bist ein Web-Performance-Experte. Analysiere die Performance einer Website anhand der bereitgestellten Daten. Gib Core Web Vitals Schätzungen ab und identifiziere Performance-Probleme.`,
    prompt: `Website: ${url}\n\n${context}`,
    temperature: 0.1,
    maxOutputTokens: 8000,
  });

  return result.output!;
}
