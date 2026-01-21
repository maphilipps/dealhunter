/**
 * Centralized AI SDK Providers Configuration
 *
 * All AI providers are configured here to use the adesso AI Hub.
 * This ensures compliance and centralized cost tracking.
 *
 * IMPORTANT: Always use these configured providers instead of direct imports.
 */

import { createOpenAI } from '@ai-sdk/openai';

/**
 * OpenAI-compatible provider configured for adesso AI Hub
 *
 * Uses environment variables:
 * - OPENAI_API_KEY: API key for adesso AI Hub
 * - OPENAI_BASE_URL: Base URL for adesso AI Hub (defaults to production URL)
 *
 * Usage:
 * ```ts
 * import { openai } from '@/lib/ai/providers';
 * import { generateObject, streamText } from 'ai';
 *
 * const result = await generateObject({
 *   model: openai('claude-haiku-4.5'),
 *   schema: mySchema,
 *   // ...
 * });
 * ```
 */
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});
