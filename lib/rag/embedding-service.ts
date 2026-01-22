/**
 * RAG Embedding Service (DEA-107)
 *
 * Generates embeddings for agent outputs and stores them in the database.
 *
 * Requires OPENAI_EMBEDDING_API_KEY to be set.
 * If not configured, embedding operations are silently skipped.
 */

import type { Chunk } from './chunk-service';
import { chunkAgentOutput } from './chunk-service';

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  getEmbeddingClient,
  isEmbeddingEnabled,
} from '@/lib/ai/embedding-config';
import { db } from '@/lib/db';
import { rfpEmbeddings } from '@/lib/db/schema';

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

/**
 * Generate embeddings for multiple chunks in a single batch
 * More efficient than individual calls
 * Returns null if embeddings are not enabled
 */
export async function generateChunkEmbeddings(
  chunks: Chunk[]
): Promise<ChunkWithEmbedding[] | null> {
  if (chunks.length === 0) {
    return [];
  }

  const client = getEmbeddingClient();
  if (!client) {
    return null;
  }

  const texts = chunks.map(c => c.content);

  // Batch-Embedding via OpenAI API
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return chunks.map((chunk, i) => ({
    ...chunk,
    embedding: response.data[i].embedding,
  }));
}

/**
 * Main function: Embed agent output and store in database
 *
 * Usage:
 * ```typescript
 * await embedAgentOutput('rfp-123', 'quick_scan', quickScanResult);
 * ```
 */
export async function embedAgentOutput(
  rfpId: string,
  agentName: string,
  output: Record<string, unknown>
): Promise<void> {
  // Check if embeddings are enabled
  if (!isEmbeddingEnabled()) {
    // Silent skip - expected behavior when not configured
    return;
  }

  try {
    // 1. Chunk agent output
    const chunks = await chunkAgentOutput({ rfpId, agentName, output });

    if (chunks.length === 0) {
      console.log(`[RAG] No chunks generated for ${agentName} on RFP ${rfpId}`);
      return;
    }

    // 2. Generate embeddings
    const chunksWithEmbeddings = await generateChunkEmbeddings(chunks);

    if (!chunksWithEmbeddings) {
      // Embeddings disabled - should not happen since we checked above
      return;
    }

    // 3. Store in database
    await db.insert(rfpEmbeddings).values(
      chunksWithEmbeddings.map(chunk => ({
        rfpId: chunk.rfpId,
        agentName: chunk.agentName,
        chunkType: chunk.chunkType,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: JSON.stringify(chunk.metadata),
        embedding: JSON.stringify(chunk.embedding),
      }))
    );

    console.log(`[RAG] Embedded ${chunks.length} chunks for ${agentName} on RFP ${rfpId}`);
  } catch (error) {
    console.error(`[RAG] Failed to embed ${agentName} output for RFP ${rfpId}:`, error);
    // Don't throw - embedding failure shouldn't block agent execution
  }
}

/**
 * Batch embed multiple agent outputs
 * Useful for orchestrators that run multiple agents
 */
export async function embedBatchAgentOutputs(
  rfpId: string,
  outputs: Array<{ agentName: string; output: Record<string, unknown> }>
): Promise<void> {
  for (const { agentName, output } of outputs) {
    await embedAgentOutput(rfpId, agentName, output);
  }
}

// Re-export generateQueryEmbedding from the config for backward compatibility
export { generateQueryEmbedding, isEmbeddingEnabled } from '@/lib/ai/embedding-config';
