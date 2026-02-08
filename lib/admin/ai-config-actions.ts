'use server';

import { isIP } from 'net';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { invalidateModelConfigCache } from '@/lib/ai/model-config';
import { db } from '@/lib/db';
import { aiProviderConfigs, aiModelSlotConfigs } from '@/lib/db/schema';
import type { AIModelSlotConfig } from '@/lib/db/schema';

export type ProviderModel = {
  id: string;
  ownedBy: string;
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  'ai-hub': process.env.AI_HUB_BASE_URL || 'https://adesso-ai-hub.3asabc.de/v1',
  openai: 'https://api.openai.com/v1',
};

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(n => Number(n));
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::1') return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true; // unique local
  if (v.startsWith('fe80:')) return true; // link-local
  return false;
}

function validateProviderBaseUrl(providerKey: string, rawBaseUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    return null;
  }

  if (url.username || url.password) return null;
  if (url.protocol !== 'https:') return null;

  const hostname = url.hostname.toLowerCase();

  // Allow localhost only in non-production environments (developer convenience).
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    if (process.env.NODE_ENV !== 'production') return url;
    return null;
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIPv4(hostname)) return null;
  if (ipVersion === 6 && isPrivateIPv6(hostname)) return null;
  if (ipVersion !== 0) return null; // reject IP literals entirely (even public)

  if (providerKey === 'openai') {
    return hostname === 'api.openai.com' ? url : null;
  }

  if (providerKey === 'ai-hub') {
    return hostname.endsWith('.3asabc.de') ? url : null;
  }

  return null;
}

function normalizeBaseUrlForJoin(url: URL): string {
  // URL resolution treats a base without trailing slash as a "file".
  // Ensure we join endpoints like /v1/models (not /models).
  return url.toString().replace(/\/?$/, '/');
}

export type AIProviderForUI = {
  id: string;
  providerKey: string;
  baseUrl: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string | null; // e.g. "sk-...abc3"
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ModelSlotWithProvider = AIModelSlotConfig & {
  provider: AIProviderForUI;
};

function maskApiKey(key: string | null): { hasApiKey: boolean; apiKeyPreview: string | null } {
  if (!key) return { hasApiKey: false, apiKeyPreview: null };
  if (key.length <= 8) return { hasApiKey: true, apiKeyPreview: '••••••••' };
  return {
    hasApiKey: true,
    apiKeyPreview: `${key.slice(0, 4)}...${key.slice(-4)}`,
  };
}

/**
 * Get all AI providers (with masked API key preview)
 */
export async function getAIProviders(): Promise<AIProviderForUI[]> {
  try {
    const providers = await db
      .select()
      .from(aiProviderConfigs)
      .orderBy(aiProviderConfigs.providerKey);

    return providers.map(p => ({
      id: p.id,
      providerKey: p.providerKey,
      baseUrl: p.baseUrl,
      isEnabled: p.isEnabled,
      ...maskApiKey(p.apiKey),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    return [];
  }
}

/**
 * Update an AI provider's settings.
 * Requires admin role. Accepts apiKey, baseUrl, isEnabled.
 */
export async function updateAIProvider(
  id: string,
  data: { apiKey?: string | null; baseUrl?: string | null; isEnabled?: boolean }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }
  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    // Only set fields that are explicitly passed
    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.apiKey !== undefined) setData.apiKey = data.apiKey;
    if (data.baseUrl !== undefined) setData.baseUrl = data.baseUrl;
    if (data.isEnabled !== undefined) setData.isEnabled = data.isEnabled;

    const [updated] = await db
      .update(aiProviderConfigs)
      .set(setData)
      .where(eq(aiProviderConfigs.id, id))
      .returning();

    invalidateModelConfigCache();
    revalidatePath('/admin/configs');
    return { success: true, provider: updated };
  } catch (error) {
    console.error('Error updating AI provider:', error);
    return { success: false, error: 'Fehler beim Speichern' };
  }
}

/**
 * Get all model slots with their provider info
 */
export async function getModelSlots(): Promise<ModelSlotWithProvider[]> {
  try {
    const rows = await db
      .select()
      .from(aiModelSlotConfigs)
      .innerJoin(aiProviderConfigs, eq(aiModelSlotConfigs.providerId, aiProviderConfigs.id))
      .orderBy(aiModelSlotConfigs.slot);

    return rows.map(row => ({
      ...row.ai_model_slot_configs,
      provider: {
        id: row.ai_provider_configs.id,
        providerKey: row.ai_provider_configs.providerKey,
        baseUrl: row.ai_provider_configs.baseUrl,
        isEnabled: row.ai_provider_configs.isEnabled,
        ...maskApiKey(row.ai_provider_configs.apiKey),
        createdAt: row.ai_provider_configs.createdAt,
        updatedAt: row.ai_provider_configs.updatedAt,
      },
    }));
  } catch (error) {
    console.error('Error fetching model slots:', error);
    return [];
  }
}

/**
 * Update a model slot's configuration.
 * Sets isOverridden = true automatically.
 */
export async function updateModelSlot(
  slotId: string,
  data: { providerId: string; modelName: string }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }
  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    const [updated] = await db
      .update(aiModelSlotConfigs)
      .set({
        providerId: data.providerId,
        modelName: data.modelName,
        isOverridden: true,
        updatedAt: new Date(),
      })
      .where(eq(aiModelSlotConfigs.id, slotId))
      .returning();

    invalidateModelConfigCache();
    revalidatePath('/admin/configs');
    return { success: true, slot: updated };
  } catch (error) {
    console.error('Error updating model slot:', error);
    return { success: false, error: 'Fehler beim Speichern' };
  }
}

/**
 * Reset a model slot to its default (sets isOverridden = false).
 */
export async function resetModelSlot(slotId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }
  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    const [updated] = await db
      .update(aiModelSlotConfigs)
      .set({
        isOverridden: false,
        updatedAt: new Date(),
      })
      .where(eq(aiModelSlotConfigs.id, slotId))
      .returning();

    invalidateModelConfigCache();
    revalidatePath('/admin/configs');
    return { success: true, slot: updated };
  } catch (error) {
    console.error('Error resetting model slot:', error);
    return { success: false, error: 'Fehler beim Zurücksetzen' };
  }
}

/**
 * Fetch available models from a provider's API.
 * Uses the OpenAI-compatible GET /models endpoint.
 */
export async function fetchProviderModels(
  providerId: string
): Promise<{ success: true; models: ProviderModel[] } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Nicht authentifiziert' };
  if (session.user.role !== 'admin') return { success: false, error: 'Keine Berechtigung' };

  try {
    const [provider] = await db
      .select({
        apiKey: aiProviderConfigs.apiKey,
        baseUrl: aiProviderConfigs.baseUrl,
        providerKey: aiProviderConfigs.providerKey,
      })
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.id, providerId))
      .limit(1);

    if (!provider) return { success: false, error: 'Provider nicht gefunden' };
    if (!provider.apiKey) return { success: false, error: 'Kein API Key konfiguriert' };

    const baseUrl = provider.baseUrl || DEFAULT_BASE_URLS[provider.providerKey];
    if (!baseUrl) return { success: false, error: 'Keine Base URL konfiguriert' };

    const validatedBase = validateProviderBaseUrl(provider.providerKey, baseUrl);
    if (!validatedBase) return { success: false, error: 'Ungültige Base URL (Sicherheitsprüfung)' };

    const modelsUrl = new URL('models', normalizeBaseUrlForJoin(validatedBase)).toString();

    const res = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403)
        return { success: false, error: 'API Key ungültig oder keine Berechtigung' };
      return { success: false, error: `API-Fehler: ${status} ${res.statusText}` };
    }

    const data = (await res.json()) as { data?: { id: string; owned_by?: string }[] };
    const models: ProviderModel[] = (data.data || [])
      .map(m => ({ id: m.id, ownedBy: m.owned_by || '' }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return { success: true, models };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { success: false, error: 'Zeitüberschreitung — Provider nicht erreichbar' };
    }
    console.error('Error fetching provider models:', error);
    return { success: false, error: 'Verbindungsfehler zum Provider' };
  }
}
