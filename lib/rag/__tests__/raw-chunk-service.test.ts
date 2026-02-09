import { describe, expect, it } from 'vitest';

import {
  chunkRawText,
  chunkRawTextWithLocators,
  estimateTokens,
  getChunkStats,
  type RawChunk,
} from '../raw-chunk-service';

describe('raw-chunk-service', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      // ~4 chars per token
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('12345678')).toBe(2);
      expect(estimateTokens('Dies ist ein Beispieltext mit mehreren Wörtern.')).toBe(12);
    });

    it('should handle German text with umlauts', () => {
      const germanText = 'Österreichische Änderungen für Übertragungen';
      const tokens = estimateTokens(germanText);
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('chunkRawText', () => {
    it('should return empty array for empty text', () => {
      expect(chunkRawText('')).toEqual([]);
      expect(chunkRawText('   ')).toEqual([]);
    });

    it('should filter out chunks smaller than MIN_CHUNK_SIZE (100 tokens)', () => {
      // Text with ~50 tokens (< 100)
      const shortText = 'Kurzer Text der nicht lang genug ist.';
      const chunks = chunkRawText(shortText);
      expect(chunks).toHaveLength(0);
    });

    it('should create single chunk for medium-sized text', () => {
      // Create text with ~150-200 tokens
      const mediumText =
        'Dies ist ein längerer Absatz mit genügend Text um die minimale Chunk-Größe zu erreichen. ' +
        'Er enthält mehrere Sätze und beschreibt ein fiktives Projekt für die adesso SE. ' +
        'Das Projekt umfasst die Entwicklung einer neuen Webanwendung mit React und TypeScript. ' +
        'Die Anforderungen beinhalten Responsive Design, Barrierefreiheit und Performance-Optimierung. ' +
        'Der Kunde erwartet eine Lieferung bis Ende Q2 2024 mit einem Budget von 100.000 EUR.';

      const chunks = chunkRawText(mediumText);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].content).toBeTruthy();
      expect(chunks[0].tokenCount).toBeGreaterThanOrEqual(100);
    });

    it('should split text by paragraph boundaries (double newlines)', () => {
      // Create text with multiple paragraphs, each ~200+ tokens
      const paragraph =
        'Dieser Absatz enthält genügend Text um die minimale Größe zu erreichen. ' +
        'Er beschreibt ausführlich ein Softwareprojekt mit allen relevanten Details. ' +
        'Die technischen Anforderungen umfassen moderne Webentwicklung mit React, TypeScript und Node.js. ' +
        'Zusätzlich werden Datenbankkenntnisse in PostgreSQL und MongoDB benötigt.';

      const multiParagraphText = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;

      const chunks = chunkRawText(multiParagraphText);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // Each chunk should respect paragraph boundaries
      chunks.forEach(chunk => {
        expect(chunk.metadata.type).toMatch(/paragraph|section|overflow/);
      });
    });

    it('should handle very long paragraphs by splitting into sentences', () => {
      // Create a single very long paragraph (~5000 chars / ~1250 tokens)
      const longParagraph = Array(50)
        .fill(
          'Dies ist ein sehr langer Satz der immer wieder wiederholt wird um einen großen Textblock zu erzeugen.'
        )
        .join(' ');

      const chunks = chunkRawText(longParagraph);
      expect(chunks.length).toBeGreaterThan(1);

      // All chunks should be within reasonable size limits
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(1100); // Allow some buffer over MAX
      });
    });

    it('should assign correct chunk indices', () => {
      const text =
        'Erster langer Absatz mit genügend Text. '.repeat(10) +
        '\n\n' +
        'Zweiter langer Absatz mit genügend Text. '.repeat(10) +
        '\n\n' +
        'Dritter langer Absatz mit genügend Text. '.repeat(10);

      const chunks = chunkRawText(text);

      // Check sequential indices
      chunks.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i);
      });
    });

    it('should include correct metadata', () => {
      const text =
        'Ein Absatz mit ausreichend Text für einen Chunk. '.repeat(15) +
        '\n\n' +
        'Ein zweiter Absatz mit mehr Text. '.repeat(15);

      const chunks = chunkRawText(text);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      chunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined();
        expect(typeof chunk.metadata.startPosition).toBe('number');
        expect(typeof chunk.metadata.endPosition).toBe('number');
        expect(['paragraph', 'section', 'overflow']).toContain(chunk.metadata.type);
      });
    });

    it('should handle realistic German Pre-Qualification text', () => {
      const rfpText = `
Ausschreibung: Relaunch Corporate Website

Die Mustermann GmbH, ein führender Anbieter von Industrielösungen mit Sitz in München,
sucht einen erfahrenen Dienstleister für den Relaunch ihrer Corporate Website.

Projektbeschreibung:
Die aktuelle Website basiert auf einem veralteten CMS (TYPO3 8.x) und soll auf ein
modernes, headless CMS migriert werden. Bevorzugt werden Drupal 10 oder Contentful.

Technische Anforderungen:
- Responsive Design für alle Endgeräte
- WCAG 2.1 AA Konformität erforderlich
- Multi-Language Support (DE, EN, FR)
- Integration mit Salesforce CRM
- Performance: Lighthouse Score > 90

Budget: 80.000 - 120.000 EUR netto
Zeitrahmen: Kick-off Q1 2024, Go-Live Q3 2024

Ansprechpartner:
Dr. Max Mustermann
CTO, Mustermann GmbH
Tel: +49 89 12345678
Email: m.mustermann@mustermann.de
`.trim();

      const chunks = chunkRawText(rfpText);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // Verify content is preserved
      const allContent = chunks.map(c => c.content).join(' ');
      expect(allContent).toContain('Mustermann');
      expect(allContent).toContain('Budget');
    });
  });

  describe('getChunkStats', () => {
    it('should return zero stats for empty chunks array', () => {
      const stats = getChunkStats([]);
      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.avgTokensPerChunk).toBe(0);
      expect(stats.minTokens).toBe(0);
      expect(stats.maxTokens).toBe(0);
    });

    it('should calculate correct statistics', () => {
      const mockChunks: RawChunk[] = [
        {
          chunkIndex: 0,
          content: 'Chunk 1',
          tokenCount: 100,
          metadata: { startPosition: 0, endPosition: 100, type: 'paragraph' },
        },
        {
          chunkIndex: 1,
          content: 'Chunk 2',
          tokenCount: 200,
          metadata: { startPosition: 100, endPosition: 300, type: 'paragraph' },
        },
        {
          chunkIndex: 2,
          content: 'Chunk 3',
          tokenCount: 150,
          metadata: { startPosition: 300, endPosition: 450, type: 'paragraph' },
        },
      ];

      const stats = getChunkStats(mockChunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.totalTokens).toBe(450);
      expect(stats.avgTokensPerChunk).toBe(150);
      expect(stats.minTokens).toBe(100);
      expect(stats.maxTokens).toBe(200);
    });
  });

  describe('chunkRawTextWithLocators', () => {
    it('should attach stable PDF locators (file/page/paragraph/heading) when markers exist', () => {
      const input = [
        '[[DOC]] A.pdf',
        '[[PASS text]]',
        '[[PAGE 15]]',
        '[[H]] Titel',
        '',
        'Absatz 1. '.repeat(60),
        '',
        'Absatz 2. '.repeat(60),
        '',
        'Absatz 3. '.repeat(60),
      ].join('\n');

      const chunks = chunkRawTextWithLocators(input);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // We want a chunk that covers paragraph 3 to exist.
      const withLocator = chunks.find(c => c.metadata.source?.page === 15);
      expect(withLocator).toBeTruthy();
      expect(withLocator!.metadata.source!.fileName).toBe('A.pdf');
      expect(withLocator!.metadata.source!.page).toBe(15);
      expect(withLocator!.metadata.source!.pass).toBe('text');
      expect(withLocator!.metadata.source!.paragraphStart).toBeGreaterThanOrEqual(1);
      expect(withLocator!.metadata.source!.paragraphEnd).toBeGreaterThanOrEqual(
        withLocator!.metadata.source!.paragraphStart
      );
      expect(withLocator!.metadata.source!.heading).toBe('Titel');
    });

    it('should never create chunks that cross page boundaries', () => {
      const pageText = (label: string) => `${label} `.repeat(120);
      const input = [
        '[[DOC]] A.pdf',
        '[[PASS text]]',
        '[[PAGE 1]]',
        pageText('Seite1-Absatz1'),
        '',
        pageText('Seite1-Absatz2'),
        '',
        '[[PASS tables]]',
        '[[PAGE 2]]',
        pageText('Seite2-Absatz1'),
        '',
        pageText('Seite2-Absatz2'),
      ].join('\n');

      const chunks = chunkRawTextWithLocators(input);
      const pages = new Set(chunks.map(c => c.metadata.source?.page).filter(Boolean));
      expect(pages.has(1)).toBe(true);
      expect(pages.has(2)).toBe(true);

      for (const chunk of chunks) {
        const src = chunk.metadata.source;
        if (!src) continue;
        expect(src.paragraphStart).toBeLessThanOrEqual(src.paragraphEnd);
        expect([1, 2]).toContain(src.page);
      }
    });

    it('should not mix different passes for the same page into a single chunk', () => {
      const input = [
        '[[DOC]] A.pdf',
        '[[PASS text]]',
        '[[PAGE 1]]',
        'Textpass Inhalt. '.repeat(80),
        '',
        '[[PASS tables]]',
        '[[PAGE 1]]',
        'Tabellenpass Inhalt. '.repeat(80),
      ].join('\n');

      const chunks = chunkRawTextWithLocators(input);
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      const passes = new Set(chunks.map(c => c.metadata.source?.pass).filter(Boolean));
      expect(passes.has('text')).toBe(true);
      expect(passes.has('tables')).toBe(true);

      for (const chunk of chunks) {
        const src = chunk.metadata.source;
        if (!src) continue;
        expect(src.fileName).toBe('A.pdf');
        expect(src.page).toBe(1);
      }
    });
  });
});
