import { and, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';
import type { ToolResult } from '../types';

import { db } from '@/lib/db';
import { cmsFeatureEvaluations, features, technologies } from '@/lib/db/schema';

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── cmsEvaluation.list ───────────────────────────────────────────────────────

const listCmsEvaluationsInputSchema = z.object({
  technologyId: z.string().optional(),
  featureId: z.string().optional(),
  includeExpired: z.boolean().default(false),
  limit: z.number().min(1).max(200).default(100),
});

registry.register({
  name: 'cmsEvaluation.list',
  description:
    'List cached CMS x Feature evaluations (cms_feature_evaluations), optionally filtered by technologyId/featureId',
  category: 'qualification-scan',
  inputSchema: listCmsEvaluationsInputSchema,
  async execute(input, _context: ToolContext) {
    const conditions = [];
    if (input.technologyId)
      conditions.push(eq(cmsFeatureEvaluations.technologyId, input.technologyId));
    if (input.featureId) conditions.push(eq(cmsFeatureEvaluations.featureId, input.featureId));
    if (!input.includeExpired) conditions.push(gt(cmsFeatureEvaluations.expiresAt, new Date()));

    const whereClause =
      conditions.length === 0
        ? sql`true`
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const rows = await db
      .select({
        id: cmsFeatureEvaluations.id,
        featureId: cmsFeatureEvaluations.featureId,
        featureName: features.name,
        featureSlug: features.slug,
        technologyId: cmsFeatureEvaluations.technologyId,
        technologyName: technologies.name,
        score: cmsFeatureEvaluations.score,
        reasoning: cmsFeatureEvaluations.reasoning,
        expiresAt: cmsFeatureEvaluations.expiresAt,
        createdAt: cmsFeatureEvaluations.createdAt,
      })
      .from(cmsFeatureEvaluations)
      .leftJoin(features, eq(cmsFeatureEvaluations.featureId, features.id))
      .leftJoin(technologies, eq(cmsFeatureEvaluations.technologyId, technologies.id))
      .where(whereClause)
      .orderBy(desc(cmsFeatureEvaluations.createdAt))
      .limit(input.limit);

    return { success: true, data: rows };
  },
});

// ─── cmsEvaluation.get ────────────────────────────────────────────────────────

const getCmsEvaluationInputSchema = z
  .object({
    id: z.string().optional(),
    technologyId: z.string().optional(),
    featureId: z.string().optional(),
  })
  .refine(v => Boolean(v.id || (v.technologyId && v.featureId)), {
    message: 'Provide id or (technologyId + featureId)',
  });

registry.register({
  name: 'cmsEvaluation.get',
  description: 'Get a single cached CMS x Feature evaluation by id or (technologyId + featureId)',
  category: 'qualification-scan',
  inputSchema: getCmsEvaluationInputSchema,
  async execute(input, _context: ToolContext) {
    const where = input.id
      ? eq(cmsFeatureEvaluations.id, input.id)
      : and(
          eq(cmsFeatureEvaluations.technologyId, input.technologyId!),
          eq(cmsFeatureEvaluations.featureId, input.featureId!)
        );

    const [row] = await db
      .select({
        id: cmsFeatureEvaluations.id,
        featureId: cmsFeatureEvaluations.featureId,
        featureName: features.name,
        featureSlug: features.slug,
        technologyId: cmsFeatureEvaluations.technologyId,
        technologyName: technologies.name,
        score: cmsFeatureEvaluations.score,
        reasoning: cmsFeatureEvaluations.reasoning,
        expiresAt: cmsFeatureEvaluations.expiresAt,
        createdAt: cmsFeatureEvaluations.createdAt,
      })
      .from(cmsFeatureEvaluations)
      .leftJoin(features, eq(cmsFeatureEvaluations.featureId, features.id))
      .leftJoin(technologies, eq(cmsFeatureEvaluations.technologyId, technologies.id))
      .where(where)
      .limit(1);

    if (!row) return { success: false, error: 'CMS evaluation not found' };
    return { success: true, data: row };
  },
});

// ─── cmsEvaluation.answer (cache → web research) ──────────────────────────────

const answerCmsEvaluationInputSchema = z.object({
  technology: z.string().min(1).describe('Technology/CMS name (e.g. "Drupal")'),
  feature: z.string().min(1).describe('Feature requirement (e.g. "Mehrsprachigkeit")'),
  category: z
    .enum([
      'functional',
      'technical',
      'integration',
      'compliance',
      'performance',
      'scalability',
      'security',
      'ux',
      'maintenance',
      'other',
    ])
    .default('functional')
    .describe('Optional requirement category'),
  priority: z
    .enum(['must-have', 'should-have', 'nice-to-have'])
    .default('should-have')
    .describe('Optional requirement priority'),
  cacheOnly: z
    .boolean()
    .default(false)
    .describe('If true: only return cached evaluations, never run web research'),
  includeExpired: z
    .boolean()
    .default(false)
    .describe('If true: allow returning expired evaluations instead of researching'),
  ttlDays: z
    .number()
    .min(1)
    .max(365)
    .default(30)
    .describe('TTL for newly researched evaluations (days)'),
});

type CmsEvalCandidate = { id: string; name: string; category: string | null };

export interface CmsEvaluationAnswerData {
  found: boolean;
  source: 'cache' | 'web_research';
  supported?: boolean;
  reason?: 'technology_not_found' | 'ambiguous_technology' | 'feature_not_found' | 'cache_miss';
  candidates?: {
    technologies?: CmsEvalCandidate[];
    features?: Array<{
      id: string;
      name: string;
      slug: string;
      category: string;
      isActive: boolean;
    }>;
  };
  technology?: { id: string; name: string; category: string | null };
  feature?: { id: string; name: string; slug: string; category: string; isActive: boolean };
  evaluation?: {
    id: string;
    featureId: string;
    featureName: string | null;
    featureSlug: string | null;
    technologyId: string;
    technologyName: string | null;
    score: number;
    reasoning: string | null;
    expiresAt: Date;
    createdAt: Date | null;
    updatedAt: Date | null;
  } | null;
  research?: unknown;
}

registry.register({
  name: 'cmsEvaluation.answer',
  description:
    'Answer "Does CMS X support feature Y?" using cached cms_feature_evaluations first. If not found, optionally runs web research and upserts the cache (no duplicates).',
  category: 'qualification-scan',
  inputSchema: answerCmsEvaluationInputSchema,
  async execute(input, _context: ToolContext): Promise<ToolResult<CmsEvaluationAnswerData>> {
    const techTerm = input.technology.trim();
    const featureTerm = input.feature.trim();

    // 1) Resolve technology by name (avoid inventing IDs)
    const techCandidates = await db
      .select({
        id: technologies.id,
        name: technologies.name,
        category: technologies.category,
        isDefault: technologies.isDefault,
      })
      .from(technologies)
      .where(ilike(technologies.name, `%${techTerm}%`))
      .orderBy(desc(technologies.updatedAt))
      .limit(10);

    if (techCandidates.length === 0) {
      return {
        success: true,
        data: { found: false, source: 'cache', reason: 'technology_not_found' },
      };
    }

    const techExact = techCandidates.filter(t => normalizeKey(t.name) === normalizeKey(techTerm));
    const techCms = techCandidates.filter(
      t => typeof t.category === 'string' && t.category.toLowerCase().includes('cms')
    );

    const chosenTechnology =
      techExact.length === 1
        ? techExact[0]
        : techCandidates.length === 1
          ? techCandidates[0]
          : techCms.length === 1
            ? techCms[0]
            : null;

    if (!chosenTechnology) {
      return {
        success: true,
        data: {
          found: false,
          source: 'cache',
          reason: 'ambiguous_technology',
          candidates: {
            technologies: techCandidates.map(t => ({
              id: t.id,
              name: t.name,
              category: t.category,
            })),
          },
        },
      };
    }

    // 2) Resolve feature by slug/name (do NOT create unless we actually need to research)
    const featureSlug = slugify(featureTerm);
    const featureCandidates = await db
      .select({
        id: features.id,
        name: features.name,
        slug: features.slug,
        category: features.category,
        isActive: features.isActive,
      })
      .from(features)
      .where(or(ilike(features.name, `%${featureTerm}%`), ilike(features.slug, `%${featureSlug}%`)))
      .orderBy(desc(features.priority), desc(features.updatedAt))
      .limit(10);

    const featureExact = featureCandidates.filter(
      f =>
        normalizeKey(f.name) === normalizeKey(featureTerm) || normalizeKey(f.slug) === featureSlug
    );

    let chosenFeature =
      featureExact.length === 1
        ? featureExact[0]
        : featureCandidates.length === 1
          ? featureCandidates[0]
          : null;

    // If feature is unknown and we are cache-only: stop early to avoid creating duplicates.
    if (!chosenFeature && input.cacheOnly) {
      return {
        success: true,
        data: {
          found: false,
          source: 'cache',
          reason: 'feature_not_found',
          technology: {
            id: chosenTechnology.id,
            name: chosenTechnology.name,
            category: chosenTechnology.category,
          },
          candidates: { features: featureCandidates },
        },
      };
    }

    // 3) Cache lookup (cms_feature_evaluations)
    if (chosenFeature) {
      const where = input.includeExpired
        ? and(
            eq(cmsFeatureEvaluations.technologyId, chosenTechnology.id),
            eq(cmsFeatureEvaluations.featureId, chosenFeature.id)
          )
        : and(
            eq(cmsFeatureEvaluations.technologyId, chosenTechnology.id),
            eq(cmsFeatureEvaluations.featureId, chosenFeature.id),
            gt(cmsFeatureEvaluations.expiresAt, new Date())
          );

      const [cached] = await db
        .select({
          id: cmsFeatureEvaluations.id,
          featureId: cmsFeatureEvaluations.featureId,
          featureName: features.name,
          featureSlug: features.slug,
          technologyId: cmsFeatureEvaluations.technologyId,
          technologyName: technologies.name,
          score: cmsFeatureEvaluations.score,
          reasoning: cmsFeatureEvaluations.reasoning,
          expiresAt: cmsFeatureEvaluations.expiresAt,
          createdAt: cmsFeatureEvaluations.createdAt,
          updatedAt: cmsFeatureEvaluations.updatedAt,
        })
        .from(cmsFeatureEvaluations)
        .leftJoin(features, eq(cmsFeatureEvaluations.featureId, features.id))
        .leftJoin(technologies, eq(cmsFeatureEvaluations.technologyId, technologies.id))
        .where(where)
        .orderBy(desc(cmsFeatureEvaluations.updatedAt))
        .limit(1);

      if (cached) {
        return {
          success: true,
          data: {
            found: true,
            source: 'cache',
            supported: cached.score >= 60,
            technology: {
              id: chosenTechnology.id,
              name: chosenTechnology.name,
              category: chosenTechnology.category,
            },
            feature: chosenFeature,
            evaluation: cached,
          },
        };
      }
    }

    if (input.cacheOnly) {
      return {
        success: true,
        data: {
          found: false,
          source: 'cache',
          reason: 'cache_miss',
          technology: {
            id: chosenTechnology.id,
            name: chosenTechnology.name,
            category: chosenTechnology.category,
          },
          feature: chosenFeature ?? undefined,
          candidates: chosenFeature ? undefined : { features: featureCandidates },
        },
      };
    }

    // 4) If we still don't have a feature row, create it now (only if we will research & cache).
    if (!chosenFeature) {
      // Dynamic import to avoid heavy module graph during tool registration/tests.
      const { ensureFeatureExists } = await import('@/lib/cms-matching/feature-library');
      const id = await ensureFeatureExists(featureTerm, input.category);
      const [createdFeature] = await db
        .select({
          id: features.id,
          name: features.name,
          slug: features.slug,
          category: features.category,
          isActive: features.isActive,
        })
        .from(features)
        .where(eq(features.id, id))
        .limit(1);
      chosenFeature = createdFeature ?? null;
    }

    if (!chosenFeature) {
      return {
        success: false,
        error: `Failed to resolve or create feature "${featureTerm}"`,
      };
    }

    // 5) Web research using the existing requirement research agent (saveToDb=false to prevent string-key duplication).
    const { runRequirementResearchAgent } =
      await import('@/lib/cms-matching/requirement-research-agent');

    const research = await runRequirementResearchAgent({
      requirement: featureTerm,
      category: input.category,
      priority: input.priority,
      cmsId: chosenTechnology.id,
      cmsName: chosenTechnology.name,
      saveToDb: false,
    });

    // 6) Upsert cache by canonical IDs (no duplicates)
    const expiresAt = new Date(Date.now() + input.ttlDays * 24 * 60 * 60 * 1000);
    const sourceUrlsJson = research.sources?.length ? JSON.stringify(research.sources) : null;

    await db
      .insert(cmsFeatureEvaluations)
      .values({
        featureId: chosenFeature.id,
        technologyId: chosenTechnology.id,
        score: research.score,
        reasoning: research.evidence?.join(' | ') ?? research.notes ?? null,
        confidence: research.confidence ?? null,
        supportType: null,
        moduleName: null,
        sourceUrls: sourceUrlsJson,
        notes: research.notes ?? null,
        expiresAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [cmsFeatureEvaluations.featureId, cmsFeatureEvaluations.technologyId],
        set: {
          score: research.score,
          reasoning: research.evidence?.join(' | ') ?? research.notes ?? null,
          confidence: research.confidence ?? null,
          supportType: null,
          moduleName: null,
          sourceUrls: sourceUrlsJson,
          notes: research.notes ?? null,
          expiresAt,
          updatedAt: new Date(),
        },
      });

    // Fetch the row back (to return consistent output shape)
    const [fresh] = await db
      .select({
        id: cmsFeatureEvaluations.id,
        featureId: cmsFeatureEvaluations.featureId,
        featureName: features.name,
        featureSlug: features.slug,
        technologyId: cmsFeatureEvaluations.technologyId,
        technologyName: technologies.name,
        score: cmsFeatureEvaluations.score,
        reasoning: cmsFeatureEvaluations.reasoning,
        expiresAt: cmsFeatureEvaluations.expiresAt,
        createdAt: cmsFeatureEvaluations.createdAt,
        updatedAt: cmsFeatureEvaluations.updatedAt,
      })
      .from(cmsFeatureEvaluations)
      .leftJoin(features, eq(cmsFeatureEvaluations.featureId, features.id))
      .leftJoin(technologies, eq(cmsFeatureEvaluations.technologyId, technologies.id))
      .where(
        and(
          eq(cmsFeatureEvaluations.technologyId, chosenTechnology.id),
          eq(cmsFeatureEvaluations.featureId, chosenFeature.id)
        )
      )
      .limit(1);

    return {
      success: true,
      data: {
        found: true,
        source: 'web_research',
        supported: (fresh?.score ?? research.score) >= 60,
        technology: {
          id: chosenTechnology.id,
          name: chosenTechnology.name,
          category: chosenTechnology.category,
        },
        feature: chosenFeature,
        research,
        evaluation: fresh ?? null,
      },
    };
  },
});
