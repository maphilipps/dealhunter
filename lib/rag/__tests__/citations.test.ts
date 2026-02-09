import { describe, expect, it } from 'vitest';

import { formatSourceCitation } from '../citations';

describe('citations', () => {
  it('should format a single-paragraph PDF citation with heading', () => {
    const s = formatSourceCitation({
      kind: 'pdf',
      fileName: 'Dokument.pdf',
      page: 15,
      paragraphStart: 3,
      paragraphEnd: 3,
      heading: 'Überschrift',
    });

    expect(s).toBe('Dokument.pdf, Seite 15, Absatz 3, \"Überschrift\"');
  });

  it('should format a paragraph range without heading', () => {
    const s = formatSourceCitation({
      kind: 'pdf',
      fileName: 'Dokument.pdf',
      page: 15,
      paragraphStart: 3,
      paragraphEnd: 4,
      heading: null,
    });

    expect(s).toBe('Dokument.pdf, Seite 15, Absatz 3-4');
  });

  it('should include the pass label for non-text citations', () => {
    const s = formatSourceCitation({
      kind: 'pdf',
      fileName: 'Dokument.pdf',
      pass: 'tables',
      page: 15,
      paragraphStart: 3,
      paragraphEnd: 3,
      heading: null,
    });

    expect(s).toBe('Dokument.pdf, Seite 15, Absatz 3, Tabellen');
  });
});
