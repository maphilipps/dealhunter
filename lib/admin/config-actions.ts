'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { configs, type Config } from '@/lib/db/schema';

/**
 * Known config keys for type-safe access
 */
export type ConfigKey =
  | 'bit_weights'
  | 'bit_threshold'
  | 'cms_scoring_weights'
  | 'cms_size_affinity'
  | 'cms_industry_affinity'
  | 'tech_to_bu_mapping';

/**
 * Get a single config value by key.
 * Returns the parsed JSON value, or null if not found.
 */
export async function getConfig<T = unknown>(key: ConfigKey): Promise<T | null> {
  try {
    const [config] = await db.select().from(configs).where(eq(configs.key, key)).limit(1);

    if (!config) return null;
    return JSON.parse(config.value) as T;
  } catch (error) {
    console.error(`Error fetching config "${key}":`, error);
    return null;
  }
}

/**
 * Get all configs, optionally filtered by category.
 */
export async function getConfigs(category?: Config['category']): Promise<Config[]> {
  try {
    if (category) {
      return await db
        .select()
        .from(configs)
        .where(eq(configs.category, category))
        .orderBy(configs.key);
    }
    return await db.select().from(configs).orderBy(configs.key);
  } catch (error) {
    console.error('Error fetching configs:', error);
    return [];
  }
}

/**
 * Upsert a config value (insert or update).
 * Requires admin role.
 */
export async function setConfig(
  key: ConfigKey,
  value: unknown,
  options: {
    category: Config['category'];
    description?: string;
  }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  const jsonValue = JSON.stringify(value);

  try {
    const [existing] = await db.select().from(configs).where(eq(configs.key, key)).limit(1);

    if (existing) {
      const [updated] = await db
        .update(configs)
        .set({
          value: jsonValue,
          description: options.description ?? existing.description,
          version: existing.version + 1,
          updatedByUserId: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(configs.key, key))
        .returning();

      revalidatePath('/admin');
      return { success: true, config: updated };
    }

    const [created] = await db
      .insert(configs)
      .values({
        key,
        category: options.category,
        value: jsonValue,
        description: options.description,
        updatedByUserId: session.user.id,
      })
      .returning();

    revalidatePath('/admin');
    return { success: true, config: created };
  } catch (error) {
    console.error(`Error setting config "${key}":`, error);
    return { success: false, error: 'Fehler beim Speichern der Konfiguration' };
  }
}

/**
 * Delete a config entry. Requires admin role.
 */
export async function deleteConfig(key: ConfigKey) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung' };
  }

  try {
    await db.delete(configs).where(eq(configs.key, key));
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error(`Error deleting config "${key}":`, error);
    return { success: false, error: 'Fehler beim Löschen der Konfiguration' };
  }
}
