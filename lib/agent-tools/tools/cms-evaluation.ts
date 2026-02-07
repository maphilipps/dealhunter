import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { cmsFeatureEvaluations, features, technologies } from '@/lib/db/schema';

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
