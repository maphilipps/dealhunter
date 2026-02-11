import { describe, expect, it } from 'vitest';

import { formatInlineSourceRef } from '../sources';

describe('formatInlineSourceRef', () => {
  it('labels web references as enrichment', () => {
    const formatted = formatInlineSourceRef({
      kind: 'web',
      url: 'https://example.com',
      accessedAt: '2026-02-11T10:00:00.000Z',
    });

    expect(formatted).toContain('Quelle (Web-Enrichment):');
    expect(formatted).toContain('https://example.com');
  });
});
