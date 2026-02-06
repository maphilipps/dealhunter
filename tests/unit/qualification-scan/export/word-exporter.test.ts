import { describe, it, expect, vi } from 'vitest';

// Mock docx Packer
vi.mock('docx', async () => {
  const actual = await vi.importActual('docx');
  return {
    ...actual,
    Packer: {
      toBuffer: vi.fn().mockResolvedValue(new Uint8Array([80, 75, 3, 4])), // ZIP magic bytes (docx is a zip)
    },
  };
});

import { generateWordDocument } from '@/lib/qualification-scan/export/word-exporter';

describe('generateWordDocument', () => {
  it('should return a Buffer', async () => {
    const md = '# Test Document\n\nHello world';
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle H1, H2, H3 headings', async () => {
    const md = '# Heading 1\n## Heading 2\n### Heading 3\n';
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle bullet lists', async () => {
    const md = '- Item 1\n- Item 2\n- **Bold item**\n';
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle tables', async () => {
    const md = [
      '| CMS | Score |',
      '|-----|-------|',
      '| Drupal | 85 |',
      '| WordPress | 72 |',
      '',
    ].join('\n');
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle blockquotes', async () => {
    const md = '> **Notizen:**\n> - Hinweis 1\n';
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle horizontal rules', async () => {
    const md = 'Above\n---\nBelow\n';
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle bold text inline', async () => {
    const md = 'This is **bold** text and **more bold** here\n';
    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle empty input', async () => {
    const result = await generateWordDocument('');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle complex mixed markdown', async () => {
    const md = [
      '# Qualification Scan — ACME Corp',
      '',
      '**Website:** https://acme.com',
      '**Status:** completed',
      '',
      '---',
      '',
      '## Technologie-Stack',
      '',
      '- **CMS:** WordPress (6.4)',
      '- **Framework:** PHP',
      '',
      '> **Notizen:**',
      '> - Confirmed by client',
      '',
      '## CMS-Matrix',
      '',
      '| CMS | Score | Kategorie |',
      '|-----|-------|-----------|',
      '| Drupal | 85 | Enterprise |',
      '| WordPress | 72 | Mid-range |',
    ].join('\n');

    const result = await generateWordDocument(md);
    expect(result).toBeInstanceOf(Buffer);
  });
});
