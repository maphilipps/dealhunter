/**
 * RAW Embedding Service (DEA-108)
 *
 * Embeds raw document chunks for RAG-based extraction.
 * Stores embeddings in the raw_chunks table.
 *
 * Requires OPENAI_EMBEDDING_API_KEY to be set.
 * If not configured, RAG features are gracefully disabled.
 */

import { eq } from 'drizzle-orm';

import { chunkRawText, getChunkStats, type RawChunk } from './raw-chunk-service';

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  getEmbeddingClient,
  isEmbeddingEnabled,
} from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { rawChunks } from '@/lib/db/schema';

// Batch size for embedding API calls (OpenAI supports up to 2048 inputs)
const EMBEDDING_BATCH_SIZE = 100;

export interface RawChunkWithEmbedding extends RawChunk {
  embedding: number[];
}

/**
 * Generate embeddings for multiple raw chunks in batches
 * Returns null if embeddings are not enabled
 */
export async function generateRawChunkEmbeddings(
  chunks: RawChunk[]
): Promise<RawChunkWithEmbedding[] | null> {
  if (chunks.length === 0) {
    return [];
  }

  const client = getEmbeddingClient();
  if (!client) {
    return null;
  }

  const results: RawChunkWithEmbedding[] = [];

  // Process in batches to avoid API limits
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts = batch.map(c => c.content);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    for (let j = 0; j < batch.length; j++) {
      results.push({
        ...batch[j],
        embedding: response.data[j].embedding,
      });
    }
  }

  return results;
}

/**
 * Embed raw document text and store in database
 *
 * Flow:
 * 1. Check if embeddings are enabled
 * 2. Delete existing raw chunks for this RFP (idempotent)
 * 3. Chunk the raw text
 * 4. Generate embeddings for all chunks
 * 5. Store in raw_chunks table
 *
 * @param rfpId - The RFP ID to associate chunks with
 * @param rawText - The raw document text to embed
 * @returns Statistics about the embedding process
 */
export async function embedRawText(
  rfpId: string,
  rawText: string
): Promise<{
  success: boolean;
  stats: ReturnType<typeof getChunkStats>;
  error?: string;
  skipped?: boolean;
}> {
  // Check if embeddings are enabled
  if (!isEmbeddingEnabled()) {
    // Silent skip - no error logging, this is expected behavior
    return {
      success: true,
      stats: getChunkStats([]),
      skipped: true,
    };
  }

  try {
    // 1. Delete existing raw chunks for this RFP (idempotent re-run)
    await db.delete(rawChunks).where(eq(rawChunks.rfpId, rfpId));

    // 2. Chunk the raw text
    const chunks = chunkRawText(rawText);

    if (chunks.length === 0) {
      console.log(`[RAG-RAW] No chunks generated for RFP ${rfpId} - text too short or empty`);
      return {
        success: true,
        stats: getChunkStats([]),
      };
    }

    // 3. Generate embeddings
    const chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);

    if (!chunksWithEmbeddings) {
      // Embeddings disabled mid-way (shouldn't happen, but handle gracefully)
      return {
        success: true,
        stats: getChunkStats([]),
        skipped: true,
      };
    }

    // 4. Store in database
    await db.insert(rawChunks).values(
      chunksWithEmbeddings.map(chunk => ({
        rfpId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: JSON.stringify(chunk.embedding),
        metadata: JSON.stringify(chunk.metadata),
      }))
    );

    const stats = getChunkStats(chunks);
    console.log(
      `[RAG-RAW] Embedded ${stats.totalChunks} chunks (${stats.totalTokens} tokens) for RFP ${rfpId}`
    );

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error(`[RAG-RAW] Failed to embed raw text for RFP ${rfpId}:`, error);
    return {
      success: false,
      stats: getChunkStats([]),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if raw chunks exist for an RFP
 */
export async function hasRawChunks(rfpId: string): Promise<boolean> {
  const result = await db
    .select({ id: rawChunks.id })
    .from(rawChunks)
    .where(eq(rawChunks.rfpId, rfpId))
    .limit(1);

  return result.length > 0;
}

/**
 * Get raw chunk count for an RFP
 */
export async function getRawChunkCount(rfpId: string): Promise<number> {
  const result = await db
    .select({ id: rawChunks.id })
    .from(rawChunks)
    .where(eq(rawChunks.rfpId, rfpId));

  return result.length;
}

/**
 * Delete raw chunks for an RFP
 */
export async function deleteRawChunks(rfpId: string): Promise<void> {
  await db.delete(rawChunks).where(eq(rawChunks.rfpId, rfpId));
}
