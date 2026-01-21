/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { z } from 'zod';

// Lazy-initialized OpenAI clients to reduce bundle size
// Only the OpenAI SDK is imported (not multiple providers)
// This implements Vercel React Best Practice: bundle-conditional
let openaiInstance: any = null;
let openaiDirectInstance: any = null;

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
  get(target, prop) {
    const client = getOpenAIClient();
    return Reflect.get(client, prop);
  },
});

export const openaiDirect = new Proxy({} as any, {
  get(target, prop) {
    const client = getOpenAIDirectClient();
    return Reflect.get(client, prop);
  },
});

export const modelNames = {
  fast: 'claude-haiku-4.5',
  default: 'claude-haiku-4.5',
  quality: 'claude-sonnet-4',
  premium: 'claude-sonnet-4',
} as const;

export const defaultSettings = {
  deterministic: {
    temperature: 0.3,
    maxTokens: 4000,
  },
  creative: {
    temperature: 0.7,
    maxTokens: 4000,
  },
  longForm: {
    temperature: 0.5,
    maxTokens: 8000,
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
  const modelName = modelNames[options.model ?? 'default'];

  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.prompt },
    ],
    temperature: options.temperature ?? defaultSettings.deterministic.temperature,
    max_tokens: options.maxTokens ?? defaultSettings.deterministic.maxTokens,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  const cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const rawResult = JSON.parse(cleanedResponse);

  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return options.schema.parse(cleanedResult);
}
