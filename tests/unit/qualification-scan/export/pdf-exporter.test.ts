import { describe, it, expect } from 'vitest';

import { generatePrintableHTML } from '@/lib/qualification-scan/export/pdf-exporter';

describe('generatePrintableHTML', () => {
  it('should return a complete HTML document', () => {
    const html = generatePrintableHTML('# Hello');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('</html>');
  });

  it('should include proper head with meta and styles', () => {
    const html = generatePrintableHTML('test');
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain('<title>Qualification Scan Export</title>');
    expect(html).toContain('@media print');
  });

  it('should convert H1 headings', () => {
    const html = generatePrintableHTML('# Main Title');
    expect(html).toContain('<h1>Main Title</h1>');
  });

  it('should convert H2 headings', () => {
    const html = generatePrintableHTML('## Section');
    expect(html).toContain('<h2>Section</h2>');
  });

  it('should convert H3 headings', () => {
    const html = generatePrintableHTML('### Subsection');
    expect(html).toContain('<h3>Subsection</h3>');
  });

  it('should convert bold text', () => {
    const html = generatePrintableHTML('This is **bold** text');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('should convert horizontal rules', () => {
    const html = generatePrintableHTML('above\n---\nbelow');
    expect(html).toContain('<hr />');
  });

  it('should convert blockquotes', () => {
    const html = generatePrintableHTML('> Important note');
    expect(html).toContain('<blockquote>Important note</blockquote>');
  });

  it('should convert bullet lists into <ul>/<li>', () => {
    const html = generatePrintableHTML('- Item 1\n- Item 2');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
    expect(html).toContain('<ul>');
  });

  it('should convert markdown tables', () => {
    const md = '| CMS | Score |\n|-----|-------|\n| Drupal | 85 |\n| WP | 72 |';
    const html = generatePrintableHTML(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>CMS</th>');
    expect(html).toContain('<th>Score</th>');
    expect(html).toContain('<td>Drupal</td>');
    expect(html).toContain('<td>85</td>');
  });

  it('should escape HTML entities for security', () => {
    const html = generatePrintableHTML('Test <script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should wrap plain text lines in <p> tags', () => {
    const html = generatePrintableHTML('Just a paragraph');
    expect(html).toContain('<p>Just a paragraph</p>');
  });

  it('should skip empty lines without wrapping them', () => {
    const html = generatePrintableHTML('Line 1\n\nLine 2');
    // Empty lines should not produce <p></p>
    expect(html).not.toContain('<p></p>');
  });

  it('should handle complex mixed markdown', () => {
    const md = [
      '# Qualification Scan — ACME Corp',
      '',
      '**Website:** https://acme.com',
      '',
      '---',
      '',
      '## Technologie-Stack',
      '- **CMS:** WordPress',
      '- **Framework:** PHP',
      '',
      '> **Notizen:**',
      '> - Client bestätigt',
    ].join('\n');

    const html = generatePrintableHTML(md);
    expect(html).toContain('<h1>Qualification Scan');
    expect(html).toContain('<h2>Technologie-Stack</h2>');
    expect(html).toContain('<strong>CMS:</strong>');
    expect(html).toContain('<hr />');
    expect(html).toContain('<blockquote>');
  });
});
