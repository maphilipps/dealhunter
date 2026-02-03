import * as cheerio from 'cheerio';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { getModel } from '@/lib/ai/model-config';

export const accessibilitySchema = z.object({
  score: z.number().min(0).max(100),
  wcagLevel: z.enum(['A', 'AA', 'AAA', 'none']),
  violations: z.array(
    z.object({
      rule: z.string(),
      wcagCriteria: z.string(),
      severity: z.enum(['critical', 'serious', 'moderate', 'minor']),
      count: z.number(),
      description: z.string(),
      recommendation: z.string(),
    })
  ),
  summary: z.object({
    imagesWithoutAlt: z.number(),
    missingFormLabels: z.number(),
    headingHierarchyIssues: z.number(),
    ariaUsage: z.enum(['none', 'basic', 'moderate', 'extensive']),
    colorContrastRisk: z.enum(['low', 'medium', 'high', 'unknown']),
    keyboardNavigable: z.boolean(),
    hasSkipLink: z.boolean(),
    hasLangAttribute: z.boolean(),
  }),
  confidence: z.number().min(0).max(100),
});

export type AccessibilityResult = z.infer<typeof accessibilitySchema>;

function runStaticA11yChecks(html: string): string {
  const $ = cheerio.load(html);
  const findings: string[] = [];

  // Images without alt
  const imgsNoAlt = $('img:not([alt])').length;
  const imgsEmptyAlt = $('img[alt=""]').length;
  const totalImgs = $('img').length;
  findings.push(`Images: ${totalImgs} total, ${imgsNoAlt} missing alt, ${imgsEmptyAlt} empty alt`);

  // Form labels
  const inputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
  let unlabeled = 0;
  inputs.each((_, el) => {
    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledby = $(el).attr('aria-labelledby');
    if (!ariaLabel && !ariaLabelledby && (!id || $(`label[for="${id}"]`).length === 0)) {
      unlabeled++;
    }
  });
  findings.push(`Form inputs: ${inputs.length} total, ${unlabeled} without labels`);

  // Heading hierarchy
  const headings: string[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headings.push(el.tagName.toLowerCase());
  });
  const h1Count = headings.filter(h => h === 'h1').length;
  findings.push(`Headings: ${headings.length} total, ${h1Count} h1 tags`);
  findings.push(`Heading sequence: ${headings.slice(0, 20).join(' → ')}`);

  // ARIA attributes
  const ariaElements = $('[aria-label], [aria-labelledby], [aria-describedby], [role]').length;
  findings.push(`ARIA usage: ${ariaElements} elements with ARIA attributes`);

  // Skip link
  const hasSkipLink =
    $('a[href="#main"], a[href="#content"], a.skip-link, a.skip-to-content').length > 0;
  findings.push(`Skip link: ${hasSkipLink ? 'found' : 'not found'}`);

  // Lang attribute
  const langAttr = $('html').attr('lang');
  findings.push(`Lang attribute: ${langAttr ?? 'missing'}`);

  // Landmarks
  const landmarks = $(
    'main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"]'
  ).length;
  findings.push(`Landmarks: ${landmarks} found`);

  // Tab index issues
  const positiveTabindex = $('[tabindex]').filter((_, el) => {
    const val = parseInt($(el).attr('tabindex') ?? '0', 10);
    return val > 0;
  }).length;
  findings.push(`Positive tabindex (anti-pattern): ${positiveTabindex}`);

  return findings.join('\n');
}

export async function auditAccessibility(
  url: string,
  page: { html: string }
): Promise<AccessibilityResult> {
  const { html } = page;
  const staticChecks = runStaticA11yChecks(html);

  const result = await generateText({
    model: getModel('default'),
    output: Output.object({ schema: accessibilitySchema }),
    system: `Du bist ein WCAG-Barrierefreiheits-Experte. Analysiere die statischen Prüfergebnisse einer Website und bewerte die Barrierefreiheit gemäß WCAG 2.1 Richtlinien. Beachte: Dies ist eine statische Analyse — dynamische Aspekte (Farbe, Kontrast, Tastaturnavigation) können nur geschätzt werden.`,
    prompt: `Website: ${url}\n\nStatische Prüfergebnisse:\n${staticChecks}\n\nHTML-Auszug (erste 3000 Zeichen):\n${html.slice(0, 3000)}`,
    temperature: 0.1,
    maxOutputTokens: 8000,
  });

  return result.output!;
}
