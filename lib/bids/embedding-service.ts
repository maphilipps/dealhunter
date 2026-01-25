import { openai } from '@/lib/ai/config';
import type { ExtractedRequirements } from '@/lib/extraction/schema';

/**
 * Embedding Service for Duplicate Detection
 *
 * Uses text-embedding-3-large (3072 dimensions) via adesso AI Hub
 */

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;

/**
 * Generate an embedding vector for RFP duplicate detection
 *
 * Combines customerName, projectTitle, and projectDescription into a single text
 * that represents the semantic essence of the RFP.
 */
export async function generateRfpEmbedding(requirements: ExtractedRequirements): Promise<number[]> {
  // Construct text for embedding
  const textParts: string[] = [];

  if (requirements.customerName) {
    textParts.push(`Customer: ${requirements.customerName}`);
  }

  if (requirements.projectName) {
    textParts.push(`Project: ${requirements.projectName}`);
  }

  if (requirements.projectDescription) {
    textParts.push(`Description: ${requirements.projectDescription}`);
  }

  if (requirements.keyRequirements && Array.isArray(requirements.keyRequirements)) {
    const reqText = requirements.keyRequirements.join(', ');
    textParts.push(`Requirements: ${reqText}`);
  }

  const combinedText = textParts.join('\n');

  if (!combinedText.trim()) {
    throw new Error('No text available for embedding generation');
  }

  // Generate embedding via OpenAI API (adesso AI Hub)
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: combinedText,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding as number[];
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
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
 * Convert cosine similarity to percentage (0-100)
 */
export function similarityToPercentage(similarity: number): number {
  // Cosine similarity ranges from -1 to 1
  // Map to 0-100 scale where 1 → 100, 0 → 50, -1 → 0
  return Math.round(((similarity + 1) / 2) * 100);
}

/**
 * Parse embedding from database (pgvector returns number[] directly)
 */
export function parseEmbedding(embedding: number[] | null): number[] | null {
  if (!embedding) return null;

  if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS) {
    return embedding;
  }
  return null;
}
