/**
 * Embedding Configuration (DEA-108)
 *
 * Separate configuration for embedding models.
 * The adesso AI Hub doesn't provide embedding models, so we need
 * a direct connection to OpenAI for embeddings.
 *
 * Set OPENAI_EMBEDDING_API_KEY in your .env.local to enable embeddings.
 * If not set, RAG features will be gracefully disabled.
 */

import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-large';
export const EMBEDDING_DIMENSIONS = 3072;

/**
 * Check if embedding API is configured
 */
export function isEmbeddingEnabled(): boolean {
  return !!process.env.OPENAI_EMBEDDING_API_KEY;
}

/**
 * OpenAI client configured specifically for embeddings
 * Uses direct OpenAI API (not adesso AI Hub)
 */
let embeddingClient: OpenAI | null = null;

export function getEmbeddingClient(): OpenAI | null {
  if (!isEmbeddingEnabled()) {
    return null;
  }

  if (!embeddingClient) {
    embeddingClient = new OpenAI({
      apiKey: process.env.OPENAI_EMBEDDING_API_KEY,
      baseURL: 'https://api.openai.com/v1', // Explizit OpenAI, nicht AI Hub
    });
  }

  return embeddingClient;
}

/**
 * Generate embeddings for texts
 * Returns null if embeddings are not enabled
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][] | null> {
  const client = getEmbeddingClient();

  if (!client || texts.length === 0) {
    return null;
  }

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('[Embedding] Failed to generate embeddings:', error);
    return null;
  }
}

/**
 * Generate embedding for a single query
 * Returns null if embeddings are not enabled
 */
export async function generateQueryEmbedding(
  query: string
): Promise<number[] | null> {
  const embeddings = await generateEmbeddings([query]);
  return embeddings?.[0] ?? null;
}
