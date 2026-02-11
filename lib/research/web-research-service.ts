/**
 * Web Research Service (DEA-144)
 *
 * Automatic data enrichment via web research when RAG confidence is low.
 * Uses OpenAI webSearchPreview via AI Hub for reliable web search.
 * Results are chunked, embedded, and stored in RAG for future queries.
 */

/* eslint-disable no-console */

import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { rawChunks } from '@/lib/db/schema';
import { chunkRawText } from '@/lib/rag/raw-chunk-service';
import { generateRawChunkEmbeddings } from '@/lib/rag/raw-embedding-service';
import { searchAndContents } from '@/lib/search/web-search';

export interface WebResearchQuery {
  preQualificationId: string;
  sectionId: string;
  question: string;
  maxResults?: number; // default: 3
}

export interface WebResearchResult {
  url: string;
  title: string;
  snippet: string;
  timestamp: Date;
  source: 'web';
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
function checkRateLimit(preQualificationId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(preQualificationId) || [];

  // Remove timestamps outside window
  const validTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  // Add current timestamp
  validTimestamps.push(now);
  rateLimitMap.set(preQualificationId, validTimestamps);

  return true;
}

/**
 * Search web using OpenAI webSearchPreview via AI Hub
 */
async function searchWeb(query: string, maxResults: number): Promise<WebResearchResult[]> {
  const { results, error } = await searchAndContents(query, { numResults: maxResults });

  if (error || !results.length) {
    console.error('[WEB-RESEARCH] Search failed:', error);
    return [];
  }

  return results.map(r => ({
    url: r.url,
    title: r.title,
    snippet: r.text?.slice(0, 500) || '',
    timestamp: new Date(),
    source: 'web' as const,
  }));
}

/**
 * Perform web research and store results in RAG
 *
 * Flow:
 * 1. Check rate limit
 * 2. Perform web search via OpenAI webSearchPreview
 * 3. Combine results into text
 * 4. Chunk text
 * 5. Generate embeddings
 * 6. Store in rawChunks with source metadata
 *
 * @param query - The research query
 * @returns Research response with results and stats
 */
export async function performWebResearch(query: WebResearchQuery): Promise<WebResearchResponse> {
  const { preQualificationId, sectionId, question, maxResults = 3 } = query;

  // 1. Check rate limit
  if (!checkRateLimit(preQualificationId)) {
    console.warn(`[WEB-RESEARCH] Rate limit exceeded for Qualification ${preQualificationId}`);
    return {
      success: false,
      results: [],
      chunksStored: 0,
      error: 'Rate limit exceeded. Please try again in a minute.',
    };
  }

  console.log(`[WEB-RESEARCH] Starting research for: "${question}" (section: ${sectionId})`);

  // 2. Perform web search
  const results = await searchWeb(question, maxResults);

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
    .map((r, idx) => `=== Result ${idx + 1}: ${r.title} ===\nSource: ${r.url}\n\n${r.snippet}\n\n`)
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
      .where(eq(rawChunks.preQualificationId, preQualificationId))
      .orderBy(desc(rawChunks.chunkIndex))
      .limit(1);

    const startIndex = existingChunks[0]?.chunkIndex ?? -1;

    await db.insert(rawChunks).values(
      chunksWithEmbeddings.map((chunk, idx) => ({
        preQualificationId: preQualificationId,
        chunkIndex: startIndex + idx + 1,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: chunk.embedding,
        metadata: JSON.stringify({
          ...chunk.metadata,
          // Do not use `metadata.source` (reserved for PDF locators).
          // This avoids downstream code treating web research as PDF citations.
          webSource: {
            url: results[0]?.url,
            title: results[0]?.title,
            accessedAt: results[0]?.timestamp?.toISOString?.() ?? new Date().toISOString(),
          },
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
 * Clear rate limit for a Qualification (useful for testing)
 */
export function clearRateLimit(preQualificationId: string): void {
  rateLimitMap.delete(preQualificationId);
}
