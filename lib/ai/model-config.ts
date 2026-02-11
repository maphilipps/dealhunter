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
  | 'vision'
  | 'embedding'
  | 'web-search';

// Model configuration
export interface ModelConfig {
  provider: AIProvider;
  modelName: string;
}

// Default model configurations (hardcoded fallbacks)
const DEFAULT_MODELS: Record<ModelSlot, ModelConfig> = {
  fast: { provider: 'openai', modelName: 'gpt-5.2-chat-latest' },
  default: { provider: 'openai', modelName: 'gpt-5.2' },
  quality: { provider: 'openai', modelName: 'gpt-5.2' },
  premium: { provider: 'openai', modelName: 'gpt-5.2-pro' },
  synthesizer: { provider: 'openai', modelName: 'gpt-5.2-chat-latest' },
  research: { provider: 'openai', modelName: 'gpt-5.2-pro' },
  vision: { provider: 'openai', modelName: 'gpt-4o-mini' },
  embedding: { provider: 'openai', modelName: 'text-embedding-3-large' },
  'web-search': { provider: 'openai', modelName: 'gpt-4o-mini' },
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
    console.warn('[AI Config] Failed to load DB config, falling back to env vars:', error);
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

  // Env variable fallback for model selection (not credentials)
  const envPrefix = `AI_MODEL_${slot.toUpperCase()}`;
  const provider =
    (process.env[`${envPrefix}_PROVIDER`] as AIProvider) || DEFAULT_MODELS[slot].provider;
  const modelName = process.env[`${envPrefix}_NAME`] || DEFAULT_MODELS[slot].modelName;

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
  const slots = Object.keys(DEFAULT_MODELS) as ModelSlot[];

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

// ─── Env-var Helpers ─────────────────────────────────────────────────────────────

const ENV_KEYS: Record<AIProvider, { apiKey?: string; baseUrl?: string; defaultBaseUrl?: string }> =
  {
    'ai-hub': {
      apiKey: 'AI_HUB_API_KEY',
      baseUrl: 'AI_HUB_BASE_URL',
      defaultBaseUrl: 'https://adesso-ai-hub.3asabc.de/v1',
    },
    openai: { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL' },
    vercel: {},
  };

function getEnvApiKey(provider: AIProvider): string | undefined {
  const key = ENV_KEYS[provider].apiKey;
  return key ? process.env[key] : undefined;
}

function getEnvBaseUrl(provider: AIProvider): string | undefined {
  const cfg = ENV_KEYS[provider];
  if (cfg.baseUrl) {
    return process.env[cfg.baseUrl] ?? cfg.defaultBaseUrl;
  }
  return cfg.defaultBaseUrl;
}

// ─── Provider Instances ──────────────────────────────────────────────────────────

const providerCache = new Map<string, OpenAIProvider>();

function getProviderInstance(provider: AIProvider): OpenAIProvider {
  const dbProvider = dbCache?.providers.get(provider);
  const apiKey = dbProvider?.apiKey ?? getEnvApiKey(provider);
  const baseURL = dbProvider?.baseUrl ?? getEnvBaseUrl(provider);

  const cacheKey = `${provider}:${baseURL}:${apiKey?.slice(-4)}`;
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
 * Get a model instance for a slot (async — ensures DB config is loaded)
 *
 * Uses .chat() explicitly to force the Chat Completions API format.
 * The default provider(modelName) uses the Responses API, which fails with
 * LiteLLM/Gemini because Gemini returns text:null for tool-only responses,
 * violating the AI SDK's response schema validation.
 */
export async function getModel(slot: ModelSlot) {
  await loadDBConfig();
  const config = getModelConfig(slot);
  const provider = getProviderInstance(config.provider);
  return provider.chat(config.modelName);
}

/**
 * Get the provider's .chat() function for a slot (for ToolLoopAgent etc.)
 * Async — ensures DB config is loaded before resolving.
 *
 * Returns provider.chat (Chat Completions API) instead of the raw provider
 * to avoid the Responses API format which is incompatible with LiteLLM proxies.
 * Callers use it as: (await getModelProvider(slot))(modelName)
 */
export async function getModelProvider(slot: ModelSlot) {
  await loadDBConfig();
  const config = getModelConfig(slot);
  return getProviderInstance(config.provider).chat;
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

// ─── Provider Credentials ─────────────────────────────────────────────────────

export interface ProviderCredentials {
  apiKey: string | undefined;
  baseURL: string | undefined;
}

/**
 * Get credentials for a provider (DB → Env fallback).
 * Ensures the DB config cache is loaded before resolving.
 */
export async function getProviderCredentials(provider: AIProvider): Promise<ProviderCredentials> {
  await loadDBConfig();

  const dbProvider = dbCache?.providers.get(provider);
  return {
    apiKey: dbProvider?.apiKey ?? getEnvApiKey(provider),
    baseURL: dbProvider?.baseUrl ?? getEnvBaseUrl(provider),
  };
}

// Legacy compatibility exports
export const modelNames = new Proxy({} as Record<ModelSlot, string>, {
  get(_, prop: string) {
    if (prop in DEFAULT_MODELS) {
      return getModelName(prop as ModelSlot);
    }
    return undefined;
  },
});
