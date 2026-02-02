import { z } from 'zod';

import { registry } from './registry';

import { queryRAG } from '@/lib/rag/retrieval-service';
import { searchAndContents, getContents } from '@/lib/search/web-search';

registry.register({
  name: 'scan.webSearch',
  description: 'Search the web for company, technology, or compliance information',
  category: 'scan',
  inputSchema: z.object({
    query: z.string(),
    numResults: z.number().min(1).max(10).default(5),
    fetchContent: z.boolean().default(false),
  }),
  async execute(input) {
    const results = await searchAndContents(input.query, {
      numResults: input.numResults,
      summary: input.fetchContent,
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
  name: 'scan.fetchUrl',
  description: 'Fetch the text contents of a URL for scan enrichment',
  category: 'scan',
  inputSchema: z.object({
    url: z.string().url(),
  }),
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
  description: 'Query RAG for a pre-qualification',
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
