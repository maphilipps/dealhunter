import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { features } from '@/lib/db/schema';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const normalized = slugify(base) || 'feature';

  const existing = await db
    .select({ slug: features.slug })
    .from(features)
    .where(ilike(features.slug, `${normalized}%`));

  const used = new Set(existing.map(r => r.slug));
  if (!used.has(normalized)) return normalized;

  for (let i = 2; i <= 50; i++) {
    const candidate = `${normalized}-${i}`;
    if (!used.has(candidate)) return candidate;
  }

  return `${normalized}-${Date.now()}`;
}

// ─── feature.list ─────────────────────────────────────────────────────────────

const listFeaturesInputSchema = z.object({
  q: z.string().min(1).optional().describe('Search in name/slug'),
  category: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  limit: z.number().min(1).max(200).default(100),
});

registry.register({
  name: 'feature.list',
  description:
    'List features from the Feature Library, optionally filtered by category/isActive/search',
  category: 'qualification-scan',
  inputSchema: listFeaturesInputSchema,
  async execute(input) {
    const conditions = [];

    if (input.category) conditions.push(eq(features.category, input.category));
    if (input.isActive !== undefined) conditions.push(eq(features.isActive, input.isActive));
    if (input.q) {
      const like = `%${input.q}%`;
      conditions.push(or(ilike(features.name, like), ilike(features.slug, like)));
    }

    const whereClause =
      conditions.length === 0
        ? sql`true`
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const results = await db
      .select()
      .from(features)
      .where(whereClause)
      .orderBy(desc(features.priority), desc(features.createdAt))
      .limit(input.limit);

    return { success: true, data: results };
  },
});

// ─── feature.get ──────────────────────────────────────────────────────────────

const getFeatureInputSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().optional(),
  })
  .refine(v => Boolean(v.id || v.slug), { message: 'Provide either id or slug' });

registry.register({
  name: 'feature.get',
  description: 'Get a single feature by id or slug',
  category: 'qualification-scan',
  inputSchema: getFeatureInputSchema,
  async execute(input) {
    const where = input.id ? eq(features.id, input.id) : eq(features.slug, input.slug!);
    const [row] = await db.select().from(features).where(where).limit(1);
    if (!row) return { success: false, error: 'Feature not found' };
    return { success: true, data: row };
  },
});

// ─── feature.create ───────────────────────────────────────────────────────────

const createFeatureInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  category: z.string().min(1).default('functional'),
  description: z.string().optional(),
  priority: z.number().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});

registry.register({
  name: 'feature.create',
  description: 'Create a new feature (admin only)',
  category: 'qualification-scan',
  inputSchema: createFeatureInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Features erstellen' };
    }

    const slug = input.slug?.trim()
      ? await ensureUniqueSlug(input.slug)
      : await ensureUniqueSlug(input.name);

    const [created] = await db
      .insert(features)
      .values({
        name: input.name,
        slug,
        category: input.category,
        description: input.description,
        priority: input.priority,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .returning();

    return { success: true, data: created };
  },
});

// ─── feature.update ───────────────────────────────────────────────────────────

const updateFeatureInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

registry.register({
  name: 'feature.update',
  description: 'Update an existing feature (admin only)',
  category: 'qualification-scan',
  inputSchema: updateFeatureInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Features bearbeiten' };
    }

    const [existing] = await db.select().from(features).where(eq(features.id, input.id)).limit(1);
    if (!existing) return { success: false, error: 'Feature not found' };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    if (input.slug !== undefined) {
      const slug = await ensureUniqueSlug(input.slug);
      updateData.slug = slug;
    }

    const [updated] = await db
      .update(features)
      .set(updateData)
      .where(eq(features.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

// ─── feature.delete ───────────────────────────────────────────────────────────

const deleteFeatureInputSchema = z.object({
  id: z.string(),
  hard: z
    .boolean()
    .default(false)
    .describe('Hard delete row. Default: soft delete (set isActive=false).'),
});

registry.register({
  name: 'feature.delete',
  description: 'Delete a feature (admin only). Defaults to soft-delete by setting isActive=false.',
  category: 'qualification-scan',
  inputSchema: deleteFeatureInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole !== 'admin') {
      return { success: false, error: 'Nur Admin kann Features löschen' };
    }

    const [existing] = await db.select().from(features).where(eq(features.id, input.id)).limit(1);
    if (!existing) return { success: false, error: 'Feature not found' };

    if (!input.hard) {
      const [updated] = await db
        .update(features)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(features.id, input.id))
        .returning();
      return {
        success: true,
        data: { id: input.id, deleted: true, mode: 'soft', feature: updated },
      };
    }

    try {
      await db.delete(features).where(eq(features.id, input.id));
      return {
        success: true,
        data: { id: input.id, deleted: true, mode: 'hard', feature: existing },
      };
    } catch (error) {
      console.error('feature.delete hard delete failed:', error);
      return {
        success: false,
        error:
          'Hard delete fehlgeschlagen (vermutlich wegen Referenzen). Nutze hard=false fuer Soft-Delete.',
      };
    }
  },
});
