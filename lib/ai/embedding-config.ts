/**
 * Embedding Configuration (DEA-108)
 *
 * Uses the dynamic model config system for the embedding model name
 * AND provider credentials (DB → Env → Default resolution chain).
 *
 * Credentials are resolved via getProviderCredentials() from model-config.ts,
 * so admin-UI overrides for the embedding provider are respected automatically.
 *
 * If no API key is available, RAG features are gracefully disabled.
 */

import * as Sentry from '@sentry/nextjs';
import OpenAI from 'openai';

import {
  getModelConfigAsync,
  getProviderCredentials,
  onModelConfigInvalidate,
} from './model-config';
import { fingerprintSecret } from './key-fingerprint';

/**
 * DB vectors are 3072 dimensions — this is a schema-level constraint.
 * Changing this requires a database migration of all vector columns.
 */
export const EMBEDDING_DIMENSIONS = 3072;

/**
 * Check if a model supports the `dimensions` parameter.
 * Only OpenAI text-embedding-3-* models support it.
 * Other models (e.g. via AI Hub/LiteLLM) reject the parameter.
 */
function supportsEmbeddingDimensions(modelName: string): boolean {
  return modelName.startsWith('text-embedding-3-');
}

/**
 * Build the API options for an embedding call.
 * Only includes `dimensions` when the model supports it.
 */
export async function getEmbeddingApiOptions(): Promise<{
  model: string;
  dimensions?: number;
}> {
  const modelName = await getEmbeddingModelName();
  if (supportsEmbeddingDimensions(modelName)) {
    return { model: modelName, dimensions: EMBEDDING_DIMENSIONS };
  }
  return { model: modelName };
}

const embeddingClientCache = new Map<string, OpenAI>();
onModelConfigInvalidate(() => embeddingClientCache.clear());

/**
 * Check if embedding API is configured (async — resolves credentials via DB/env).
 */
export async function isEmbeddingEnabled(): Promise<boolean> {
  const config = await getModelConfigAsync('embedding');
  const credentials = await getProviderCredentials(config.provider);
  return !!credentials.apiKey;
}

/**
 * Get the configured embedding model name from the config system.
 * Resolution: DB (admin UI override) → Env → Default (text-embedding-3-large)
 */
export async function getEmbeddingModelName(): Promise<string> {
  const config = await getModelConfigAsync('embedding');
  return config.modelName;
}

/**
 * OpenAI client configured specifically for embeddings.
 * Uses provider credentials from the config system (DB → Env fallback).
 */
export async function getEmbeddingClient(): Promise<OpenAI | null> {
  const config = await getModelConfigAsync('embedding');
  const credentials = await getProviderCredentials(config.provider);

  if (!credentials.apiKey) {
    return null;
  }

  const cacheKey = `${config.provider}:${credentials.baseURL}:${fingerprintSecret(credentials.apiKey)}`;
  if (!embeddingClientCache.has(cacheKey)) {
    embeddingClientCache.set(
      cacheKey,
      new OpenAI({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseURL,
      })
    );
  }
  return embeddingClientCache.get(cacheKey)!;
}

/**
 * Generate embeddings for texts using the configured model.
 * Returns null if embeddings are not enabled.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][] | null> {
  const client = await getEmbeddingClient();

  if (!client || texts.length === 0) {
    return null;
  }

  try {
    const options = await getEmbeddingApiOptions();
    const response = await client.embeddings.create({
      ...options,
      input: texts,
    });

    // Validate returned dimensions match DB schema
    const firstDim = response.data[0]?.embedding?.length;
    if (firstDim && firstDim !== EMBEDDING_DIMENSIONS) {
      Sentry.captureMessage(
        `Embedding dimension mismatch: got ${firstDim}, expected ${EMBEDDING_DIMENSIONS}. ` +
          `Model "${options.model}" produces incompatible vectors.`,
        { level: 'error', tags: { component: 'embedding', model: options.model } }
      );
      return null;
    }

    return response.data.map(d => d.embedding);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'embedding' },
      level: 'warning',
    });
    return null;
  }
}

/**
 * Generate embedding for a single query.
 * Returns null if embeddings are not enabled.
 */
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const embeddings = await generateEmbeddings([query]);
  return embeddings?.[0] ?? null;
}
