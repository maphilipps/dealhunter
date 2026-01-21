/**
 * Centralized AI SDK Providers Configuration
 *
 * All AI providers are configured here to use the adesso AI Hub.
 * This ensures compliance and centralized cost tracking.
 *
 * IMPORTANT: For adesso AI Hub compatibility, use the direct OpenAI SDK from lib/ai/config.ts
 * instead of AI SDK's @ai-sdk/openai provider. The hub uses custom model names
 * (claude-haiku-4.5, claude-sonnet-4) that work with the OpenAI SDK but not AI SDK v5.
 *
 * Prefer using:
 * - lib/ai/config.ts with direct OpenAI SDK for generateObject/generateText
 * - This provider only for streamText use cases that require AI SDK
 */

import { createOpenAI } from '@ai-sdk/openai';

/**
 * OpenAI-compatible provider configured for adesso AI Hub
 *
 * NOTE: This provider may have compatibility issues with adesso AI Hub's model spec v3.
 * Prefer using the direct OpenAI SDK from lib/ai/config.ts for most use cases.
 *
 * Uses environment variables:
 * - OPENAI_API_KEY: API key for adesso AI Hub
 * - OPENAI_BASE_URL: Base URL for adesso AI Hub (defaults to production URL)
 */
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});
