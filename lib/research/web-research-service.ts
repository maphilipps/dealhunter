/**
 * Web Research Service (DEA-144)
 *
 * Automatic data enrichment via web research when RAG confidence is low.
 * Uses Exa API (primary) with fallback to native web search.
 * Results are chunked, embedded, and stored in RAG for future queries.
 */

/* eslint-disable no-console */

import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { rawChunks } from '@/lib/db/schema';
import { chunkRawText } from '@/lib/rag/raw-chunk-service';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';

export interface WebResearchQuery {
  rfpId: string;
  sectionId: string;
  question: string;
  maxResults?: number; // default: 3
}

export interface WebResearchResult {
  url: string;
  title: string;
  snippet: string;
  timestamp: Date;
  source: 'exa' | 'native';
}

export interface WebResearchResponse {
  success: boolean;
  results: WebResearchResult[];
  chunksStored: number;
  error?: string;
}

// Rate limiting: max 5 requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, number[]>();

/**
 * Check if rate limit allows another request
 */
function checkRateLimit(rfpId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(rfpId) || [];

  // Remove timestamps outside window
  const validTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  // Add current timestamp
  validTimestamps.push(now);
  rateLimitMap.set(rfpId, validTimestamps);

  return true;
}

/**
 * Search web using Exa API
 * Returns null if Exa API is not configured
 */
async function searchWithExa(
  query: string,
  maxResults: number
): Promise<WebResearchResult[] | null> {
  const exaApiKey = process.env.EXA_API_KEY;

  if (!exaApiKey || exaApiKey.trim() === '') {
    console.log('[WEB-RESEARCH] Exa API key not configured, skipping Exa search');
    return null;
  }

  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${exaApiKey}`,
      },
      body: JSON.stringify({
        query,
        numResults: maxResults,
        useAutoprompt: true, // Let Exa optimize the query
        type: 'neural', // Semantic search
        contents: {
          text: true,
          highlights: true,
        },
      }),
    });

    if (!response.ok) {
      console.error('[WEB-RESEARCH] Exa API error:', response.status, response.statusText);
      return null;
    }

    const data = (await response.json()) as {
      results: Array<{
        url: string;
        title: string;
        text?: string;
        highlights?: string[];
      }>;
    };

    return data.results.map(result => ({
      url: result.url,
      title: result.title,
      snippet: result.highlights?.[0] || result.text?.slice(0, 500) || '',
      timestamp: new Date(),
      source: 'exa' as const,
    }));
  } catch (error) {
    console.error('[WEB-RESEARCH] Exa API request failed:', error);
    return null;
  }
}

/**
 * Search web using native web search (fallback)
 * Note: This requires the web-search MCP to be available
 * Currently placeholder - can be implemented when MCP wrapper is available
 */
async function searchWithNative(
  query: string,
  maxResults: number
): Promise<WebResearchResult[]> {
  console.log(
    `[WEB-RESEARCH] Native web search not yet implemented (query: "${query}", maxResults: ${maxResults})`
  );
  // TODO: Implement when web-search MCP wrapper is available
  // For now, return empty to allow graceful degradation
  return [];
}

/**
 * Perform web research and store results in RAG
 *
 * Flow:
 * 1. Check rate limit
 * 2. Try Exa API first
 * 3. Fallback to native web search if Exa fails
 * 4. Combine results into text
 * 5. Chunk text
 * 6. Generate embeddings
 * 7. Store in rawChunks with source metadata
 *
 * @param query - The research query
 * @returns Research response with results and stats
 */
export async function performWebResearch(
  query: WebResearchQuery
): Promise<WebResearchResponse> {
  const { rfpId, sectionId, question, maxResults = 3 } = query;

  // 1. Check rate limit
  if (!checkRateLimit(rfpId)) {
    console.warn(`[WEB-RESEARCH] Rate limit exceeded for RFP ${rfpId}`);
    return {
      success: false,
      results: [],
      chunksStored: 0,
      error: 'Rate limit exceeded. Please try again in a minute.',
    };
  }

  console.log(`[WEB-RESEARCH] Starting research for: "${question}" (section: ${sectionId})`);

  // 2. Try Exa API first
  let results = await searchWithExa(question, maxResults);

  // 3. Fallback to native web search
  if (!results || results.length === 0) {
    console.log('[WEB-RESEARCH] Falling back to native web search');
    results = await searchWithNative(question, maxResults);
  }

  if (results.length === 0) {
    console.warn('[WEB-RESEARCH] No results found from any source');
    return {
      success: true,
      results: [],
      chunksStored: 0,
      error: 'No search results found',
    };
  }

  console.log(`[WEB-RESEARCH] Found ${results.length} results from ${results[0].source}`);

  // 4. Combine results into text for chunking
  const combinedText = results
    .map(
      (r, idx) =>
        `=== Result ${idx + 1}: ${r.title} ===\nSource: ${r.url}\n\n${r.snippet}\n\n`
    )
    .join('\n');

  try {
    // 5. Chunk the research text
    const chunks = chunkRawText(combinedText);

    if (chunks.length === 0) {
      console.warn('[WEB-RESEARCH] No chunks generated from results');
      return {
        success: true,
        results,
        chunksStored: 0,
      };
    }

    // 6. Generate embeddings
    const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

    if (!chunksWithEmbeddings) {
      console.warn('[WEB-RESEARCH] Embedding generation failed or disabled');
      return {
        success: true,
        results,
        chunksStored: 0,
        error: 'Embeddings not available',
      };
    }

    // 7. Store in rawChunks with enhanced metadata
    const existingChunks = await db
      .select({ chunkIndex: rawChunks.chunkIndex })
      .from(rawChunks)
      .where(eq(rawChunks.rfpId, rfpId))
      .orderBy(desc(rawChunks.chunkIndex))
      .limit(1);

    const startIndex = existingChunks[0]?.chunkIndex ?? -1;

    await db.insert(rawChunks).values(
      chunksWithEmbeddings.map((chunk, idx) => ({
        rfpId,
        chunkIndex: startIndex + idx + 1,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: JSON.stringify(chunk.embedding),
        metadata: JSON.stringify({
          ...chunk.metadata,
          source: 'web_research',
          sectionId,
          query: question,
          researchSource: results[0].source,
          urls: results.map(r => r.url),
          timestamp: new Date().toISOString(),
        }),
      }))
    );

    console.log(
      `[WEB-RESEARCH] Stored ${chunksWithEmbeddings.length} chunks from ${results.length} results`
    );

    return {
      success: true,
      results,
      chunksStored: chunksWithEmbeddings.length,
    };
  } catch (error) {
    console.error('[WEB-RESEARCH] Failed to process research results:', error);
    return {
      success: false,
      results,
      chunksStored: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear rate limit for an RFP (useful for testing)
 */
export function clearRateLimit(rfpId: string): void {
  rateLimitMap.delete(rfpId);
}
