import type { ScrapedPage, TechIndicator } from './types';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';
import {
  generateRawChunkEmbeddings,
  type RawChunkWithEmbedding,
} from '@/lib/rag/raw-embedding-service';

const MAX_CHUNK_SIZE = 6000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

/**
 * Split text into overlapping chunks for better RAG retrieval
 */
function chunkText(text: string, maxSize = MAX_CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      const sentenceBreak = text.lastIndexOf('. ', end);

      if (paragraphBreak > start + maxSize * 0.5) {
        end = paragraphBreak + 2;
      } else if (sentenceBreak > start + maxSize * 0.5) {
        end = sentenceBreak + 2;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks.filter(c => c.length > 50);
}

/**
 * Convert page structure to human-readable text
 */
function structureToText(page: ScrapedPage): string {
  const parts: string[] = [];

  // Headings hierarchy
  if (page.structure.headings.length > 0) {
    parts.push('=== Überschriften ===');
    for (const h of page.structure.headings) {
      const indent = '  '.repeat(h.level - 1);
      parts.push(`${indent}H${h.level}: ${h.text}`);
    }
  }

  // Navigation areas
  if (page.structure.navigation.length > 0) {
    parts.push(`\n=== Navigation ===`);
    for (const nav of page.structure.navigation) {
      parts.push(`${nav.type}: ${nav.links.slice(0, 10).join(', ')}`);
      if (nav.links.length > 10) {
        parts.push(`  ... und ${nav.links.length - 10} weitere Links`);
      }
    }
  }

  // Sections
  if (page.structure.sections.length > 0) {
    parts.push(`\n=== Seitenabschnitte (${page.structure.sections.length}) ===`);
    for (const section of page.structure.sections.slice(0, 15)) {
      const id = section.id ? `#${section.id}` : '';
      const cls = section.className ? `.${section.className}` : '';
      parts.push(`- <${section.tag}${id}${cls}>`);
    }
  }

  // Forms
  if (page.structure.forms.length > 0) {
    parts.push(`\n=== Formulare (${page.structure.forms.length}) ===`);
    for (const form of page.structure.forms) {
      parts.push(`Formular: ${form.action || 'Inline'} (${form.method || 'GET'})`);
      parts.push(`  Felder: ${form.inputs.join(', ')}`);
    }
  }

  // Media
  if (page.structure.images > 0 || page.structure.videos > 0) {
    parts.push(`\n=== Medien ===`);
    if (page.structure.images > 0) parts.push(`Bilder: ${page.structure.images}`);
    if (page.structure.videos > 0) parts.push(`Videos: ${page.structure.videos}`);
  }

  // Iframes
  if (page.structure.iframes.length > 0) {
    parts.push(`\n=== Iframes (${page.structure.iframes.length}) ===`);
    for (const iframe of page.structure.iframes) {
      parts.push(`- ${iframe.src}`);
    }
  }

  return parts.join('\n');
}

/**
 * Embed a single scraped page into the lead embeddings table
 * Stores FULL content with chunking for large pages
 */
export async function embedScrapedPage(qualificationId: string, page: ScrapedPage): Promise<void> {
  // ═══════════════════════════════════════════════════════════════
  // 1. STORE FULL PAGE TEXT (chunked if necessary)
  // ═══════════════════════════════════════════════════════════════
  const fullPageText = `=== ${page.title} ===
URL: ${page.url}
Gescraped: ${page.scrapedAt}

${page.text}`;

  const textChunks = chunkText(fullPageText);

  for (let i = 0; i < textChunks.length; i++) {
    const chunkContent = textChunks[i];
    const chunks = [
      {
        chunkIndex: i,
        content: chunkContent,
        tokenCount: Math.ceil(chunkContent.length / 4),
        metadata: {
          type: 'section' as const,
          startPosition: 0,
          endPosition: chunkContent.length,
        },
      },
    ];

    const withEmbeddings = await generateRawChunkEmbeddings(chunks);

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName: 'scraper',
      chunkType: 'page_text',
      chunkIndex: i,
      content: chunkContent,
      embedding: withEmbeddings?.[0]?.embedding ?? null,
      metadata: JSON.stringify({
        url: page.url,
        title: page.title,
        scrapedAt: page.scrapedAt,
        chunkOf: textChunks.length,
        totalLength: page.text.length,
      }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. STORE STRUCTURE AS READABLE TEXT
  // ═══════════════════════════════════════════════════════════════
  const structureText = structureToText(page);

  if (structureText.length > 100) {
    const structChunks = [
      {
        chunkIndex: 0,
        content: `Seitenstruktur: ${page.title}\n${structureText}`,
        tokenCount: Math.ceil(structureText.length / 4),
        metadata: {
          type: 'section' as const,
          startPosition: 0,
          endPosition: structureText.length,
        },
      },
    ];

    const structEmbeddings = await generateRawChunkEmbeddings(structChunks);

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName: 'scraper',
      chunkType: 'page_structure_text',
      chunkIndex: 0,
      content: `Seitenstruktur: ${page.title}\n${structureText}`,
      embedding: structEmbeddings?.[0]?.embedding ?? null,
      metadata: JSON.stringify({ url: page.url }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. STORE STRUCTURE AS JSON (for programmatic access)
  // ═══════════════════════════════════════════════════════════════
  await db.insert(dealEmbeddings).values({
    qualificationId,
    agentName: 'scraper',
    chunkType: 'page_structure_json',
    chunkIndex: 0,
    content: JSON.stringify(page.structure, null, 2),
    metadata: JSON.stringify({ url: page.url, title: page.title }),
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. STORE TECH INDICATORS AS TEXT
  // ═══════════════════════════════════════════════════════════════
  if (page.techIndicators.length > 0) {
    const techText = page.techIndicators
      .map(t => `${t.name} (${t.category}): ${t.evidence}`)
      .join('\n');

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName: 'scraper',
      chunkType: 'tech_detection',
      chunkIndex: 0,
      content: `Erkannte Technologien auf ${page.url}:\n${techText}`,
      metadata: JSON.stringify({
        url: page.url,
        technologies: page.techIndicators,
      }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. STORE EXTERNAL REQUESTS
  // ═══════════════════════════════════════════════════════════════
  if (page.externalRequests.length > 0) {
    const requestsText = page.externalRequests
      .map(r => `${r.type}: ${r.domain} (${r.url})`)
      .join('\n');

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName: 'scraper',
      chunkType: 'external_requests',
      chunkIndex: 0,
      content: `Externe Requests von ${page.url}:\n${requestsText}`,
      metadata: JSON.stringify({
        url: page.url,
        requests: page.externalRequests,
      }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. STORE SCREENSHOTS
  // ═══════════════════════════════════════════════════════════════
  if (page.screenshot) {
    await storeScreenshot(qualificationId, page.url, page.screenshot, false);
  }
  if (page.screenshotMobile) {
    await storeScreenshot(qualificationId, page.url, page.screenshotMobile, true);
  }
}

/**
 * Embed all scraped data for a lead after scraping is complete
 * Creates comprehensive summaries for RAG
 */
export async function embedScrapedData(
  qualificationId: string,
  pages: ScrapedPage[],
  techStack: TechIndicator[]
): Promise<void> {
  // Embed each page with full content
  for (const page of pages) {
    await embedScrapedPage(qualificationId, page);
  }

  // ═══════════════════════════════════════════════════════════════
  // WEBSITE OVERVIEW (comprehensive summary)
  // ═══════════════════════════════════════════════════════════════
  const overviewParts: string[] = [
    `=== Website Übersicht ===`,
    `Analysierte Seiten: ${pages.length}`,
    ``,
  ];

  // Page list with descriptions
  overviewParts.push(`--- Seitenindex ---`);
  for (const page of pages) {
    const headings = page.structure.headings
      .filter(h => h.level <= 2)
      .map(h => h.text)
      .slice(0, 3)
      .join(' | ');
    overviewParts.push(`• ${page.title}`);
    overviewParts.push(`  URL: ${page.url}`);
    if (headings) overviewParts.push(`  Themen: ${headings}`);
    if (page.structure.forms.length > 0) {
      overviewParts.push(`  Formulare: ${page.structure.forms.length}`);
    }
  }

  const overviewText = overviewParts.join('\n');
  const overviewChunks = [
    {
      chunkIndex: 0,
      content: overviewText,
      tokenCount: Math.ceil(overviewText.length / 4),
      metadata: {
        type: 'section' as const,
        startPosition: 0,
        endPosition: overviewText.length,
      },
    },
  ];

  const overviewEmbeddings = await generateRawChunkEmbeddings(overviewChunks);

  await db.insert(dealEmbeddings).values({
    qualificationId,
    agentName: 'scraper',
    chunkType: 'website_overview',
    chunkIndex: 0,
    content: overviewText,
    embedding: overviewEmbeddings?.[0]?.embedding ?? null,
    metadata: JSON.stringify({
      totalPages: pages.length,
      pagesWithForms: pages.filter(p => p.structure.forms.length > 0).length,
      pagesWithVideos: pages.filter(p => p.structure.videos > 0).length,
    }),
  });

  // ═══════════════════════════════════════════════════════════════
  // TECH STACK SUMMARY
  // ═══════════════════════════════════════════════════════════════
  if (techStack.length > 0) {
    // Group by category
    const byCategory = techStack.reduce(
      (acc, t) => {
        if (!acc[t.category]) acc[t.category] = [];
        acc[t.category].push(t);
        return acc;
      },
      {} as Record<string, TechIndicator[]>
    );

    const techParts: string[] = ['=== Erkannte Technologien ===', ''];

    for (const [category, techs] of Object.entries(byCategory)) {
      techParts.push(`--- ${category} ---`);
      for (const t of techs) {
        techParts.push(`• ${t.name} (${Math.round(t.confidence * 100)}% Konfidenz)`);
        techParts.push(`  Nachweis: ${t.evidence}`);
      }
      techParts.push('');
    }

    const techContent = techParts.join('\n');

    const techChunks = [
      {
        chunkIndex: 0,
        content: techContent,
        tokenCount: Math.ceil(techContent.length / 4),
        metadata: {
          type: 'section' as const,
          startPosition: 0,
          endPosition: techContent.length,
        },
      },
    ];

    const withEmbeddings = await generateRawChunkEmbeddings(techChunks);

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName: 'scraper',
      chunkType: 'tech_stack_summary',
      chunkIndex: 0,
      content: techContent,
      embedding: withEmbeddings?.[0]?.embedding ?? null,
      metadata: JSON.stringify({ techStack, categories: Object.keys(byCategory) }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FORMS SUMMARY (important for lead gen analysis)
  // ═══════════════════════════════════════════════════════════════
  const allForms = pages.flatMap(p =>
    p.structure.forms.map(f => ({
      ...f,
      pageUrl: p.url,
      pageTitle: p.title,
    }))
  );

  if (allForms.length > 0) {
    const formParts: string[] = [`=== Formulare der Website (${allForms.length}) ===`, ''];

    for (const form of allForms) {
      formParts.push(`--- ${form.pageTitle} ---`);
      formParts.push(`Seite: ${form.pageUrl}`);
      formParts.push(`Action: ${form.action || 'Inline-Verarbeitung'}`);
      formParts.push(`Methode: ${form.method || 'GET'}`);
      formParts.push(`Felder: ${form.inputs.join(', ')}`);
      formParts.push('');
    }

    const formContent = formParts.join('\n');

    await db.insert(dealEmbeddings).values({
      qualificationId,
      agentName: 'scraper',
      chunkType: 'forms_summary',
      chunkIndex: 0,
      content: formContent,
      metadata: JSON.stringify({ formCount: allForms.length }),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGE INDEX JSON (for programmatic access)
  // ═══════════════════════════════════════════════════════════════
  const pageIndex = pages.map(p => ({
    url: p.url,
    title: p.title,
    headings: p.structure.headings.filter(h => h.level <= 2).map(h => h.text),
    hasForms: p.structure.forms.length > 0,
    hasVideos: p.structure.videos > 0,
    imageCount: p.structure.images,
    sectionCount: p.structure.sections.length,
    iframeCount: p.structure.iframes.length,
    textLength: p.text.length,
  }));

  await db.insert(dealEmbeddings).values({
    qualificationId,
    agentName: 'scraper',
    chunkType: 'page_index_json',
    chunkIndex: 0,
    content: JSON.stringify(pageIndex, null, 2),
    metadata: JSON.stringify({
      totalPages: pages.length,
      pagesWithForms: pages.filter(p => p.structure.forms.length > 0).length,
      pagesWithVideos: pages.filter(p => p.structure.videos > 0).length,
    }),
  });
}

/**
 * Store screenshot separately (large binary data)
 */
export async function storeScreenshot(
  qualificationId: string,
  pageUrl: string,
  screenshotBase64: string,
  isMobile: boolean = false
): Promise<void> {
  await db.insert(dealEmbeddings).values({
    qualificationId,
    agentName: 'scraper',
    chunkType: isMobile ? 'screenshot_mobile' : 'screenshot',
    chunkIndex: 0,
    content: screenshotBase64,
    metadata: JSON.stringify({
      url: pageUrl,
      isMobile,
      capturedAt: new Date().toISOString(),
    }),
  });
}
