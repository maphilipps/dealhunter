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
} from '../ai/embedding-config';
import { db } from '../db';
import { dealEmbeddings } from '../db/schema';

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
 * await embedAgentOutput('prequal-123', 'quick_scan', quickScanResult);
 * ```
 */
export async function embedAgentOutput(
  preQualificationId: string,
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
    const chunks = await chunkAgentOutput({ preQualificationId, agentName, output });

    if (chunks.length === 0) {
      console.log(`[RAG] No chunks generated for ${agentName} on prequal ${preQualificationId}`);
      return;
    }

    // 2. Generate embeddings
    const chunksWithEmbeddings = await generateChunkEmbeddings(chunks);

    if (!chunksWithEmbeddings) {
      // Embeddings disabled - should not happen since we checked above
      return;
    }

    // 3. Store in database (unified dealEmbeddings table)
    await db.insert(dealEmbeddings).values(
      chunksWithEmbeddings.map(chunk => ({
        preQualificationId: chunk.preQualificationId,
        agentName: chunk.agentName,
        chunkType: chunk.chunkType,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: JSON.stringify(chunk.metadata),
        embedding: chunk.embedding,
      }))
    );

    console.log(
      `[RAG] Embedded ${chunks.length} chunks for ${agentName} on prequal ${preQualificationId}`
    );
  } catch (error) {
    console.error(
      `[RAG] Failed to embed ${agentName} output for prequal ${preQualificationId}:`,
      error
    );
    // Don't throw - embedding failure shouldn't block agent execution
  }
}

/**
 * Batch embed multiple agent outputs
 * Useful for orchestrators that run multiple agents
 */
export async function embedBatchAgentOutputs(
  preQualificationId: string,
  outputs: Array<{ agentName: string; output: Record<string, unknown> }>
): Promise<void> {
  for (const { agentName, output } of outputs) {
    await embedAgentOutput(preQualificationId, agentName, output);
  }
}

// Re-export generateQueryEmbedding from the config for backward compatibility
export { generateQueryEmbedding, isEmbeddingEnabled } from '../ai/embedding-config';
