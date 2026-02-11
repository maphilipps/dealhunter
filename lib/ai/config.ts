/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { AI_HUB_API_KEY, AI_HUB_BASE_URL } from './env';
import { getModelProvider, getModelConfigAsync, modelNames, type ModelSlot } from './model-config';

// Lazy-initialized OpenAI clients to reduce bundle size
// Only the OpenAI SDK is imported (not multiple providers)
// This implements Vercel React Best Practice: bundle-conditional
let openaiInstance: any = null;

// Initialize AI SDK OpenAI provider (AI Hub)
export const aiHubOpenAI = createOpenAI({
  apiKey: AI_HUB_API_KEY,
  baseURL: AI_HUB_BASE_URL,
});

/**
 * Get or create the AI Hub client (for Claude models via adesso AI Hub)
 * Uses lazy initialization to avoid eager loading of the OpenAI SDK
 */
export function getOpenAIClient() {
  if (!openaiInstance) {
    // Dynamic import only when needed
    const OpenAI = require('openai').default;
    openaiInstance = new OpenAI({
      apiKey: AI_HUB_API_KEY,
      baseURL: AI_HUB_BASE_URL,
    });
  }
  return openaiInstance;
}

// Backward-compatible exports (deprecated - use getOpenAIClient instead)
export const openai = new Proxy({} as any, {
  get(_target, prop) {
    const client = getOpenAIClient();
    return Reflect.get(client, prop);
  },
});

export const defaultSettings = {
  deterministic: {
    temperature: 0.3,
    maxTokens: 8000, // Increased to avoid truncation
  },
  creative: {
    temperature: 0.7,
    maxTokens: 8000,
  },
  longForm: {
    temperature: 0.5,
    maxTokens: 16000,
  },
} as const;

export type ModelKey = keyof typeof modelNames;
export { modelNames };
export type { ModelSlot };
export { AI_HUB_API_KEY, AI_HUB_BASE_URL };

/**
 * Centralized timeout configurations for AI operations
 * All values in milliseconds
 */
export const AI_TIMEOUTS = {
  /** Simple agent calls (decision maker research) */
  AGENT_SIMPLE: 30_000,
  /** Standard agent calls (company research, routing) */
  AGENT_STANDARD: 45_000,
  /** Complex agent calls (content architecture, migration, timeline) */
  AGENT_COMPLEX: 60_000,
  /** Heavy agent calls (ten questions, draft generation) */
  AGENT_HEAVY: 90_000,
  /** Quick-Scan total timeout */
  QUICK_SCAN_TOTAL: 5 * 60_000,
  /** Quick-Scan per-step timeout */
  QUICK_SCAN_STEP: 60_000,
  /** SSE stream maximum duration */
  SSE_STREAM: 10 * 60_000,
  /** BullMQ worker lock duration */
  WORKER_LOCK: 10 * 60_000,
} as const;

/**
 * Model fallback configuration
 *
 * When the primary model fails with specific error types (empty responses,
 * validation errors), we fall back to an alternative model.
 *
 * Fallback is triggered by:
 * - AI_TypeValidationError (e.g., missing `choices` array from Gemini via LiteLLM)
 * - Empty response with completion_tokens: 0
 * - Timeout errors after primary model exhausts retries
 */
export const MODEL_FALLBACK_CONFIG: Record<ModelSlot, ModelSlot | null> = {
  fast: 'default', // fast → default
  default: 'quality', // default → quality
  quality: 'premium', // quality → premium
  premium: null, // premium has no fallback
  synthesizer: 'default', // synthesizer → default
  research: 'quality', // research → quality
  vision: null, // vision has no fallback (specialized)
  embedding: null, // embedding has no fallback
  'web-search': null, // web-search has no fallback (specialized)
};

/**
 * Check if an error should trigger model fallback
 *
 * Fallback-eligible errors:
 * - AI_TypeValidationError: missing `choices` array (Gemini via LiteLLM bug)
 * - Empty response errors
 * - Timeout errors after retries exhausted
 */
export function isFallbackEligibleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // AI SDK type validation errors (missing choices array)
  if (
    name.includes('typevalidationerror') ||
    name.includes('ai_typevalidationerror') ||
    message.includes('expected array, received undefined') ||
    message.includes('"choices"')
  ) {
    return true;
  }

  // Timeout errors (already retried by primary model)
  if (name === 'aborterror' || message.includes('timeout') || message.includes('timed out')) {
    return true;
  }

  // Empty response indicators
  if (
    message.includes('empty response') ||
    message.includes('no content') ||
    message.includes('completion_tokens')
  ) {
    return true;
  }

  return false;
}

export async function generateStructuredOutput<T extends z.ZodType>(options: {
  model?: ModelKey;
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Timeout in milliseconds (default: 60000 = 60s) */
  timeout?: number;
  /** External abort signal for cancellation */
  abortSignal?: AbortSignal;
}): Promise<z.infer<T>> {
  const modelKey = options.model ?? 'default';
  // Resolve model config async to ensure DB cache is loaded before reading model name
  const resolvedConfig = await getModelConfigAsync(modelKey);
  const modelName = resolvedConfig.modelName;

  // Setup timeout handling
  const timeoutMs = options.timeout ?? 60_000; // 60s default
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Combine external abort signal with our timeout
  const combinedSignal = options.abortSignal
    ? AbortSignal.any([options.abortSignal, controller.signal])
    : controller.signal;

  try {
    const { output, usage } = await generateText({
      model: (await getModelProvider(modelKey))(modelName),
      output: Output.object({ schema: options.schema }),
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? defaultSettings.deterministic.temperature,
      maxOutputTokens: options.maxTokens ?? defaultSettings.deterministic.maxTokens,
      maxRetries: 3, // Built-in retry for rate limits
      abortSignal: combinedSignal,
    });

    // Log token usage for monitoring
    console.log(`[AI] Generated object with ${modelName}: ${usage.totalTokens} tokens`);

    // Type assertion: Output.object infers the schema type correctly,
    // but TypeScript can't unify it with z.infer<T> across the generic boundary
    return output as z.infer<T>;
  } catch (error) {
    // Enhance timeout errors with more context
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI generation timeout after ${timeoutMs}ms (model: ${modelName})`);
    }
    console.error('[generateStructuredOutput] Error:', error);
    // Propagate error for the caller to handle, now with better types from AI SDK
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate structured output with automatic model fallback
 *
 * If the primary model fails with a fallback-eligible error (empty response,
 * type validation error, timeout), automatically retries with the fallback model.
 *
 * Fallback chain is configured in MODEL_FALLBACK_CONFIG.
 *
 * @example
 * // Will try 'quality' model first, fallback to 'premium' on failure
 * const result = await generateWithFallback({
 *   model: 'quality',
 *   schema: mySchema,
 *   system: 'You are a helpful assistant.',
 *   prompt: 'Analyze this content...',
 * });
 */
export async function generateWithFallback<T extends z.ZodType>(options: {
  model?: ModelKey;
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Timeout in milliseconds (default: 60000 = 60s) */
  timeout?: number;
  /** External abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Disable fallback (useful for testing or when fallback is not desired) */
  disableFallback?: boolean;
}): Promise<z.infer<T>> {
  const modelKey = options.model ?? 'default';
  const fallbackModelKey = MODEL_FALLBACK_CONFIG[modelKey];

  try {
    // Try primary model
    return await generateStructuredOutput(options);
  } catch (primaryError) {
    // Check if we should fallback
    const canFallback =
      !options.disableFallback &&
      fallbackModelKey !== null &&
      isFallbackEligibleError(primaryError);

    if (!canFallback) {
      // No fallback available or error not eligible — rethrow
      throw primaryError;
    }

    // Log fallback attempt
    const primaryModelName = modelNames[modelKey];
    const fallbackModelName = modelNames[fallbackModelKey];
    console.warn(
      `[AI Fallback] Primary model ${primaryModelName} failed, trying fallback ${fallbackModelName}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );

    try {
      // Try fallback model
      const result = await generateStructuredOutput({
        ...options,
        model: fallbackModelKey,
      });

      console.log(`[AI Fallback] Fallback model ${fallbackModelName} succeeded`);
      return result;
    } catch (fallbackError) {
      // Fallback also failed — throw the fallback error but log both
      console.error(
        `[AI Fallback] Fallback model ${fallbackModelName} also failed:`,
        fallbackError instanceof Error ? fallbackError.message : fallbackError
      );

      // Throw a combined error that mentions both failures
      const primaryMsg =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMsg =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);

      throw new Error(
        `AI generation failed with both primary and fallback models. ` +
          `Primary (${primaryModelName}): ${primaryMsg}. ` +
          `Fallback (${fallbackModelName}): ${fallbackMsg}`
      );
    }
  }
}
