/**
 * Dynamic AI Model Configuration
 *
 * Allows per-model configuration of provider and model name.
 * Each model slot (fast, default, quality, premium, synthesizer) can be
 * configured independently via environment variables.
 *
 * Environment Variables:
 * - AI_MODEL_<SLOT>_PROVIDER: 'ai-hub' | 'openai' (default: 'ai-hub')
 * - AI_MODEL_<SLOT>_NAME: Model name (e.g., 'claude-sonnet-4', 'gpt-4o')
 *
 * Example:
 * AI_MODEL_FAST_PROVIDER=ai-hub
 * AI_MODEL_FAST_NAME=gemini-3-flash-preview
 * AI_MODEL_QUALITY_PROVIDER=openai
 * AI_MODEL_QUALITY_NAME=gpt-4o
 */

import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';

// Provider types
export type AIProvider = 'ai-hub' | 'openai';

// Model slot types
export type ModelSlot = 'fast' | 'default' | 'quality' | 'premium' | 'synthesizer' | 'research' | 'vision';

// Model configuration
export interface ModelConfig {
  provider: AIProvider;
  modelName: string;
}

// Provider configurations
const AI_HUB_CONFIG = {
  apiKey: process.env.AI_HUB_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_HUB_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
};

const OPENAI_CONFIG = {
  // Use dedicated OpenAI key, fallback to embedding key (which is direct OpenAI)
  apiKey:
    process.env.OPENAI_DIRECT_API_KEY ||
    process.env.OPENAI_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
};

// Default model configurations (fallbacks)
// Use OpenAI GPT-5.2 for core reasoning; keep PDF/vision on a model that supports PDF file inputs.
const DEFAULT_MODELS: Record<ModelSlot, ModelConfig> = {
  fast: { provider: 'openai', modelName: 'gpt-5.2-chat-latest' },
  default: { provider: 'openai', modelName: 'gpt-5.2' },
  quality: { provider: 'openai', modelName: 'gpt-5.2' },
  premium: { provider: 'openai', modelName: 'gpt-5.2-pro' },
  synthesizer: { provider: 'openai', modelName: 'gpt-5.2-chat-latest' },
  research: { provider: 'openai', modelName: 'gpt-5.2-pro' },
  vision: { provider: 'openai', modelName: 'gpt-4o-mini' }, // PDF file inputs require text+image capable models
};

// Cached provider instances
const providerCache = new Map<AIProvider, OpenAIProvider>();

/**
 * Get the model configuration for a slot
 * Reads from environment variables with fallback to defaults
 */
export function getModelConfig(slot: ModelSlot): ModelConfig {
  const envPrefix = `AI_MODEL_${slot.toUpperCase()}`;
  
  let provider =
    (process.env[`${envPrefix}_PROVIDER`] as AIProvider) || DEFAULT_MODELS[slot].provider;
  const modelName = process.env[`${envPrefix}_NAME`] || DEFAULT_MODELS[slot].modelName;

  const directOpenAIKey =
    process.env.OPENAI_DIRECT_API_KEY ||
    process.env.OPENAI_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY;

  // If a direct OpenAI key exists and model looks like OpenAI, force provider to OpenAI
  if (directOpenAIKey && modelName.startsWith('gpt-')) {
    provider = 'openai';
  }

  return { provider, modelName };
}

/**
 * Get all model configurations (for admin UI / debugging)
 */
export function getAllModelConfigs(): Record<ModelSlot, ModelConfig & { envOverride: boolean }> {
  const slots: ModelSlot[] = ['fast', 'default', 'quality', 'premium', 'synthesizer', 'research'];
  
  return slots.reduce((acc, slot) => {
    const envPrefix = `AI_MODEL_${slot.toUpperCase()}`;
    const hasEnvOverride = !!(process.env[`${envPrefix}_PROVIDER`] || process.env[`${envPrefix}_NAME`]);
    
    acc[slot] = {
      ...getModelConfig(slot),
      envOverride: hasEnvOverride,
    };
    return acc;
  }, {} as Record<ModelSlot, ModelConfig & { envOverride: boolean }>);
}

/**
 * Get or create a provider instance
 */
function getProviderInstance(provider: AIProvider): OpenAIProvider {
  if (providerCache.has(provider)) {
    return providerCache.get(provider)!;
  }

  const config = provider === 'ai-hub' ? AI_HUB_CONFIG : OPENAI_CONFIG;
  
  if (!config.apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  const instance = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  providerCache.set(provider, instance);
  return instance;
}

/**
 * Get a model instance for a slot
 * Returns a callable that produces a LanguageModel
 */
export function getModel(slot: ModelSlot) {
  const config = getModelConfig(slot);
  const provider = getProviderInstance(config.provider);
  return provider(config.modelName);
}

/**
 * Get the provider function for a slot (for ToolLoopAgent etc.)
 */
export function getModelProvider(slot: ModelSlot) {
  const config = getModelConfig(slot);
  return getProviderInstance(config.provider);
}

/**
 * Get just the model name for a slot (for logging etc.)
 */
export function getModelName(slot: ModelSlot): string {
  return getModelConfig(slot).modelName;
}

/**
 * Log current model configuration (for debugging)
 */
export function logModelConfig(): void {
  const configs = getAllModelConfigs();
  console.log('[AI Config] Model Configuration:');
  for (const [slot, config] of Object.entries(configs)) {
    const source = config.envOverride ? '(env)' : '(default)';
    console.log(`  ${slot}: ${config.provider}/${config.modelName} ${source}`);
  }
}

// Legacy compatibility exports
export const modelNames = new Proxy({} as Record<ModelSlot, string>, {
  get(_, prop: string) {
    if (['fast', 'default', 'quality', 'premium', 'synthesizer', 'research'].includes(prop)) {
      return getModelName(prop as ModelSlot);
    }
    return undefined;
  },
});
