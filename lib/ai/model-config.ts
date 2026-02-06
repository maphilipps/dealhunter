/**
 * Dynamic AI Model Configuration
 *
 * Resolution order: DB (isOverridden) → Env Variable → Hardcoded Default
 *
 * DB tables:
 * - ai_provider_configs: Provider settings (apiKey, baseUrl, isEnabled)
 * - ai_model_slot_configs: Per-slot model assignment (slot → provider + model)
 *
 * Environment Variables (fallback when DB slot is not overridden):
 * - AI_MODEL_<SLOT>_PROVIDER: 'ai-hub' | 'openai' | 'vercel'
 * - AI_MODEL_<SLOT>_NAME: Model name (e.g., 'claude-sonnet-4', 'gpt-4o')
 */

import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';

import { db } from '@/lib/db';
import { aiProviderConfigs, aiModelSlotConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Provider types
export type AIProvider = 'ai-hub' | 'openai' | 'vercel';

// Model slot types
export type ModelSlot =
  | 'fast'
  | 'default'
  | 'quality'
  | 'premium'
  | 'synthesizer'
  | 'research'
  | 'vision';

// Model configuration
export interface ModelConfig {
  provider: AIProvider;
  modelName: string;
}

// Provider configurations from env (used as fallback when DB has no data)
const AI_HUB_CONFIG = {
  apiKey: process.env.AI_HUB_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_HUB_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
};

const OPENAI_CONFIG = {
  apiKey:
    process.env.OPENAI_DIRECT_API_KEY ||
    process.env.OPENAI_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
};

// Default model configurations (hardcoded fallbacks)
const DEFAULT_MODELS: Record<ModelSlot, ModelConfig> = {
  fast: { provider: 'openai', modelName: 'gpt-5.2-chat-latest' },
  default: { provider: 'openai', modelName: 'gpt-5.2' },
  quality: { provider: 'openai', modelName: 'gpt-5.2' },
  premium: { provider: 'openai', modelName: 'gpt-5.2-pro' },
  synthesizer: { provider: 'openai', modelName: 'gpt-5.2-chat-latest' },
  research: { provider: 'openai', modelName: 'gpt-5.2-pro' },
  vision: { provider: 'openai', modelName: 'gpt-4o-mini' },
};

// ─── DB Cache ────────────────────────────────────────────────────────────────────

interface DBProviderConfig {
  providerKey: AIProvider;
  apiKey: string | null;
  baseUrl: string | null;
  isEnabled: boolean;
}

interface DBSlotConfig {
  slot: string;
  providerKey: AIProvider;
  modelName: string;
  isOverridden: boolean;
  apiKey: string | null;
  baseUrl: string | null;
}

let dbCache: {
  providers: Map<string, DBProviderConfig>;
  slots: Map<string, DBSlotConfig>;
  loadedAt: number;
} | null = null;

const CACHE_TTL_MS = 60_000; // 60 seconds

async function loadDBConfig() {
  const now = Date.now();
  if (dbCache && now - dbCache.loadedAt < CACHE_TTL_MS) {
    return dbCache;
  }

  try {
    const [providers, slots] = await Promise.all([
      db.select().from(aiProviderConfigs),
      db
        .select({
          slot: aiModelSlotConfigs.slot,
          modelName: aiModelSlotConfigs.modelName,
          isOverridden: aiModelSlotConfigs.isOverridden,
          providerKey: aiProviderConfigs.providerKey,
          apiKey: aiProviderConfigs.apiKey,
          baseUrl: aiProviderConfigs.baseUrl,
        })
        .from(aiModelSlotConfigs)
        .innerJoin(aiProviderConfigs, eq(aiModelSlotConfigs.providerId, aiProviderConfigs.id)),
    ]);

    const providerMap = new Map<string, DBProviderConfig>();
    for (const p of providers) {
      providerMap.set(p.providerKey, {
        providerKey: p.providerKey as AIProvider,
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        isEnabled: p.isEnabled,
      });
    }

    const slotMap = new Map<string, DBSlotConfig>();
    for (const s of slots) {
      slotMap.set(s.slot, {
        slot: s.slot,
        providerKey: s.providerKey as AIProvider,
        modelName: s.modelName,
        isOverridden: s.isOverridden,
        apiKey: s.apiKey,
        baseUrl: s.baseUrl,
      });
    }

    dbCache = { providers: providerMap, slots: slotMap, loadedAt: now };
    return dbCache;
  } catch (error) {
    console.warn('[AI Config] Failed to load DB config, using env/defaults:', error);
    return null;
  }
}

/**
 * Invalidate the DB cache (call after admin UI changes)
 */
export function invalidateModelConfigCache() {
  dbCache = null;
}

// ─── Config Resolution ───────────────────────────────────────────────────────────

/**
 * Get the model configuration for a slot.
 * Resolution: DB (isOverridden=true) → Env Variable → Hardcoded Default
 */
export function getModelConfig(slot: ModelSlot): ModelConfig {
  // Check DB cache synchronously first (non-blocking)
  if (dbCache) {
    const dbSlot = dbCache.slots.get(slot);
    if (dbSlot?.isOverridden) {
      return { provider: dbSlot.providerKey, modelName: dbSlot.modelName };
    }
  }

  // Env variable fallback
  const envPrefix = `AI_MODEL_${slot.toUpperCase()}`;
  let provider =
    (process.env[`${envPrefix}_PROVIDER`] as AIProvider) || DEFAULT_MODELS[slot].provider;
  const modelName = process.env[`${envPrefix}_NAME`] || DEFAULT_MODELS[slot].modelName;

  const directOpenAIKey =
    process.env.OPENAI_DIRECT_API_KEY ||
    process.env.OPENAI_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (directOpenAIKey && modelName.startsWith('gpt-')) {
    provider = 'openai';
  }

  return { provider, modelName };
}

/**
 * Async version that ensures DB cache is loaded before resolving.
 * Use this at the start of agent workflows for accurate DB-first resolution.
 */
export async function getModelConfigAsync(slot: ModelSlot): Promise<ModelConfig> {
  await loadDBConfig();
  return getModelConfig(slot);
}

/**
 * Warm the cache — call once at server startup or before heavy agent usage.
 */
export async function warmModelConfigCache(): Promise<void> {
  await loadDBConfig();
}

/**
 * Get all model configurations (for admin UI / debugging)
 */
export function getAllModelConfigs(): Record<
  ModelSlot,
  ModelConfig & { source: 'db' | 'env' | 'default' }
> {
  const slots: ModelSlot[] = [
    'fast',
    'default',
    'quality',
    'premium',
    'synthesizer',
    'research',
    'vision',
  ];

  return slots.reduce(
    (acc, slot) => {
      // DB override?
      if (dbCache) {
        const dbSlot = dbCache.slots.get(slot);
        if (dbSlot?.isOverridden) {
          acc[slot] = {
            provider: dbSlot.providerKey,
            modelName: dbSlot.modelName,
            source: 'db',
          };
          return acc;
        }
      }

      // Env override?
      const envPrefix = `AI_MODEL_${slot.toUpperCase()}`;
      const hasEnvOverride = !!(
        process.env[`${envPrefix}_PROVIDER`] || process.env[`${envPrefix}_NAME`]
      );

      acc[slot] = {
        ...getModelConfig(slot),
        source: hasEnvOverride ? 'env' : 'default',
      };
      return acc;
    },
    {} as Record<ModelSlot, ModelConfig & { source: 'db' | 'env' | 'default' }>
  );
}

// ─── Provider Instances ──────────────────────────────────────────────────────────

const providerCache = new Map<string, OpenAIProvider>();

function getProviderInstance(provider: AIProvider): OpenAIProvider {
  // Build a cache key that includes DB-sourced baseUrl for uniqueness
  let apiKey: string | undefined;
  let baseURL: string | undefined;

  // Try DB config first
  if (dbCache) {
    const dbProvider = dbCache.providers.get(provider);
    if (dbProvider) {
      apiKey = dbProvider.apiKey ?? undefined;
      baseURL = dbProvider.baseUrl ?? undefined;
    }
  }

  // Fallback to env config
  if (!apiKey || !baseURL) {
    const envConfig = provider === 'openai' ? OPENAI_CONFIG : AI_HUB_CONFIG;
    apiKey = apiKey || envConfig.apiKey;
    baseURL = baseURL || envConfig.baseURL;
  }

  const cacheKey = `${provider}:${baseURL}`;
  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  const instance = createOpenAI({ apiKey, baseURL });
  providerCache.set(cacheKey, instance);
  return instance;
}

/**
 * Get a model instance for a slot
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
    console.log(`  ${slot}: ${config.provider}/${config.modelName} (${config.source})`);
  }
}

// Legacy compatibility exports
export const modelNames = new Proxy({} as Record<ModelSlot, string>, {
  get(_, prop: string) {
    if (
      ['fast', 'default', 'quality', 'premium', 'synthesizer', 'research', 'vision'].includes(prop)
    ) {
      return getModelName(prop as ModelSlot);
    }
    return undefined;
  },
});
