import * as cheerio from 'cheerio';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { getModel } from '@/lib/ai/model-config';
import type { ComponentAnalysis } from '../types';

export const componentAnalysisSchema = z.object({
  components: z.array(
    z.object({
      name: z.string(),
      category: z.enum(['layout', 'navigation', 'content', 'form', 'interactive', 'media']),
      occurrences: z.number(),
      complexity: z.enum(['simple', 'medium', 'complex']),
      description: z.string(),
      migrationNotes: z.string(),
    })
  ),
  contentTypes: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
      fields: z.array(z.string()),
      hasCustomLogic: z.boolean(),
    })
  ),
  forms: z.array(
    z.object({
      name: z.string(),
      fields: z.number(),
      hasValidation: z.boolean(),
      hasFileUpload: z.boolean(),
      submitsTo: z.string(),
    })
  ),
  interactions: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['search', 'filter', 'sort', 'pagination', 'animation', 'realtime', 'other']),
      complexity: z.enum(['simple', 'medium', 'complex']),
    })
  ),
});

function extractPageStructure(html: string): string {
  const $ = cheerio.load(html);
  const structure: string[] = [];

  // Navigation elements
  const navCount = $('nav, [role="navigation"]').length;
  structure.push(`Navigation elements: ${navCount}`);

  // Forms
  $('form').each((i, el) => {
    const action = $(el).attr('action') ?? 'unknown';
    const inputCount = $(el).find('input, textarea, select').length;
    const hasFileUpload = $(el).find('input[type="file"]').length > 0;
    structure.push(
      `Form ${i + 1}: ${inputCount} fields, action=${action}, fileUpload=${hasFileUpload}`
    );
  });

  // Interactive elements
  const sliders = $('[class*="slider"], [class*="carousel"], [class*="swiper"]').length;
  const modals = $('[class*="modal"], [class*="dialog"], [role="dialog"]').length;
  const tabs = $('[class*="tab"], [role="tablist"]').length;
  const accordions = $('[class*="accordion"], [class*="collapse"]').length;
  structure.push(
    `Interactive: sliders=${sliders}, modals=${modals}, tabs=${tabs}, accordions=${accordions}`
  );

  // Media
  const videos = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  const maps = $('iframe[src*="maps"], [class*="map"]').length;
  structure.push(`Media: videos=${videos}, maps=${maps}`);

  // Content sections
  const sections = $('section, article, [class*="section"]').length;
  const cards = $('[class*="card"], [class*="tile"]').length;
  structure.push(`Content: sections=${sections}, cards=${cards}`);

  // Search
  const hasSearch = $('input[type="search"], [class*="search"], [role="search"]').length > 0;
  structure.push(`Search: ${hasSearch ? 'found' : 'not found'}`);

  // Pagination
  const hasPagination =
    $('[class*="paginat"], [class*="pager"], nav [aria-label*="page"]').length > 0;
  structure.push(`Pagination: ${hasPagination ? 'found' : 'not found'}`);

  // Page size estimate
  const textContent = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).length;
  structure.push(`Approximate word count: ${wordCount}`);

  return structure.join('\n');
}

export async function analyzeComponents(
  url: string,
  page: { html: string }
): Promise<ComponentAnalysis> {
  const { html } = page;
  const pageStructure = extractPageStructure(html);

  const result = await generateText({
    model: getModel('quality'),
    output: Output.object({ schema: componentAnalysisSchema }),
    system: `Du bist ein Frontend-Architektur-Experte. Analysiere die Seitenstruktur einer Website und identifiziere alle UI-Komponenten, Content-Typen, Formulare und interaktive Elemente. Bewerte die Komplexität jeder Komponente im Hinblick auf eine CMS-Migration.`,
    prompt: `Website: ${url}\n\nSeitenstruktur:\n${pageStructure}\n\nHTML-Auszug (erste 5000 Zeichen):\n${html.slice(0, 5000)}`,
    temperature: 0.2,
    maxOutputTokens: 8000,
  });

  return result.output!;
}
