/**
 * RAG Retrieval Service (DEA-107)
 *
 * Hybrid retrieval strategy:
 * 1. Generate query embedding
 * 2. Vector similarity search via pgvector
 * 3. Optional tech stack filtering
 * 4. Prefer threshold filtering (similarity > 0.7), but fall back to top-N when none match
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

// This threshold was originally introduced to avoid returning irrelevant chunks.
// In practice, many real-world qualification queries peak below 0.7, which caused
// false "no data" results across the product. We still use the threshold as a
// preference, but fall back to top-N when nothing clears it.
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
 * 2. Fetch all chunks for this qualification
 * 3. Calculate cosine similarity for each chunk
 * 4. Sort by similarity DESC
 * 5. Prefer thresholded results (>0.7), but fall back to top-N when none match
 * 6. Optional tech stack filter
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

    // 2. Fetch all chunks for this qualification
    const chunks = await db
      .select()
      .from(dealEmbeddings)
      .where(eq(dealEmbeddings.preQualificationId, query.preQualificationId));

    if (chunks.length === 0) {
      return [];
    }

    // 3. Calculate similarity for each chunk (filter out chunks without embeddings)
    const resultsWithSimilarity: RAGResult[] = chunks
      .filter(chunk => chunk.embedding !== null)
      .map(chunk => {
        const chunkEmbedding = chunk.embedding!;
        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

        let metadata: Record<string, unknown> = {};
        if (chunk.metadata) {
          try {
            metadata = JSON.parse(chunk.metadata) as Record<string, unknown>;
          } catch {
            metadata = {};
          }
        }

        return {
          chunkId: chunk.id,
          agentName: chunk.agentName,
          chunkType: chunk.chunkType,
          content: chunk.content,
          similarity,
          metadata,
        };
      });

    if (resultsWithSimilarity.length === 0) {
      return [];
    }

    // 4. Sort by similarity DESC (always)
    resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // 5. Prefer thresholded results, but fall back to top-N if nothing clears the threshold.
    const thresholded = resultsWithSimilarity.filter(r => r.similarity > SIMILARITY_THRESHOLD);
    const pool = thresholded.length > 0 ? thresholded : resultsWithSimilarity;

    // 6. Optional tech stack filter (applied after pool selection)
    let filtered = pool;
    if (query.techStackFilter) {
      const needle = query.techStackFilter.toLowerCase();
      const techFiltered = pool.filter(result => {
        const cms = result.metadata.cms as string | undefined;
        const framework = result.metadata.framework as string | undefined;
        return cms?.toLowerCase().includes(needle) || framework?.toLowerCase().includes(needle);
      });

      // If tech stack filter yields no results, fall back to the unfiltered pool
      if (techFiltered.length > 0) {
        filtered = techFiltered;
      }
    }

    // 7. Return top N results
    const maxResults = query.maxResults || 5;
    return filtered.slice(0, maxResults);
  } catch (error) {
    console.error('[RAG] Query failed:', error);
    return [];
  }
}

/**
 * Get embedding status for a qualification
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
    lead_scan: agentNames.includes('lead_scan'),
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
