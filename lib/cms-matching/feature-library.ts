/**
 * Feature Library — shared utilities for ensuring features exist and upserting evaluations.
 *
 * All feature research paths (agent.ts, requirement-research-agent.ts, parallel-matrix-orchestrator.ts)
 * funnel through these helpers so that every researched feature is persisted relationally in the
 * `features` + `cms_feature_evaluations` tables.
 */

import { ilike } from 'drizzle-orm';

import { db } from '@/lib/db';
import { features, cmsFeatureEvaluations } from '@/lib/db/schema';

const DEFAULT_TTL_DAYS = 30;
let hasWarnedMissingFeatureLibraryTables = false;

function readErrorMessage(part: unknown): string {
  if (part instanceof Error) return part.message;
  if (typeof part === 'string') return part;
  if (typeof part === 'number' || typeof part === 'boolean' || typeof part === 'bigint') {
    return String(part);
  }
  if (part && typeof part === 'object' && 'message' in part) {
    const msg = (part as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return '';
}

function readErrorCode(part: unknown): string | null {
  if (!part || typeof part !== 'object') return null;
  if ('code' in part) {
    const code = (part as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim().length > 0) return code;
  }
  return null;
}

function collectErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();

  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    if (!('cause' in current)) break;
    current = (current as { cause?: unknown }).cause;
  }

  if (chain.length === 0) chain.push(error);
  return chain;
}

export function isMissingFeatureLibraryTablesError(error: unknown): boolean {
  const chain = collectErrorChain(error);
  const combinedMessage = chain.map(readErrorMessage).join(' | ').toLowerCase();
  const codes = chain.map(readErrorCode).filter((code): code is string => Boolean(code));

  const isMissingRelation = codes.includes('42P01') || combinedMessage.includes('does not exist');
  if (!isMissingRelation) return false;

  return (
    combinedMessage.includes('"features"') ||
    combinedMessage.includes('"cms_feature_evaluations"') ||
    /relation\s+features\b/i.test(combinedMessage) ||
    /relation\s+cms_feature_evaluations\b/i.test(combinedMessage)
  );
}

function warnMissingFeatureLibraryTablesOnce(): void {
  if (hasWarnedMissingFeatureLibraryTables) return;
  hasWarnedMissingFeatureLibraryTables = true;
  console.warn(
    '[Feature Library] Tabellen "features"/"cms_feature_evaluations" fehlen. Dual-Write wird übersprungen.'
  );
}

// ─── Slug helpers (extracted from lib/agent-tools/tools/feature.ts) ───────────

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

// ─── Category detection ──────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  compliance: [
    'gdpr',
    'dsgvo',
    'accessibility',
    'barrierefreiheit',
    'wcag',
    'a11y',
    'compliance',
    'datenschutz',
  ],
  security: ['security', 'sicherheit', 'authentication', 'auth', 'sso', '2fa', 'mfa', 'encryption'],
  performance: ['performance', 'caching', 'cdn', 'speed', 'lazy', 'optimization'],
  integration: ['api', 'graphql', 'rest', 'webhook', 'integration', 'headless', 'decoupled'],
  content: [
    'content',
    'editor',
    'wysiwyg',
    'media',
    'asset',
    'workflow',
    'publishing',
    'versioning',
  ],
  commerce: ['commerce', 'shop', 'cart', 'payment', 'checkout', 'product', 'catalog'],
  i18n: ['multilingual', 'mehrsprachigkeit', 'i18n', 'l10n', 'translation', 'locale'],
  technical: ['deployment', 'docker', 'kubernetes', 'ci', 'cli', 'migration', 'upgrade'],
};

function detectCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'functional';
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

const featureIdCache = new Map<string, string>();

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ─── ensureFeatureExists ─────────────────────────────────────────────────────

export async function ensureFeatureExists(name: string, category?: string): Promise<string> {
  const key = normalizeKey(name);

  // Check in-memory cache first
  const cached = featureIdCache.get(key);
  if (cached) return cached;

  // Case-insensitive DB lookup
  const [existing] = await db
    .select({ id: features.id })
    .from(features)
    .where(ilike(features.name, key))
    .limit(1);

  if (existing) {
    featureIdCache.set(key, existing.id);
    return existing.id;
  }

  // Create new feature
  const slug = await ensureUniqueSlug(name);
  const detectedCategory = category || detectCategory(name);

  const [created] = await db
    .insert(features)
    .values({
      name: name.trim(),
      slug,
      category: detectedCategory,
    })
    .returning({ id: features.id });

  featureIdCache.set(key, created.id);
  return created.id;
}

// ─── upsertFeatureEvaluation ─────────────────────────────────────────────────

export interface UpsertFeatureEvaluationParams {
  featureName: string;
  featureCategory?: string;
  technologyId: string;
  score: number;
  reasoning?: string | null;
  confidence?: number | null;
  supportType?: string | null;
  moduleName?: string | null;
  sourceUrls?: string[] | null;
  notes?: string | null;
  ttlDays?: number;
}

export async function upsertFeatureEvaluation(
  params: UpsertFeatureEvaluationParams
): Promise<void> {
  try {
    const featureId = await ensureFeatureExists(params.featureName, params.featureCategory);

    const ttlDays = params.ttlDays ?? DEFAULT_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const sourceUrlsJson = params.sourceUrls?.length ? JSON.stringify(params.sourceUrls) : null;

    await db
      .insert(cmsFeatureEvaluations)
      .values({
        featureId,
        technologyId: params.technologyId,
        score: params.score,
        reasoning: params.reasoning ?? null,
        confidence: params.confidence ?? null,
        supportType: params.supportType ?? null,
        moduleName: params.moduleName ?? null,
        sourceUrls: sourceUrlsJson,
        notes: params.notes ?? null,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [cmsFeatureEvaluations.featureId, cmsFeatureEvaluations.technologyId],
        set: {
          score: params.score,
          reasoning: params.reasoning ?? null,
          confidence: params.confidence ?? null,
          supportType: params.supportType ?? null,
          moduleName: params.moduleName ?? null,
          sourceUrls: sourceUrlsJson,
          notes: params.notes ?? null,
          expiresAt,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    if (isMissingFeatureLibraryTablesError(error)) {
      warnMissingFeatureLibraryTablesOnce();
      return;
    }
    throw error;
  }
}
