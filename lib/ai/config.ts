/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';

// Lazy-initialized OpenAI clients to reduce bundle size
// Only the OpenAI SDK is imported (not multiple providers)
// This implements Vercel React Best Practice: bundle-conditional
let openaiInstance: any = null;
let openaiDirectInstance: any = null;

// Initialize AI SDK OpenAI provider
export const aiHubOpenAI = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

// Direct OpenAI provider for specific models if needed
export const directOpenAI = createOpenAI({
  apiKey: process.env.OPENAI_EMBEDDING_API_KEY, // Use specific key if needed
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
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
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
      apiKey: process.env.OPENAI_EMBEDDING_API_KEY,
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

export const modelNames = {
  fast: 'gemini-3-flash-preview',
  default: 'gemini-3-flash-preview',
  quality: 'gemini-3-flash-preview',
  premium: 'gemini-3-flash-preview',
  'sonnet-4-5': 'gemini-3-flash-preview',
  // Fast synthesizer model for section synthesis (lower latency)
  synthesizer: 'claude-haiku-*',
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
}): Promise<z.infer<T>> {
  const modelKey = options.model ?? 'default';
  const modelName = modelNames[modelKey];

  try {
    const { object, usage } = await generateObject({
      model: aiHubOpenAI(modelName),
      schema: options.schema as any,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? defaultSettings.deterministic.temperature,
      maxOutputTokens: options.maxTokens ?? defaultSettings.deterministic.maxTokens,
      maxRetries: 3, // Built-in retry for rate limits
    });

    // Log token usage for monitoring
    console.log(`[AI] Generated object with ${modelName}: ${usage.totalTokens} tokens`);

    return object as z.infer<T>;
  } catch (error) {
    console.error('[generateStructuredOutput] Error:', error);
    // Propagate error for the caller to handle, now with better types from AI SDK
    throw error;
  }
}
