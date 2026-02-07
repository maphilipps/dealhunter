/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { AI_HUB_API_KEY, AI_HUB_BASE_URL } from './config';
const DIRECT_OPENAI_KEY = process.env.OPENAI_DIRECT_API_KEY || process.env.OPENAI_EMBEDDING_API_KEY;
import { getModel, getModelProvider, getModelConfig, type ModelSlot } from './model-config';

/**
 * Centralized AI SDK Providers Configuration
 *
 * Supports dynamic switching between AI Hub and OpenAI per model slot.
 * Configure via environment variables:
 * - AI_MODEL_<SLOT>_PROVIDER: 'ai-hub' | 'openai'
 * - AI_MODEL_<SLOT>_NAME: Model name
 *
 * Example:
 * AI_MODEL_QUALITY_PROVIDER=openai
 * AI_MODEL_QUALITY_NAME=gpt-4o
 */

// Lazy-initialized default AI Hub provider (for legacy compatibility)
let defaultProviderInstance: any = null;

/**
 * Get the default OpenAI-compatible provider (AI Hub)
 * For new code, prefer getModelForSlot() for dynamic provider selection
 */
export function getOpenAIProvider() {
  if (!defaultProviderInstance) {
    const { createOpenAI } = require('@ai-sdk/openai');
    if (DIRECT_OPENAI_KEY) {
      defaultProviderInstance = createOpenAI({
        apiKey: DIRECT_OPENAI_KEY,
        baseURL: 'https://api.openai.com/v1',
      });
    } else {
      defaultProviderInstance = createOpenAI({
        apiKey: AI_HUB_API_KEY,
        baseURL: AI_HUB_BASE_URL,
      });
    }
  }
  return defaultProviderInstance;
}

/**
 * Get a model instance for a specific slot with dynamic provider selection
 * This is the preferred way to get models - respects per-slot configuration
 */
export async function getModelForSlot(slot: ModelSlot) {
  return getModel(slot);
}

/**
 * Get the provider function for a slot (for ToolLoopAgent etc.)
 */
export async function getProviderForSlot(slot: ModelSlot) {
  return getModelProvider(slot);
}

/**
 * Get the current configuration for a slot (for debugging/logging)
 */
export function getSlotConfig(slot: ModelSlot) {
  return getModelConfig(slot);
}

// Re-export for convenience
export { getModel, getModelProvider, getModelConfig, type ModelSlot } from './model-config';

// Backward-compatible export (deprecated - use getOpenAIProvider() instead)
export function openai(...args: any[]) {
  const provider = getOpenAIProvider();
  return provider(...args);
}
