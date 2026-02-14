/**
 * Deterministic PDF Text Extraction using pdfjs-dist
 *
 * Extracts text page-by-page using Mozilla's PDF.js library.
 * Detects headings via font-size heuristics and produces marker-annotated
 * text compatible with source-locator.ts ([[PAGE N]], [[H]], [[PASS text]]).
 *
 * Advantages over AI-based extraction:
 * - Deterministic (same input → same output)
 * - No API calls, fast, zero cost
 * - Works offline
 *
 * Limitations:
 * - No OCR (scanned-only PDFs produce empty text)
 * - Tables are extracted as plain text lines (no layout reconstruction)
 */

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const MAX_PDF_PAGES = 500;

type LineItem = {
  text: string;
  fontSize: number;
  fontName: string;
  y: number;
  x: number;
};

type TextLine = {
  text: string;
  fontSize: number;
  fontName: string;
};

/**
 * Extract marker-annotated text from a PDF buffer using pdfjs-dist.
 *
 * Output format matches what source-locator.ts expects:
 * - [[PASS text]] at the top
 * - [[PAGE N]] before each page
 * - [[H]] Heading for detected headings
 * - Paragraphs separated by blank lines
 */
export async function extractTextDeterministic(buffer: Buffer): Promise<string> {
  // Dynamic import to keep pdfjs-dist as a lazy dependency
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Create a Uint8Array view over the same memory (no copy) — pdfjs-dist
  // rejects Buffer even though it's a Uint8Array subclass.
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pdf = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    // Disable worker for Node.js server-side usage
    isEvalSupported: false,
  }).promise;

  try {
    const totalPages = pdf.numPages;

    if (totalPages > MAX_PDF_PAGES) {
      throw new Error(`PDF hat ${totalPages} Seiten (Maximum: ${MAX_PDF_PAGES})`);
    }

    const pageOutputs: string[] = [];

    // Collect all items across all pages to detect the body font
    const allPageItems: { pageNum: number; lines: TextLine[] }[] = [];

    // Incremental font statistics collection
    const sizeCharCounts = new Map<number, number>();
    const nameCharCounts = new Map<string, number>();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      try {
        const textContent = await page.getTextContent();
        const items = textContent.items.filter(
          (item): item is TextItem => 'str' in item && item.str !== undefined
        );

        if (items.length === 0) {
          console.warn(
            `[PDF Deterministic] Page ${pageNum}: Kein extrahierbarer Text (möglicherweise Scan)`
          );
          pageOutputs.push(`[[PAGE ${pageNum}]]\n[Kein extrahierbarer Text]`);
          continue;
        }

        const lines = groupItemsIntoLines(items);
        allPageItems.push({ pageNum, lines });

        // Collect font stats incrementally
        for (const line of lines) {
          if (line.text.trim().length === 0) continue;
          const rounded = Math.round(line.fontSize * 10) / 10;
          sizeCharCounts.set(rounded, (sizeCharCounts.get(rounded) || 0) + line.text.length);
          nameCharCounts.set(
            line.fontName,
            (nameCharCounts.get(line.fontName) || 0) + line.text.length
          );
        }
      } finally {
        page.cleanup();
      }
    }

    // Detect body font from collected stats
    let bodyFontSize = 12;
    let maxSizeChars = 0;
    for (const [size, chars] of sizeCharCounts) {
      if (chars > maxSizeChars) {
        maxSizeChars = chars;
        bodyFontSize = size;
      }
    }

    let bodyFontName: string | null = null;
    let maxNameChars = 0;
    // Filter nameCharCounts to only fonts at body size
    const bodyNameCharCounts = new Map<string, number>();
    for (const { lines } of allPageItems) {
      for (const line of lines) {
        if (line.text.trim().length === 0) continue;
        const rounded = Math.round(line.fontSize * 10) / 10;
        const bodyRounded = Math.round(bodyFontSize * 10) / 10;
        if (Math.abs(rounded - bodyRounded) <= 0.5) {
          bodyNameCharCounts.set(
            line.fontName,
            (bodyNameCharCounts.get(line.fontName) || 0) + line.text.length
          );
        }
      }
    }
    for (const [name, chars] of bodyNameCharCounts) {
      if (chars > maxNameChars) {
        maxNameChars = chars;
        bodyFontName = name;
      }
    }

    // Build page outputs
    for (const { pageNum, lines } of allPageItems) {
      const paragraphs = buildParagraphs(lines, bodyFontSize, bodyFontName);
      const markerText = formatPageWithMarkers(pageNum, paragraphs);
      pageOutputs.push(markerText);
    }

    const body = pageOutputs.join('\n');
    if (!body.trim() || isEmptyExtraction(body)) {
      throw new Error(
        'PDF enthält keinen extrahierbaren Text (möglicherweise leeres Dokument oder Bildformat)'
      );
    }

    return `[[PASS text]]\n${body}`;
  } finally {
    pdf.cleanup();
    pdf.destroy();
  }
}

function isEmptyExtraction(text: string): boolean {
  const stripped = text
    .replace(/\[\[PAGE \d+\]\]/g, '')
    .replace(/\[Kein extrahierbarer Text\]/g, '')
    .trim();
  return stripped.length === 0;
}

/**
 * Group text items into lines based on Y-coordinate proximity.
 */
function groupItemsIntoLines(items: TextItem[]): TextLine[] {
  if (items.length === 0) return [];

  const lineItems: LineItem[] = items
    .filter(item => item.str.trim().length > 0 || item.str === ' ')
    .map(item => ({
      text: item.str,
      fontSize: Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12,
      fontName: item.fontName,
      y: -item.transform[5],
      x: item.transform[4],
    }))
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 2) return a.y - b.y;
      return a.x - b.x;
    });

  if (lineItems.length === 0) return [];

  const lines: TextLine[] = [];
  let currentLineItems: LineItem[] = [lineItems[0]];
  let currentY = lineItems[0].y;

  for (let i = 1; i < lineItems.length; i++) {
    const item = lineItems[i];
    const yTolerance = Math.max(item.fontSize * 0.5, 2);

    if (Math.abs(item.y - currentY) <= yTolerance) {
      currentLineItems.push(item);
    } else {
      lines.push(mergeLineItems(currentLineItems));
      currentLineItems = [item];
      currentY = item.y;
    }
  }

  if (currentLineItems.length > 0) {
    lines.push(mergeLineItems(currentLineItems));
  }

  return lines;
}

/**
 * Merge items on the same line into a single TextLine.
 */
function mergeLineItems(items: LineItem[]): TextLine {
  let text = '';
  let prevEnd = -Infinity;

  for (const item of items) {
    if (text.length > 0 && item.x > prevEnd + 1) {
      if (!text.endsWith(' ') && !item.text.startsWith(' ')) {
        text += ' ';
      }
    }
    text += item.text;
    prevEnd = item.x + item.text.length * item.fontSize * 0.5;
  }

  const fontSize = items.reduce((max, item) => (item.fontSize > max ? item.fontSize : max), 0);

  return { text: text.trim(), fontSize, fontName: items[0].fontName };
}

type Paragraph = {
  text: string;
  isHeading: boolean;
};

/**
 * Build paragraphs from lines, detecting paragraph boundaries.
 */
function buildParagraphs(
  lines: TextLine[],
  bodyFontSize: number,
  bodyFontName: string | null
): Paragraph[] {
  if (lines.length === 0) return [];

  const paragraphs: Paragraph[] = [];
  let currentLines: TextLine[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const currLine = lines[i];

    const isNewParagraph =
      isHeadingLine(currLine, bodyFontSize, bodyFontName) ||
      isHeadingLine(prevLine, bodyFontSize, bodyFontName) ||
      Math.abs(currLine.fontSize - prevLine.fontSize) > bodyFontSize * 0.15;

    if (isNewParagraph) {
      flushLines(currentLines, bodyFontSize, bodyFontName, paragraphs);
      currentLines = [currLine];
    } else {
      currentLines.push(currLine);
    }
  }

  flushLines(currentLines, bodyFontSize, bodyFontName, paragraphs);

  return paragraphs;
}

function flushLines(
  lines: TextLine[],
  bodyFontSize: number,
  bodyFontName: string | null,
  out: Paragraph[]
): void {
  if (lines.length === 0) return;

  const text = lines
    .map(l => l.text)
    .join(' ')
    .trim();
  if (!text) return;

  const isHeading =
    lines.length <= 3 && lines.every(l => isHeadingLine(l, bodyFontSize, bodyFontName));

  out.push({ text, isHeading });
}

/**
 * Check if a line is a heading based on font heuristics.
 *
 * A line is a heading if:
 * 1. Font size is >= 1.2x body font size, OR
 * 2. It uses a different fontName than the body font at the same size (bold/italic variant)
 *    AND the text is short enough to be a heading
 */
function isHeadingLine(line: TextLine, bodyFontSize: number, bodyFontName: string | null): boolean {
  const text = line.text.trim();
  if (!text || text.length > 120) return false;

  // Purely numeric lines (page numbers, etc.) are not headings
  if (/^\d+$/.test(text)) return false;

  // Font size significantly larger than body
  if (line.fontSize >= bodyFontSize * 1.2) {
    return true;
  }

  // Different fontName at same size = font variant (bold/italic)
  if (bodyFontName && line.fontName !== bodyFontName && text.length <= 100) {
    const sizeRatio = line.fontSize / bodyFontSize;
    // Only consider as heading variant if font size is close to body size
    if (sizeRatio >= 0.9 && sizeRatio <= 1.1) {
      return true;
    }
  }

  return false;
}

/**
 * Format a page's paragraphs into marker-annotated text.
 */
function formatPageWithMarkers(pageNum: number, paragraphs: Paragraph[]): string {
  const parts: string[] = [`[[PAGE ${pageNum}]]`];

  for (const para of paragraphs) {
    if (para.isHeading) {
      parts.push(`[[H]] ${para.text}`);
    } else {
      parts.push(`\n${para.text}\n`);
    }
  }

  return parts.join('\n');
}
