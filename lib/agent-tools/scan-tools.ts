import { z } from 'zod';

import { registry } from './registry';

import { cacheAuditPagesFromEmbeddings } from '@/lib/deep-scan/audit-cache';
import { queryLeadRag } from '@/lib/deep-scan/experts/base';
import { embedScrapedPage, scrapeSite } from '@/lib/deep-scan/scraper';
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
  description: 'Query RAG for either a pre-qualification or lead',
  category: 'scan',
  inputSchema: z.object({
    preQualificationId: z.string().optional(),
    leadId: z.string().optional(),
    query: z.string(),
    agentFilter: z.string().optional(),
    techStackFilter: z.string().optional(),
    maxResults: z.number().min(1).max(20).default(10),
  }),
  async execute(input) {
    if (input.leadId) {
      const results = await queryLeadRag(
        input.leadId,
        input.query,
        input.agentFilter,
        input.maxResults
      );
      return { success: true, data: results };
    }

    if (input.preQualificationId) {
      const results = await queryRAG({
        preQualificationId: input.preQualificationId,
        question: input.query,
        techStackFilter: input.techStackFilter,
        maxResults: input.maxResults,
      });
      return { success: true, data: results };
    }

    return { success: false, error: 'Either leadId or preQualificationId is required' };
  },
});

registry.register({
  name: 'scan.scrapeSite',
  description: 'Scrape a website and store page data in the scan RAG store (leadId required)',
  category: 'scan',
  inputSchema: z.object({
    leadId: z.string(),
    websiteUrl: z.string().url(),
    maxPages: z.number().min(1).max(60).default(30),
    maxDepth: z.number().min(1).max(6).default(3),
    includeScreenshots: z.boolean().default(true),
    includeMobile: z.boolean().default(false),
  }),
  async execute(input) {
    const pages: number[] = [];
    const result = await scrapeSite(
      input.websiteUrl,
      {
        maxPages: input.maxPages,
        maxDepth: input.maxDepth,
        includeScreenshots: input.includeScreenshots,
        includeMobile: input.includeMobile,
      },
      async page => {
        await embedScrapedPage(input.leadId, page);
        pages.push(1);
      }
    );

    return {
      success: result.success,
      data: {
        pagesScraped: pages.length,
        sitemapFound: result.sitemapFound,
        techStack: result.techStack,
        errors: result.errors,
      },
    };
  },
});

registry.register({
  name: 'scan.cacheAuditPages',
  description: 'Cache audit section pages from existing audit embeddings (leadId required)',
  category: 'scan',
  inputSchema: z.object({
    leadId: z.string(),
  }),
  async execute(input) {
    const result = await cacheAuditPagesFromEmbeddings(input.leadId);
    return { success: result.success, data: result };
  },
});
