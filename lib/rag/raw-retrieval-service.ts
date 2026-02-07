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

import { generateQueryEmbedding, isEmbeddingEnabled } from '../ai/embedding-config';
import { db } from '../db';
import { rawChunks } from '../db/schema';

export interface RawRAGQuery {
  preQualificationId: string;
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

const STOP_WORDS = new Set([
  'der',
  'die',
  'das',
  'und',
  'oder',
  'mit',
  'für',
  'von',
  'auf',
  'in',
  'zu',
  'the',
  'and',
  'or',
  'with',
  'for',
  'from',
  'to',
  'of',
  'a',
  'an',
]);

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

/** Raw chunk shape from the database */
type DBChunk = {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: string | null;
  embedding: number[];
};

/**
 * Convert a DB chunk + computed similarity into a RawRAGResult.
 */
function toRAGResult(chunk: DBChunk, similarity: number): RawRAGResult {
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
}

/**
 * Keyword-based matching as fallback when embedding-based search is unavailable.
 * Scores chunks by the fraction of query terms found in each chunk.
 */
function keywordMatchChunks(
  chunks: DBChunk[],
  question: string,
  maxResults: number
): RawRAGResult[] {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter(term => term.length > 2 && !STOP_WORDS.has(term));

  const scored = chunks.map(chunk => {
    const content = chunk.content.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (content.includes(term)) score++;
    }
    const similarity = terms.length > 0 ? score / terms.length : 0;
    return toRAGResult(chunk, similarity);
  });

  return scored
    .filter(r => r.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * Query raw document chunks for relevant content
 *
 * Strategy:
 * 1. Fetch all raw chunks for this qualification
 * 2. If embeddings disabled or query embedding fails → keyword fallback
 * 3. Otherwise: cosine similarity with threshold + keyword fallback if no results
 *
 * @param query - The RAG query parameters
 * @returns Array of relevant chunks sorted by similarity
 */
export async function queryRawChunks(query: RawRAGQuery): Promise<RawRAGResult[]> {
  try {
    const chunks = await db
      .select()
      .from(rawChunks)
      .where(eq(rawChunks.preQualificationId, query.preQualificationId));

    if (chunks.length === 0) {
      return [];
    }

    const maxResults = query.maxResults || 5;
    const embeddingsEnabled = await isEmbeddingEnabled();

    if (!embeddingsEnabled) {
      return keywordMatchChunks(chunks, query.question, maxResults);
    }

    // Generate query embedding — falls back to keywords if this fails
    const queryEmbedding = await generateQueryEmbedding(query.question);

    if (!queryEmbedding) {
      console.warn('[RAG-RAW] Query embedding failed, falling back to keyword matching');
      return keywordMatchChunks(chunks, query.question, maxResults);
    }

    // Calculate similarity for each chunk
    const allResults = chunks.map(chunk => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return toRAGResult(chunk, similarity);
    });

    // Sort all results for logging
    allResults.sort((a, b) => b.similarity - a.similarity);

    const topSimilarities = allResults.slice(0, 3).map(r => r.similarity.toFixed(3));
    console.log(
      `[RAG-RAW] Query "${query.question.substring(0, 30)}..." - Top similarities: [${topSimilarities.join(', ')}], Threshold: ${SIMILARITY_THRESHOLD}`
    );

    // Filter by threshold (order preserved from sort above)
    const resultsWithSimilarity = allResults.filter(
      result => result.similarity > SIMILARITY_THRESHOLD
    );

    if (resultsWithSimilarity.length > 0) {
      return resultsWithSimilarity.slice(0, maxResults);
    }

    // Fallback: keyword match when semantic search yields nothing
    return keywordMatchChunks(chunks, query.question, maxResults);
  } catch (error) {
    console.error('[RAG-RAW] Query failed:', error);
    return [];
  }
}

/**
 * Query multiple topics in parallel and combine results
 * Useful for collecting diverse context for extraction
 *
 * @param preQualificationId - The qualification ID to query
 * @param topics - Array of topic queries
 * @returns Combined and deduplicated results
 */
export async function queryMultipleTopics(
  preQualificationId: string,
  topics: Array<{ topic: string; maxResults?: number }>
): Promise<Map<string, RawRAGResult[]>> {
  const results = new Map<string, RawRAGResult[]>();

  // Run queries in parallel (queryRawChunks handles embedding fallback internally)
  const queries = topics.map(async ({ topic, maxResults }) => {
    const topicResults = await queryRawChunks({
      preQualificationId,
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
