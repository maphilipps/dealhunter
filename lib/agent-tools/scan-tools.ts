import { z } from 'zod';

import { registry } from './registry';
import type { ToolContext } from './types';

import { queryRAG } from '@/lib/rag/retrieval-service';
import { searchAndContents, getContents } from '@/lib/search/web-search';

const webSearchInputSchema = z.object({
  query: z.string(),
  numResults: z.number().min(1).max(10).default(5),
  fetchContent: z.boolean().default(false),
});

const fetchUrlInputSchema = z.object({
  url: z.string().url(),
});

registry.register({
  /** @deprecated Use scan.web_search instead */
  name: 'scan.webSearch',
  description:
    '[DEPRECATED: use scan.web_search] Search the web for company, technology, or compliance information',
  category: 'scan',
  inputSchema: webSearchInputSchema,
  async execute(input) {
    const results = await searchAndContents(input.query, {
      numResults: input.numResults,
    });

    return {
      success: results.results.length > 0,
      data: results.results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.text?.slice(0, 500) || '',
      })),
    };
  },
});

registry.register({
  /** @deprecated Use scan.fetch_url instead */
  name: 'scan.fetchUrl',
  description:
    '[DEPRECATED: use scan.fetch_url] Fetch the text contents of a URL for scan enrichment',
  category: 'scan',
  inputSchema: fetchUrlInputSchema,
  async execute(input) {
    const result = await getContents(input.url, { text: true });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        url: result.url,
        content: result.text?.slice(0, 10000) || '',
      },
    };
  },
});

registry.register({
  name: 'scan.rag.query',
  description: 'Query RAG for a qualification',
  category: 'scan',
  inputSchema: z.object({
    preQualificationId: z.string(),
    query: z.string(),
    techStackFilter: z.string().optional(),
    maxResults: z.number().min(1).max(20).default(10),
  }),
  async execute(input) {
    const results = await queryRAG({
      preQualificationId: input.preQualificationId,
      question: input.query,
      techStackFilter: input.techStackFilter,
      maxResults: input.maxResults,
    });
    return { success: true, data: results };
  },
});

// ============================================================================
// Snake_case aliases (canonical names per CLAUDE.md conventions)
// ============================================================================

registry.register({
  name: 'scan.web_search',
  description: 'Search the web for company, technology, or compliance information',
  category: 'scan',
  inputSchema: webSearchInputSchema,
  async execute(input, context: ToolContext) {
    return registry.execute('scan.webSearch', input, context);
  },
});

registry.register({
  name: 'scan.fetch_url',
  description: 'Fetch the text contents of a URL for scan enrichment',
  category: 'scan',
  inputSchema: fetchUrlInputSchema,
  async execute(input, context: ToolContext) {
    return registry.execute('scan.fetchUrl', input, context);
  },
});
