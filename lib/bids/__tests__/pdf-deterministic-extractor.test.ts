import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { extractTextDeterministic } from '../pdf-deterministic-extractor';
import { parseDocumentTextToParagraphs } from '../../rag/source-locator';
import { chunkRawTextWithLocators } from '../../rag/raw-chunk-service';

// Helper: create a simple PDF with text on one page
async function createSimplePdf(lines: { text: string; fontSize: number; bold?: boolean }[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  for (const line of lines) {
    const currentFont = line.bold ? boldFont : font;
    page.drawText(line.text, {
      x: 50,
      y,
      size: line.fontSize,
      font: currentFont,
      color: rgb(0, 0, 0),
    });
    y -= line.fontSize * 1.5;
  }

  const bytes = await doc.save();
  return new Uint8Array(bytes) as unknown as Buffer;
}

// Helper: create a multi-page PDF
async function createMultiPagePdf(pages: { text: string; fontSize: number; bold?: boolean }[][]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const pageLines of pages) {
    const page = doc.addPage([595, 842]);
    let y = 780;
    for (const line of pageLines) {
      const currentFont = line.bold ? boldFont : font;
      page.drawText(line.text, {
        x: 50,
        y,
        size: line.fontSize,
        font: currentFont,
        color: rgb(0, 0, 0),
      });
      y -= line.fontSize * 1.5;
    }
  }

  const bytes = await doc.save();
  return new Uint8Array(bytes) as unknown as Buffer;
}

describe('pdf-deterministic-extractor', () => {
  it('should extract text from a simple single-page PDF', async () => {
    const buffer = await createSimplePdf([
      { text: 'Hello World', fontSize: 10 },
      { text: 'This is a test document.', fontSize: 10 },
    ]);

    const result = await extractTextDeterministic(buffer);

    expect(result).toContain('[[PASS text]]');
    expect(result).toContain('[[PAGE 1]]');
    expect(result).toContain('Hello World');
    expect(result).toContain('This is a test document.');
  });

  it('should produce correct [[PAGE N]] markers for multi-page PDFs', async () => {
    const buffer = await createMultiPagePdf([
      [{ text: 'Page one content here.', fontSize: 10 }],
      [{ text: 'Page two content here.', fontSize: 10 }],
      [{ text: 'Page three content here.', fontSize: 10 }],
    ]);

    const result = await extractTextDeterministic(buffer);

    expect(result).toContain('[[PAGE 1]]');
    expect(result).toContain('[[PAGE 2]]');
    expect(result).toContain('[[PAGE 3]]');
    expect(result).toContain('Page one content');
    expect(result).toContain('Page two content');
    expect(result).toContain('Page three content');
  });

  it('should detect headings based on font size (18pt vs 10pt)', async () => {
    const buffer = await createSimplePdf([
      { text: 'Main Heading', fontSize: 18 },
      { text: 'This is body text under the heading.', fontSize: 10 },
      { text: 'Another paragraph of body text.', fontSize: 10 },
    ]);

    const result = await extractTextDeterministic(buffer);

    expect(result).toContain('[[H]] Main Heading');
    expect(result).not.toContain('[[H]] This is body text');
    expect(result).not.toContain('[[H]] Another paragraph');
  });

  it('should detect bold headings', async () => {
    const buffer = await createSimplePdf([
      { text: 'Bold Heading', fontSize: 10, bold: true },
      { text: 'Normal body text follows.', fontSize: 10 },
    ]);

    const result = await extractTextDeterministic(buffer);

    expect(result).toContain('[[H]] Bold Heading');
    expect(result).not.toContain('[[H]] Normal body text');
  });

  it('should handle German umlauts correctly', async () => {
    const buffer = await createSimplePdf([
      { text: 'Projektbeschreibung', fontSize: 14 },
      { text: 'Die Anforderungen umfassen Barrierefreiheit.', fontSize: 10 },
    ]);

    const result = await extractTextDeterministic(buffer);

    expect(result).toContain('Projektbeschreibung');
    expect(result).toContain('Barrierefreiheit');
  });

  it('should handle empty pages gracefully', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]); // empty page
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page2 = doc.addPage([595, 842]);
    page2.drawText('Content on page 2', {
      x: 50,
      y: 780,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    const bytes = await doc.save();
    const buffer = new Uint8Array(bytes) as unknown as Buffer;

    const result = await extractTextDeterministic(buffer);

    expect(result).toContain('[[PAGE 1]]');
    expect(result).toContain('[Kein extrahierbarer Text]');
    expect(result).toContain('[[PAGE 2]]');
    expect(result).toContain('Content on page 2');
  });

  it('should throw on a fully empty PDF (all pages empty)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]); // empty page only
    const bytes = await doc.save();
    const buffer = new Uint8Array(bytes) as unknown as Buffer;

    await expect(extractTextDeterministic(buffer)).rejects.toThrow(/keinen extrahierbaren Text/);
  });

  it('should throw on corrupt/malformed PDF input', async () => {
    const corruptBuffer = Buffer.from('this is not a valid PDF file');

    await expect(extractTextDeterministic(corruptBuffer)).rejects.toThrow();
  });

  it('should throw when PDF exceeds MAX_PDF_PAGES limit', async () => {
    const doc = await PDFDocument.create();
    // Create 501 empty pages (tiny for speed)
    for (let i = 0; i < 501; i++) {
      doc.addPage([100, 100]);
    }
    const bytes = await doc.save();
    const buffer = new Uint8Array(bytes) as unknown as Buffer;

    await expect(extractTextDeterministic(buffer)).rejects.toThrow(/Maximum: 500/);
  });

  describe('compatibility with source-locator', () => {
    it('should produce output parseable by parseDocumentTextToParagraphs', async () => {
      const buffer = await createMultiPagePdf([
        [
          { text: 'Introduction', fontSize: 16 },
          { text: 'This is the introduction text of the document.', fontSize: 10 },
        ],
        [
          { text: 'Requirements', fontSize: 16 },
          { text: 'The project requires React and TypeScript support.', fontSize: 10 },
        ],
      ]);

      const markerText = await extractTextDeterministic(buffer);

      // Wrap with DOC marker like the real pipeline does
      const docText = `[[DOC]] test.pdf\n${markerText}\n[[ENDDOC]]`;
      const nodes = parseDocumentTextToParagraphs(docText);

      expect(nodes.length).toBeGreaterThan(0);

      // All nodes should have source locators
      for (const node of nodes) {
        expect(node.source).toBeDefined();
        expect(node.source!.kind).toBe('pdf');
        expect(node.source!.fileName).toBe('test.pdf');
        expect(node.source!.page).toBeGreaterThan(0);
      }

      // Should have nodes from both pages
      const pages = new Set(nodes.map(n => n.source!.page));
      expect(pages.size).toBe(2);
      expect(pages.has(1)).toBe(true);
      expect(pages.has(2)).toBe(true);
    });
  });

  describe('E2E chunk compatibility', () => {
    it('should produce output that chunks correctly with chunkRawTextWithLocators', async () => {
      // Create a PDF with enough text to produce multiple chunks
      const longText =
        'Dies ist ein ausfuehrlicher Absatz der genug Text enthaelt um die minimale Chunk-Groesse ' +
        'zu ueberschreiten. Er beschreibt ein fiktives Projekt fuer die adesso SE. ' +
        'Das Projekt umfasst die Entwicklung einer neuen Webanwendung mit React und TypeScript. ' +
        'Die Anforderungen beinhalten Responsive Design, Barrierefreiheit und Performance-Optimierung. ' +
        'Der Kunde erwartet eine Lieferung bis Ende Q2 2025 mit einem Budget von 100.000 EUR. ' +
        'Weitere Anforderungen umfassen CI/CD, Docker-Deployment und umfassende Testabdeckung.';

      const buffer = await createMultiPagePdf([
        [
          { text: 'Projektuebersicht', fontSize: 16 },
          { text: longText, fontSize: 10 },
        ],
        [
          { text: 'Technische Anforderungen', fontSize: 16 },
          { text: longText, fontSize: 10 },
        ],
      ]);

      const markerText = await extractTextDeterministic(buffer);
      const docText = `[[DOC]] requirements.pdf\n${markerText}\n[[ENDDOC]]`;

      const chunks = chunkRawTextWithLocators(docText);

      expect(chunks.length).toBeGreaterThan(0);

      // Every chunk with source metadata should have valid page numbers
      for (const chunk of chunks) {
        if (chunk.metadata.source) {
          expect(chunk.metadata.source.kind).toBe('pdf');
          expect(chunk.metadata.source.fileName).toBe('requirements.pdf');
          expect(chunk.metadata.source.page).toBeGreaterThan(0);
          expect(chunk.metadata.source.page).toBeLessThanOrEqual(2);
        }
      }
    });
  });
});
