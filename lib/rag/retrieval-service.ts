/**
 * RAG Retrieval Service (DEA-107)
 *
 * Hybrid retrieval strategy:
 * 1. Generate query embedding
 * 2. Vector similarity search via pgvector
 * 3. Optional tech stack filtering
 * 4. Threshold filtering (similarity > 0.7)
 * 5. Ranking by similarity
 */

import { eq } from 'drizzle-orm';

import { generateQueryEmbedding } from './embedding-service';

import { db } from '@/lib/db';
import { dealEmbeddings } from '@/lib/db/schema';

export interface RAGQuery {
  preQualificationId: string;
  question: string;
  techStackFilter?: string; // e.g., "Drupal"
  maxResults?: number; // default: 5
}

export interface RAGResult {
  chunkId: string;
  agentName: string;
  chunkType: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

const SIMILARITY_THRESHOLD = 0.7;

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
 * Query RAG knowledge base for relevant chunks
 *
 * Strategy:
 * 1. Generate embedding for query
 * 2. Fetch all chunks for this pre-qualification
 * 3. Calculate cosine similarity for each chunk
 * 4. Filter by threshold (>0.7)
 * 5. Optional tech stack filter
 * 6. Sort by similarity DESC
 * 7. Return top N results
 */
export async function queryRAG(query: RAGQuery): Promise<RAGResult[]> {
  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query.question);

    // Early return if embeddings are disabled or query embedding failed
    if (!queryEmbedding) {
      return [];
    }

    // 2. Fetch all chunks for this pre-qualification
    const chunks = await db
      .select()
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, query.preQualificationId));

    if (chunks.length === 0) {
      return [];
    }

    // 3. Calculate similarity for each chunk (filter out chunks without embeddings)
    const resultsWithSimilarity = chunks
      .filter(chunk => chunk.embedding !== null)
      .map(chunk => {
        const chunkEmbedding = chunk.embedding!;
        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

        const metadata = chunk.metadata ? JSON.parse(chunk.metadata) : {};

        return {
          chunkId: chunk.id,
          agentName: chunk.agentName,
          chunkType: chunk.chunkType,
          content: chunk.content,
          similarity,
          metadata,
        };
      })
      // 4. Filter by threshold
      .filter(result => result.similarity > SIMILARITY_THRESHOLD);

    // 5. Optional tech stack filter
    let filteredResults = resultsWithSimilarity;
    if (query.techStackFilter) {
      filteredResults = resultsWithSimilarity.filter(result => {
        const cms = result.metadata.cms as string | undefined;
        const framework = result.metadata.framework as string | undefined;
        return (
          cms?.toLowerCase().includes(query.techStackFilter!.toLowerCase()) ||
          framework?.toLowerCase().includes(query.techStackFilter!.toLowerCase())
        );
      });

      // If tech stack filter yields no results, fall back to all results
      if (filteredResults.length === 0) {
        filteredResults = resultsWithSimilarity;
      }
    }

    // 6. Sort by similarity DESC
    filteredResults.sort((a, b) => b.similarity - a.similarity);

    // 7. Return top N results
    const maxResults = query.maxResults || 5;
    return filteredResults.slice(0, maxResults);
  } catch (error) {
    console.error('[RAG] Query failed:', error);
    return [];
  }
}

/**
 * Get embedding status for a pre-qualification
 * Useful for debugging which agents have embedded data
 */
export async function getEmbeddingStatus(
  preQualificationId: string
): Promise<Record<string, boolean>> {
  const embeddings = await db
    .select({ agentName: dealEmbeddings.agentName })
    .from(dealEmbeddings)
    .where(eq(dealEmbeddings.preQualificationId, preQualificationId));

  const agentNames = Array.from(new Set(embeddings.map(e => e.agentName)));

  return {
    extract: agentNames.includes('extract'),
    quick_scan: agentNames.includes('quick_scan'),
    tech_agent: agentNames.includes('tech_agent'),
    commercial_agent: agentNames.includes('commercial_agent'),
    risk_agent: agentNames.includes('risk_agent'),
    legal_agent: agentNames.includes('legal_agent'),
    team_agent: agentNames.includes('team_agent'),
    content_architecture: agentNames.includes('content_architecture'),
    migration_complexity: agentNames.includes('migration_complexity'),
    accessibility_audit: agentNames.includes('accessibility_audit'),
  };
}
