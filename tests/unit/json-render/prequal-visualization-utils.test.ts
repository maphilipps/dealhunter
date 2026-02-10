import { describe, it, expect } from 'vitest';

import {
  injectSourcesPanel,
  parseMarkdownTable,
} from '@/lib/json-render/prequal-visualization-utils';

describe('parseMarkdownTable', () => {
  it('parses a simple GFM table and strips inline markdown', () => {
    const md = `
Relevante Tabelle:
| Nr. | Bezeichnung | Gesamtbetrag netto (EUR) |
| :--- | :--- | :--- |
| **7** | **Anzeigenmanagement**<br>für Jahr 1 | 1.234,00 |
| 8 | Sonstiges | 999 |
    `.trim();

    const parsed = parseMarkdownTable(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.columns.map(c => c.label)).toEqual([
      'Nr.',
      'Bezeichnung',
      'Gesamtbetrag netto (EUR)',
    ]);
    expect(parsed!.rows).toHaveLength(2);
    expect(parsed!.rows[0]).toEqual({
      col0: '7',
      col1: 'Anzeigenmanagement für Jahr 1',
      col2: '1.234,00',
    });
  });
});

describe('injectSourcesPanel', () => {
  it('appends a sources subsection and dedupes by citation', () => {
    const tree = {
      root: 'section-main',
      elements: {
        'section-main': {
          key: 'section-main',
          type: 'Section',
          props: { title: 'Budget' },
          children: ['summary'],
        },
        summary: { key: 'summary', type: 'Paragraph', props: { text: '...' } },
      },
    };

    const injected = injectSourcesPanel(tree as any, [
      { citation: 'Dokument.pdf, Seite 1, Absatz 1', excerpt: 'foo', score: 0.9 },
      { citation: 'Dokument.pdf, Seite 1, Absatz 1', excerpt: 'bar', score: 0.8 },
    ]);

    expect(injected.elements['section-main'].children).toContain('__auto_sources_sub');
    expect(injected.elements['__auto_sources_panel']).toBeDefined();
    const panel = injected.elements['__auto_sources_panel'];
    expect(panel.type).toBe('SourcesPanel');
    const sources = (panel.props as any).sources as Array<{ citation: string }>;
    expect(sources).toHaveLength(1);
    expect(sources[0].citation).toBe('Dokument.pdf, Seite 1, Absatz 1');
  });

  it('avoids key collisions with reserved auto keys', () => {
    const tree = {
      root: 'section-main',
      elements: {
        'section-main': {
          key: 'section-main',
          type: 'Section',
          props: { title: 'Budget' },
          children: ['summary'],
        },
        summary: { key: 'summary', type: 'Paragraph', props: { text: '...' } },
        __auto_sources_sub: { key: '__auto_sources_sub', type: 'Paragraph', props: { text: 'x' } },
      },
    };

    const injected = injectSourcesPanel(tree as any, [{ citation: 'Dok.pdf, Seite 2, Absatz 3' }]);
    const children = injected.elements['section-main'].children ?? [];
    expect(children.some(k => k.startsWith('__auto_sources_sub'))).toBe(true);
    expect(
      injected.elements['__auto_sources_panel'] || injected.elements['__auto_sources_panel_2']
    ).toBeDefined();
  });
});
