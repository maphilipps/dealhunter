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
  const modelName = modelNames[options.model ?? 'default'];

  // Enhance system prompt to explicitly request JSON output
  const jsonSystemPrompt = `${options.system}

CRITICAL: You MUST respond with valid JSON only. No markdown, no explanations, no code blocks.
Start your response with { and end with }. Ensure all required fields are present.`;

  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: jsonSystemPrompt },
      { role: 'user', content: options.prompt },
    ],
    temperature: options.temperature ?? defaultSettings.deterministic.temperature,
    max_tokens: options.maxTokens ?? defaultSettings.deterministic.maxTokens,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  // Clean response: remove markdown code blocks and trim
  let cleanedResponse = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Try to extract JSON if response contains other text
  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0];
  }

  let rawResult: Record<string, unknown>;
  try {
    rawResult = JSON.parse(cleanedResponse);
  } catch (parseError) {
    // Try to repair truncated JSON by closing open brackets
    let repairedJson = cleanedResponse;

    // Count open brackets and close them
    const openBraces = (repairedJson.match(/\{/g) || []).length;
    const closeBraces = (repairedJson.match(/\}/g) || []).length;
    const openBrackets = (repairedJson.match(/\[/g) || []).length;
    const closeBrackets = (repairedJson.match(/\]/g) || []).length;

    // Remove trailing incomplete elements (after last comma)
    repairedJson = repairedJson.replace(/,\s*"[^"]*"?\s*:?\s*[^,\]\}]*$/, '');
    repairedJson = repairedJson.replace(/,\s*\{[^\}]*$/, '');
    repairedJson = repairedJson.replace(/,\s*$/, '');

    // Close unclosed brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repairedJson += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repairedJson += '}';
    }

    try {
      rawResult = JSON.parse(repairedJson);
      console.warn('[generateStructuredOutput] Repaired truncated JSON successfully');
    } catch {
      console.error(
        '[generateStructuredOutput] JSON parse failed. Response:',
        cleanedResponse.slice(0, 500)
      );
      console.error('[generateStructuredOutput] Parse error:', parseError);
      rawResult = {};
    }
  }

  // Normalize common field name aliases
  const fieldAliases: Record<string, string> = {
    legal_requirements: 'requirements',
    tech_requirements: 'requirements',
    deliverable_items: 'deliverables',
    timeline_milestones: 'milestones',
  };

  for (const [alias, canonical] of Object.entries(fieldAliases)) {
    if (alias in rawResult && !(canonical in rawResult)) {
      rawResult[canonical] = rawResult[alias];
      delete rawResult[alias];
    }
  }

  const cleanedResult = Object.fromEntries(
    Object.entries(rawResult).filter(([_, v]) => v !== null)
  );

  return options.schema.parse(cleanedResult);
}
