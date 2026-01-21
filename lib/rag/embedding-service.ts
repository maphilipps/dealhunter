/**
 * RAG Embedding Service (DEA-107)
 *
 * Generates embeddings for agent outputs and stores them in the database.
 * Reuses existing OpenAI infrastructure from lib/bids/embedding-service.ts
 */

import { db } from '@/lib/db';
import { rfpEmbeddings } from '@/lib/db/schema';
import { openai } from '@/lib/ai/config';
import type { Chunk } from './chunk-service';
import { chunkAgentOutput } from './chunk-service';

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

/**
 * Generate embeddings for multiple chunks in a single batch
 * More efficient than individual calls
 */
export async function generateChunkEmbeddings(chunks: Chunk[]): Promise<ChunkWithEmbedding[]> {
  if (chunks.length === 0) {
    return [];
  }

  const texts = chunks.map(c => c.content);

  // Batch-Embedding via OpenAI API
  const response = await openai.embeddings.create({
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
  try {
    // 1. Chunk agent output
    const chunks = await chunkAgentOutput({ rfpId, agentName, output });

    if (chunks.length === 0) {
      console.log(`[RAG] No chunks generated for ${agentName} on RFP ${rfpId}`);
      return;
    }

    // 2. Generate embeddings
    const chunksWithEmbeddings = await generateChunkEmbeddings(chunks);

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

/**
 * Generate embedding for a single query string
 * Used by retrieval service
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}
