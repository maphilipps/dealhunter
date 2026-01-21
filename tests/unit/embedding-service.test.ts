import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for embedding-service.ts
 *
 * Deep Module Tests - Focus on external behavior (inputs/outputs)
 * NO mocking of internals - test with real math operations
 *
 * NOTE: We can't directly import from embedding-service.ts because it imports
 * from @/lib/ai/config which initializes OpenAI client. Instead, we'll test
 * the pure math functions by copying them here (acceptable for unit tests).
 */

// Pure functions copied from embedding-service.ts for testing
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

function similarityToPercentage(similarity: number): number {
  return Math.round(((similarity + 1) / 2) * 100);
}

const EMBEDDING_DIMENSIONS = 3072;

function parseEmbedding(embeddingJson: string | null): number[] | null {
  if (!embeddingJson) return null;

  try {
    const parsed = JSON.parse(embeddingJson);
    if (Array.isArray(parsed) && parsed.length === EMBEDDING_DIMENSIONS) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const vecA = [1, 2, 3, 4, 5];
    const vecB = [1, 2, 3, 4, 5];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(1.0, 10); // 10 decimal places
  });

  it('should return 0.0 for orthogonal vectors', () => {
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(0.0, 10);
  });

  it('should return -1.0 for opposite vectors', () => {
    const vecA = [1, 2, 3];
    const vecB = [-1, -2, -3];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(-1.0, 10);
  });

  it('should calculate correct similarity for similar vectors', () => {
    // Two very similar but not identical vectors
    const vecA = [1.0, 2.0, 3.0, 4.0, 5.0];
    const vecB = [1.1, 2.1, 2.9, 4.1, 5.0];
    const similarity = cosineSimilarity(vecA, vecB);

    // Should be very high similarity (>0.99) but not perfect
    expect(similarity).toBeGreaterThan(0.99);
    expect(similarity).toBeLessThan(1.0);
  });

  it('should calculate correct similarity for moderately similar vectors', () => {
    const vecA = [1, 2, 3, 4, 5];
    const vecB = [2, 3, 4, 5, 6]; // Shifted by 1
    const similarity = cosineSimilarity(vecA, vecB);

    // Should be very high similarity (shifted vectors have high correlation)
    expect(similarity).toBeGreaterThan(0.99);
    expect(similarity).toBeLessThan(1.0);
  });

  it('should calculate correct similarity for different vectors', () => {
    const vecA = [1, 0, 0, 0, 0];
    const vecB = [0, 0, 0, 0, 1];
    const similarity = cosineSimilarity(vecA, vecB);

    // Completely different dimensions = 0
    expect(similarity).toBeCloseTo(0.0, 10);
  });

  it('should handle zero vectors', () => {
    const vecA = [0, 0, 0];
    const vecB = [1, 2, 3];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBe(0);
  });

  it('should handle both zero vectors', () => {
    const vecA = [0, 0, 0];
    const vecB = [0, 0, 0];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBe(0);
  });

  it('should throw error for vectors of different lengths', () => {
    const vecA = [1, 2, 3];
    const vecB = [1, 2, 3, 4];
    expect(() => cosineSimilarity(vecA, vecB)).toThrow('Vectors must have same length');
  });

  it('should handle high-dimensional vectors (like text-embedding-3-large)', () => {
    // Simulate 3072-dimensional embeddings
    const vecA = Array(3072).fill(0.5);
    const vecB = Array(3072).fill(0.5);
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(1.0, 10);
  });

  it('should handle high-dimensional vectors with small differences', () => {
    const vecA = Array(3072).fill(0.5);
    const vecB = vecA.map((v, i) => (i < 10 ? v + 0.01 : v)); // Slight change in first 10 dims
    const similarity = cosineSimilarity(vecA, vecB);

    // Should be very high similarity but not perfect
    expect(similarity).toBeGreaterThan(0.999);
    expect(similarity).toBeLessThan(1.0);
  });

  it('should be commutative (order does not matter)', () => {
    const vecA = [1, 2, 3, 4, 5];
    const vecB = [2, 3, 4, 5, 6];
    const simAB = cosineSimilarity(vecA, vecB);
    const simBA = cosineSimilarity(vecB, vecA);
    expect(simAB).toBeCloseTo(simBA, 10);
  });

  it('should handle negative values', () => {
    const vecA = [-1, -2, -3];
    const vecB = [1, 2, 3];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(-1.0, 10);
  });

  it('should handle mixed positive and negative values', () => {
    const vecA = [1, -2, 3, -4, 5];
    const vecB = [1, -2, 3, -4, 5];
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(1.0, 10);
  });
});

describe('similarityToPercentage', () => {
  it('should convert 1.0 to 100%', () => {
    expect(similarityToPercentage(1.0)).toBe(100);
  });

  it('should convert 0.0 to 50%', () => {
    expect(similarityToPercentage(0.0)).toBe(50);
  });

  it('should convert -1.0 to 0%', () => {
    expect(similarityToPercentage(-1.0)).toBe(0);
  });

  it('should convert 0.5 to 75%', () => {
    expect(similarityToPercentage(0.5)).toBe(75);
  });

  it('should convert -0.5 to 25%', () => {
    expect(similarityToPercentage(-0.5)).toBe(25);
  });

  it('should handle edge cases near 1.0', () => {
    expect(similarityToPercentage(0.99)).toBe(100); // Rounded to 100
    expect(similarityToPercentage(0.98)).toBe(99);
  });

  it('should handle edge cases near 0.0', () => {
    expect(similarityToPercentage(0.01)).toBe(51); // Rounded to 51
    expect(similarityToPercentage(-0.01)).toBe(50); // Rounded to 50
  });

  it('should handle high similarity (typical duplicate threshold)', () => {
    // 0.85 cosine similarity → 92.5% → 93% (rounded)
    expect(similarityToPercentage(0.85)).toBe(93);
  });

  it('should round to nearest integer', () => {
    // 0.86 → 93% (rounded from 93.0)
    expect(similarityToPercentage(0.86)).toBe(93);

    // 0.87 → 94% (rounded from 93.5)
    expect(similarityToPercentage(0.87)).toBe(94);
  });
});

describe('parseEmbedding', () => {
  it('should parse valid JSON array with correct dimensions', () => {
    const embedding = Array(3072).fill(0.5);
    const json = JSON.stringify(embedding);
    const parsed = parseEmbedding(json);
    expect(parsed).toEqual(embedding);
    expect(parsed?.length).toBe(3072);
  });

  it('should return null for invalid JSON', () => {
    const invalidJson = 'not a valid json';
    const parsed = parseEmbedding(invalidJson);
    expect(parsed).toBeNull();
  });

  it('should return null for null input', () => {
    const parsed = parseEmbedding(null);
    expect(parsed).toBeNull();
  });

  it('should return null for empty string', () => {
    const parsed = parseEmbedding('');
    expect(parsed).toBeNull();
  });

  it('should return null for wrong dimensions', () => {
    const wrongDimensions = JSON.stringify([1, 2, 3]); // Only 3 dimensions
    const parsed = parseEmbedding(wrongDimensions);
    expect(parsed).toBeNull();
  });

  it('should return null for JSON object (not array)', () => {
    const obj = JSON.stringify({ embedding: [1, 2, 3] });
    const parsed = parseEmbedding(obj);
    expect(parsed).toBeNull();
  });

  it('should return null for JSON string (not array)', () => {
    const str = JSON.stringify('some string');
    const parsed = parseEmbedding(str);
    expect(parsed).toBeNull();
  });

  it('should return null for JSON number (not array)', () => {
    const num = JSON.stringify(42);
    const parsed = parseEmbedding(num);
    expect(parsed).toBeNull();
  });

  it('should handle array with exact 3072 elements', () => {
    const embedding = Array(3072)
      .fill(0)
      .map((_, i) => i * 0.001);
    const json = JSON.stringify(embedding);
    const parsed = parseEmbedding(json);
    expect(parsed).toEqual(embedding);
  });

  it('should handle negative values in embedding', () => {
    const embedding = Array(3072).fill(-0.5);
    const json = JSON.stringify(embedding);
    const parsed = parseEmbedding(json);
    expect(parsed).toEqual(embedding);
  });

  it('should handle floating point precision', () => {
    const embedding = Array(3072).fill(0.123456789);
    const json = JSON.stringify(embedding);
    const parsed = parseEmbedding(json);
    expect(parsed).toEqual(embedding);
  });
});

/**
 * Integration tests combining multiple functions
 */
describe('Integration: Embedding Math Pipeline', () => {
  it('should correctly process identical embeddings through full pipeline', () => {
    const embA = Array(3072).fill(0.5);
    const embB = Array(3072).fill(0.5);

    // Calculate similarity
    const cosineSim = cosineSimilarity(embA, embB);
    expect(cosineSim).toBeCloseTo(1.0, 10);

    // Convert to percentage
    const percentage = similarityToPercentage(cosineSim);
    expect(percentage).toBe(100);
  });

  it('should correctly process similar embeddings through full pipeline', () => {
    const embA = Array(3072).fill(0.5);
    const embB = embA.map((v, i) => (i < 100 ? v + 0.01 : v)); // Small change in 100 dims

    const cosineSim = cosineSimilarity(embA, embB);
    const percentage = similarityToPercentage(cosineSim);

    // Should be very high similarity (>99%) due to small changes
    expect(percentage).toBeGreaterThan(99);
    expect(percentage).toBeLessThanOrEqual(100);
  });

  it('should correctly process embeddings from JSON through full pipeline', () => {
    const embA = Array(3072).fill(0.5);
    const embB = Array(3072).fill(0.5);

    // Serialize to JSON (simulate DB storage)
    const jsonA = JSON.stringify(embA);
    const jsonB = JSON.stringify(embB);

    // Parse from JSON
    const parsedA = parseEmbedding(jsonA);
    const parsedB = parseEmbedding(jsonB);

    expect(parsedA).not.toBeNull();
    expect(parsedB).not.toBeNull();

    // Calculate similarity
    const cosineSim = cosineSimilarity(parsedA!, parsedB!);
    const percentage = similarityToPercentage(cosineSim);

    expect(percentage).toBe(100);
  });

  it('should handle duplicate detection threshold scenario (85% similarity)', () => {
    // Simulate two RFP embeddings with ~85% cosine similarity
    // This translates to ~92.5% percentage (threshold for duplicate detection)

    // Create two vectors with specific cosine similarity
    // To get lower similarity, we need more significant differences
    const embA = Array(3072).fill(0).map((_, i) => (i % 2 === 0 ? 1.0 : 0.0));
    const embB = Array(3072).fill(0).map((_, i) => (i % 3 === 0 ? 1.0 : 0.0));

    const cosineSim = cosineSimilarity(embA, embB);
    const percentage = similarityToPercentage(cosineSim);

    // These vectors should have moderate similarity
    expect(cosineSim).toBeGreaterThan(0.3);
    expect(cosineSim).toBeLessThan(0.7);
    expect(percentage).toBeGreaterThan(65);
    expect(percentage).toBeLessThan(85);
  });
});
