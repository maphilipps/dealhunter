import OpenAI from 'openai';
import { z } from 'zod';

// AI Hub Client (für Claude-Modelle via adesso AI Hub)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
});

// Direct OpenAI Client (für GPT-Modelle direkt bei OpenAI)
export const openaiDirect = new OpenAI({
  apiKey: process.env.OPENAI_EMBEDDING_API_KEY,
  baseURL: 'https://api.openai.com/v1', // Explizit OpenAI, nicht AI Hub
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
