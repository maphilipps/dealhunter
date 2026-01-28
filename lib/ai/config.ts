/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

import { getProviderForSlot } from './providers';

// Lazy-initialized OpenAI clients to reduce bundle size
// Only the OpenAI SDK is imported (not multiple providers)
// This implements Vercel React Best Practice: bundle-conditional
let openaiInstance: any = null;
let openaiDirectInstance: any = null;

export const AI_HUB_API_KEY = process.env.AI_HUB_API_KEY || process.env.OPENAI_API_KEY;
export const AI_HUB_BASE_URL =
  process.env.AI_HUB_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://adesso-ai-hub.3asabc.de/v1';

// Initialize AI SDK OpenAI provider (AI Hub)
export const aiHubOpenAI = createOpenAI({
  apiKey: AI_HUB_API_KEY,
  baseURL: AI_HUB_BASE_URL,
});

// Direct OpenAI provider for specific models if needed (embeddings only)
export const directOpenAI = createOpenAI({
  apiKey:
    process.env.OPENAI_DIRECT_API_KEY ||
    process.env.OPENAI_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
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

/**
 * Get or create the direct OpenAI client (for GPT models directly from OpenAI)
 * Uses lazy initialization to avoid eager loading of the OpenAI SDK
 */
export function getOpenAIDirectClient() {
  if (!openaiDirectInstance) {
    // Dynamic import only when needed
    const OpenAI = require('openai').default;
    openaiDirectInstance = new OpenAI({
      apiKey:
        process.env.OPENAI_DIRECT_API_KEY ||
        process.env.OPENAI_EMBEDDING_API_KEY ||
        process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1', // Explicitly OpenAI, not AI Hub
    });
  }
  return openaiDirectInstance;
}

// Backward-compatible exports (deprecated - use getOpenAIClient/getOpenAIDirectClient instead)
export const openai = new Proxy({} as any, {
  get(_target, prop) {
    const client = getOpenAIClient();
    return Reflect.get(client, prop);
  },
});

export const openaiDirect = new Proxy({} as any, {
  get(_target, prop) {
    const client = getOpenAIDirectClient();
    return Reflect.get(client, prop);
  },
});

// Dynamic model names - reads from environment variables
// Lazy import to avoid circular dependency
function getModelNameLazy(slot: string): string {
  const { getModelName } = require('./model-config') as { getModelName: (s: string) => string };
  return getModelName(slot);
}

// Use getModelName() from model-config.ts for dynamic access
// This object provides legacy compatibility with static property access
export const modelNames = {
  get fast() {
    return getModelNameLazy('fast');
  },
  get default() {
    return getModelNameLazy('default');
  },
  get quality() {
    return getModelNameLazy('quality');
  },
  get premium() {
    return getModelNameLazy('premium');
  },
  get synthesizer() {
    return getModelNameLazy('synthesizer');
  },
  get research() {
    return getModelNameLazy('research');
  },
} as const;

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
  const modelName = modelNames[modelKey];

  // Setup timeout handling
  const timeoutMs = options.timeout ?? 60_000; // 60s default
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Combine external abort signal with our timeout
  const combinedSignal = options.abortSignal
    ? AbortSignal.any([options.abortSignal, controller.signal])
    : controller.signal;

  try {
    const { object, usage } = await generateObject({
      model: getProviderForSlot(modelKey)(modelName),
      schema: options.schema as any,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? defaultSettings.deterministic.temperature,
      maxOutputTokens: options.maxTokens ?? defaultSettings.deterministic.maxTokens,
      maxRetries: 3, // Built-in retry for rate limits
      abortSignal: combinedSignal,
    });

    // Log token usage for monitoring
    console.log(`[AI] Generated object with ${modelName}: ${usage.totalTokens} tokens`);

    return object as z.infer<T>;
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
