/**
 * RAW Retrieval Service (DEA-108)
 *
 * Retrieves relevant raw document chunks using semantic similarity.
 * Used by EXTRACT Agent to get context-specific information.
 *
 * Requires OPENAI_EMBEDDING_API_KEY to be set.
 * If not configured, returns empty results.
 */

import { eq, sql } from 'drizzle-orm';

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

/** Raw chunk shape from the database */
type DBChunk = {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: string | null;
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

async function fetchChunksForKeyword(preQualificationId: string): Promise<DBChunk[]> {
  return db
    .select({
      id: rawChunks.id,
      chunkIndex: rawChunks.chunkIndex,
      content: rawChunks.content,
      tokenCount: rawChunks.tokenCount,
      metadata: rawChunks.metadata,
    })
    .from(rawChunks)
    .where(eq(rawChunks.preQualificationId, preQualificationId));
}

/**
 * Query raw document chunks for relevant content
 *
 * Strategy:
 * 1. If embeddings disabled or query embedding fails → keyword fallback (without selecting embeddings)
 * 2. Otherwise: pgvector similarity search in PostgreSQL (no embedding transfer to Node.js)
 * 3. Keyword fallback if semantic search yields nothing
 *
 * @param query - The RAG query parameters
 * @returns Array of relevant chunks sorted by similarity
 */
export async function queryRawChunks(query: RawRAGQuery): Promise<RawRAGResult[]> {
  try {
    const maxResults = query.maxResults || 5;
    const embeddingsEnabled = await isEmbeddingEnabled();

    if (!embeddingsEnabled) {
      const chunks = await fetchChunksForKeyword(query.preQualificationId);
      if (chunks.length === 0) return [];
      return keywordMatchChunks(chunks, query.question, maxResults);
    }

    // Generate query embedding — falls back to keywords if this fails
    const queryEmbedding = await generateQueryEmbedding(query.question);

    if (!queryEmbedding) {
      console.warn('[RAG-RAW] Query embedding failed, falling back to keyword matching');
      const chunks = await fetchChunksForKeyword(query.preQualificationId);
      if (chunks.length === 0) return [];
      return keywordMatchChunks(chunks, query.question, maxResults);
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await db.execute(sql`
      SELECT
        id,
        chunk_index,
        content,
        token_count,
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM raw_chunks
      WHERE pre_qualification_id = ${query.preQualificationId}
        AND (1 - (embedding <=> ${embeddingStr}::vector)) > ${SIMILARITY_THRESHOLD}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${maxResults}
    `);

    const rows = results.rows as Array<{
      id: string;
      chunk_index: number;
      content: string;
      token_count: number;
      metadata: string | null;
      similarity: number;
    }>;

    const topSimilarities = rows.slice(0, 3).map(r => Number(r.similarity).toFixed(3));
    console.log(
      `[RAG-RAW] Query "${query.question.substring(0, 30)}..." - Top similarities: [${topSimilarities.join(', ')}], Threshold: ${SIMILARITY_THRESHOLD}`
    );

    if (rows.length > 0) {
      return rows.map(row =>
        toRAGResult(
          {
            id: row.id,
            chunkIndex: row.chunk_index,
            content: row.content,
            tokenCount: row.token_count,
            metadata: row.metadata,
          },
          Number(row.similarity)
        )
      );
    }

    const chunks = await fetchChunksForKeyword(query.preQualificationId);
    if (chunks.length === 0) return [];
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
