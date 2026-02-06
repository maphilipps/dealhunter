'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiProviderConfigs, aiModelSlotConfigs } from '@/lib/db/schema';
import type { AIModelSlotConfig } from '@/lib/db/schema';

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

    revalidatePath('/admin/configs');
    return { success: true, slot: updated };
  } catch (error) {
    console.error('Error resetting model slot:', error);
    return { success: false, error: 'Fehler beim Zurücksetzen' };
  }
}
