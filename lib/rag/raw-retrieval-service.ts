/**
 * RAW Retrieval Service (DEA-108)
 *
 * Retrieves relevant raw document chunks using semantic similarity.
 * Used by EXTRACT Agent to get context-specific information.
 *
 * Requires OPENAI_EMBEDDING_API_KEY to be set.
 * If not configured, returns empty results.
 */

import { eq } from 'drizzle-orm';

import { generateQueryEmbedding, isEmbeddingEnabled } from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { rawChunks } from '@/lib/db/schema';

export interface RawRAGQuery {
  rfpId: string;
  question: string;
  maxResults?: number; // default: 5
}

export interface RawRAGResult {
  chunkId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  tokenCount: number;
  metadata: {
    startPosition: number;
    endPosition: number;
    type: string;
  };
}

// Cross-lingual queries need lower threshold
// Using 0.2 - bilingual queries help but still need flexibility
const SIMILARITY_THRESHOLD = 0.2;

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Query raw document chunks for relevant content
 *
 * Strategy:
 * 1. Check if embeddings are enabled
 * 2. Generate embedding for query
 * 3. Fetch all raw chunks for this RFP
 * 4. Calculate cosine similarity for each chunk
 * 5. Filter by threshold (>0.7)
 * 6. Sort by similarity DESC
 * 7. Return top N results
 *
 * @param query - The RAG query parameters
 * @returns Array of relevant chunks sorted by similarity
 */
export async function queryRawChunks(query: RawRAGQuery): Promise<RawRAGResult[]> {
  // Check if embeddings are enabled
  if (!isEmbeddingEnabled()) {
    return [];
  }

  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query.question);

    if (!queryEmbedding) {
      return [];
    }

    // 2. Fetch all raw chunks for this RFP
    const chunks = await db
      .select()
      .from(rawChunks)
      .where(eq(rawChunks.rfpId, query.rfpId));

    if (chunks.length === 0) {
      return [];
    }

    // 3. Calculate similarity for each chunk
    const allResults = chunks.map(chunk => {
      const chunkEmbedding = JSON.parse(chunk.embedding) as number[];
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

      const metadata = chunk.metadata
        ? (JSON.parse(chunk.metadata) as RawRAGResult['metadata'])
        : { startPosition: 0, endPosition: 0, type: 'unknown' };

      return {
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        similarity,
        tokenCount: chunk.tokenCount,
        metadata,
      };
    });

    // Sort all results for logging
    allResults.sort((a, b) => b.similarity - a.similarity);

    // Debug: Log top similarities
    const topSimilarities = allResults.slice(0, 3).map(r => r.similarity.toFixed(3));
    console.log(
      `[RAG-RAW] Query "${query.question.substring(0, 30)}..." - Top similarities: [${topSimilarities.join(', ')}], Threshold: ${SIMILARITY_THRESHOLD}`
    );

    // 4. Filter by threshold
    const resultsWithSimilarity = allResults.filter(
      result => result.similarity > SIMILARITY_THRESHOLD
    );

    // 5. Sort by similarity DESC
    resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // 6. Return top N results
    const maxResults = query.maxResults || 5;
    return resultsWithSimilarity.slice(0, maxResults);
  } catch (error) {
    console.error('[RAG-RAW] Query failed:', error);
    return [];
  }
}

/**
 * Query multiple topics in parallel and combine results
 * Useful for collecting diverse context for extraction
 *
 * @param rfpId - The RFP ID to query
 * @param topics - Array of topic queries
 * @returns Combined and deduplicated results
 */
export async function queryMultipleTopics(
  rfpId: string,
  topics: Array<{ topic: string; maxResults?: number }>
): Promise<Map<string, RawRAGResult[]>> {
  const results = new Map<string, RawRAGResult[]>();

  // Check if embeddings are enabled first
  if (!isEmbeddingEnabled()) {
    // Return empty map for all topics
    for (const { topic } of topics) {
      results.set(topic, []);
    }
    return results;
  }

  // Run queries in parallel
  const queries = topics.map(async ({ topic, maxResults }) => {
    const topicResults = await queryRawChunks({
      rfpId,
      question: topic,
      maxResults: maxResults || 3,
    });
    return { topic, results: topicResults };
  });

  const allResults = await Promise.all(queries);

  for (const { topic, results: topicResults } of allResults) {
    results.set(topic, topicResults);
  }

  return results;
}

/**
 * Format RAG results into a context string for prompts
 *
 * @param results - RAG query results
 * @param label - Optional label for the context section
 * @returns Formatted context string
 */
export function formatRAGContext(results: RawRAGResult[], label?: string): string {
  if (results.length === 0) {
    return '';
  }

  const header = label ? `### ${label}\n\n` : '';
  const chunks = results
    .map(r => `[Relevanz: ${Math.round(r.similarity * 100)}%]\n${r.content}`)
    .join('\n\n---\n\n');

  return `${header}${chunks}`;
}

/**
 * Build combined context from multiple topic queries
 *
 * @param topicResults - Map of topic to results
 * @returns Formatted context string with all topics
 */
export function buildCombinedContext(topicResults: Map<string, RawRAGResult[]>): string {
  const sections: string[] = [];

  for (const [topic, results] of topicResults) {
    if (results.length > 0) {
      sections.push(formatRAGContext(results, topic));
    }
  }

  return sections.join('\n\n');
}
