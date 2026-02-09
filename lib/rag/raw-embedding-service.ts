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

import { chunkRawTextWithLocators, getChunkStats, type RawChunk } from './raw-chunk-service';
import {
  EMBEDDING_DIMENSIONS,
  getEmbeddingApiOptions,
  getEmbeddingClient,
  isEmbeddingEnabled,
} from '../ai/embedding-config';
import { db } from '../db';
import { preQualifications, rawChunks } from '../db/schema';

// Batch size for embedding API calls (OpenAI maximum is 2048 inputs)
const EMBEDDING_BATCH_SIZE = 2048;

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

  const client = await getEmbeddingClient();
  if (!client) {
    return null;
  }

  const results: RawChunkWithEmbedding[] = [];

  // Process in batches to avoid API limits
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts = batch.map(c => c.content);

    const options = await getEmbeddingApiOptions();
    const response = await client.embeddings.create({
      ...options,
      input: texts,
    });

    // Validate returned dimensions match DB schema
    const firstDim = response.data[0]?.embedding?.length;
    if (firstDim && firstDim !== EMBEDDING_DIMENSIONS) {
      console.warn(
        `[RAG-RAW] Dimension mismatch: got ${firstDim}, expected ${EMBEDDING_DIMENSIONS}. Skipping.`
      );
      return null;
    }

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
 * 2. Delete existing raw chunks for this qualification (idempotent)
 * 3. Chunk the raw text
 * 4. Generate embeddings for all chunks
 * 5. Store in raw_chunks table
 *
 * @param preQualificationId - The qualification ID to associate chunks with
 * @param rawText - The raw document text to embed
 * @returns Statistics about the embedding process
 */
export async function embedRawText(
  preQualificationId: string,
  rawText: string
): Promise<{
  success: boolean;
  stats: ReturnType<typeof getChunkStats>;
  error?: string;
  skipped?: boolean;
}> {
  const embeddingsEnabled = await isEmbeddingEnabled();
  const zeroEmbedding = new Array(EMBEDDING_DIMENSIONS).fill(0);

  try {
    // Guard against FK violations when the qualification no longer exists.
    const [preQual] = await db
      .select({ id: preQualifications.id })
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQual) {
      console.warn(`[RAG-RAW] Skipping embedding; qualification not found: ${preQualificationId}`);
      return {
        success: false,
        skipped: true,
        stats: getChunkStats([]),
        error: 'Qualification not found',
      };
    }

    // 1. Delete existing raw chunks for this qualification (idempotent re-run)
    await db.delete(rawChunks).where(eq(rawChunks.preQualificationId, preQualificationId));

    // 2. Chunk the raw text
    const chunks = chunkRawTextWithLocators(rawText);

    if (chunks.length === 0) {
      console.log(
        `[RAG-RAW] No chunks generated for qualification ${preQualificationId} - text too short or empty`
      );
      return {
        success: true,
        stats: getChunkStats([]),
      };
    }

    let chunksWithEmbeddings: RawChunkWithEmbedding[] | null = null;
    if (embeddingsEnabled) {
      chunksWithEmbeddings = await generateRawChunkEmbeddings(chunks);
    }

    // 4. Store in database (fallback to zero vectors if embeddings disabled)
    await db.insert(rawChunks).values(
      chunks.map((chunk, idx) => ({
        preQualificationId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: chunksWithEmbeddings?.[idx]?.embedding ?? zeroEmbedding,
        metadata: JSON.stringify(chunk.metadata),
      }))
    );

    const stats = getChunkStats(chunks);
    console.log(
      `[RAG-RAW] Embedded ${stats.totalChunks} chunks (${stats.totalTokens} tokens) for qualification ${preQualificationId}`
    );

    return {
      success: true,
      stats,
      skipped: !embeddingsEnabled,
    };
  } catch (error) {
    console.error(
      `[RAG-RAW] Failed to embed raw text for qualification ${preQualificationId}:`,
      error
    );
    return {
      success: false,
      stats: getChunkStats([]),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if raw chunks exist for a qualification
 */
export async function hasRawChunks(preQualificationId: string): Promise<boolean> {
  const result = await db
    .select({ id: rawChunks.id })
    .from(rawChunks)
    .where(eq(rawChunks.preQualificationId, preQualificationId))
    .limit(1);

  return result.length > 0;
}

/**
 * Get raw chunk count for a qualification
 */
export async function getRawChunkCount(preQualificationId: string): Promise<number> {
  const result = await db
    .select({ id: rawChunks.id })
    .from(rawChunks)
    .where(eq(rawChunks.preQualificationId, preQualificationId));

  return result.length;
}

/**
 * Delete raw chunks for a qualification
 */
export async function deleteRawChunks(preQualificationId: string): Promise<void> {
  await db.delete(rawChunks).where(eq(rawChunks.preQualificationId, preQualificationId));
}
