import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import {
  deepMigrationAnalyses,
  baselineComparisons,
  ptEstimations,
  cmsMatchResults,
  referenceMatches,
  competitorMatches,
  pitches,
  preQualifications,
  technologies,
} from '@/lib/db/schema';

// ===== Input Schemas =====

const deleteDeepMigrationInputSchema = z.object({
  id: z.string(),
});

const deleteBaselineInputSchema = z.object({
  id: z.string(),
});

const deletePtEstimationInputSchema = z.object({
  id: z.string(),
});

const deleteCmsMatchInputSchema = z.object({
  id: z.string(),
});

// ReferenceMatch Schemas
const createReferenceMatchInputSchema = z.object({
  pitchId: z.string(),
  referenceId: z.string(),
  totalScore: z.number().min(0).max(100),
  techStackScore: z.number().min(0).max(100),
  industryScore: z.number().min(0).max(100),
  matchedTechnologies: z.array(z.string()).optional(),
  matchedIndustries: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  rank: z.number().min(1),
});

const updateReferenceMatchInputSchema = z.object({
  id: z.string(),
  totalScore: z.number().min(0).max(100).optional(),
  techStackScore: z.number().min(0).max(100).optional(),
  industryScore: z.number().min(0).max(100).optional(),
  matchedTechnologies: z.array(z.string()).optional(),
  matchedIndustries: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  rank: z.number().min(1).optional(),
});

const deleteReferenceMatchInputSchema = z.object({
  id: z.string(),
});

// CompetitorMatch Schemas
const createCompetitorMatchInputSchema = z.object({
  pitchId: z.string(),
  competitorId: z.string(),
  source: z.enum(['database', 'web_search']),
  relevanceScore: z.number().min(0).max(100).optional(),
  reasoning: z.string().optional(),
  likelyInvolved: z.boolean().default(false),
  encounterHistory: z.array(z.any()).optional(),
});

const updateCompetitorMatchInputSchema = z.object({
  id: z.string(),
  relevanceScore: z.number().min(0).max(100).optional(),
  reasoning: z.string().optional(),
  likelyInvolved: z.boolean().optional(),
  encounterHistory: z.array(z.any()).optional(),
});

const deleteCompetitorMatchInputSchema = z.object({
  id: z.string(),
});

// ===== Tool Implementations =====

registry.register({
  name: 'analysis.deleteDeepMigration',
  description: 'Delete a Deep Migration Analysis (hard delete)',
  category: 'analysis',
  inputSchema: deleteDeepMigrationInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete analyses
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete analyses' };
    }

    const [existing] = await db
      .select()
      .from(deepMigrationAnalyses)
      .where(eq(deepMigrationAnalyses.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Deep Migration Analysis not found' };
    }

    await db.delete(deepMigrationAnalyses).where(eq(deepMigrationAnalyses.id, input.id));

    return {
      success: true,
      message: 'Deep Migration Analysis deleted successfully',
      deletedId: input.id,
    };
  },
});

registry.register({
  name: 'analysis.deleteBaseline',
  description: 'Delete a Baseline Comparison (hard delete)',
  category: 'analysis',
  inputSchema: deleteBaselineInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete baselines
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete baselines' };
    }

    const [existing] = await db
      .select()
      .from(baselineComparisons)
      .where(eq(baselineComparisons.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Baseline Comparison not found' };
    }

    await db.delete(baselineComparisons).where(eq(baselineComparisons.id, input.id));

    return {
      success: true,
      message: 'Baseline Comparison deleted successfully',
      deletedId: input.id,
    };
  },
});

registry.register({
  name: 'analysis.deletePtEstimation',
  description: 'Delete a PT Estimation (hard delete)',
  category: 'analysis',
  inputSchema: deletePtEstimationInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete estimations
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete estimations' };
    }

    const [existing] = await db
      .select()
      .from(ptEstimations)
      .where(eq(ptEstimations.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'PT Estimation not found' };
    }

    await db.delete(ptEstimations).where(eq(ptEstimations.id, input.id));

    return {
      success: true,
      message: 'PT Estimation deleted successfully',
      deletedId: input.id,
    };
  },
});

registry.register({
  name: 'analysis.deleteCmsMatch',
  description: 'Delete a CMS Match Result (hard delete)',
  category: 'analysis',
  inputSchema: deleteCmsMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete CMS matches
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete CMS matches' };
    }

    const [existing] = await db
      .select()
      .from(cmsMatchResults)
      .where(eq(cmsMatchResults.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'CMS Match Result not found' };
    }

    await db.delete(cmsMatchResults).where(eq(cmsMatchResults.id, input.id));

    return {
      success: true,
      message: 'CMS Match Result deleted successfully',
      deletedId: input.id,
    };
  },
});

// ============================================================================
// CmsMatchResult CRUD (expanded from delete-only)
// ============================================================================

// Helper: Get pitch IDs the user owns via PreQualification
async function getUserOwnedPitchIds(userId: string): Promise<string[]> {
  const owned = await db
    .select({ pitchId: pitches.id })
    .from(pitches)
    .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
    .where(eq(preQualifications.userId, userId));
  return owned.map(r => r.pitchId);
}

// Helper: Verify user has access to a pitch
async function verifyPitchAccess(
  pitchId: string,
  context: ToolContext
): Promise<{ success: true } | { success: false; error: string }> {
  if (context.userRole === 'admin') {
    // Admin has access to all pitches
    const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
    if (!pitch) {
      return { success: false, error: 'Pitch not found' };
    }
    return { success: true };
  }

  // Non-admin: verify ownership via PreQualification
  const [pitchData] = await db
    .select({ pitch: pitches, preQualification: preQualifications })
    .from(pitches)
    .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
    .where(and(eq(pitches.id, pitchId), eq(preQualifications.userId, context.userId)))
    .limit(1);

  if (!pitchData) {
    return { success: false, error: 'Pitch not found or no access' };
  }
  return { success: true };
}

// Helper: Parse JSON field safely
function parseJsonField(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Input Schemas for CmsMatchResult CRUD
const listCmsMatchInputSchema = z.object({
  pitchId: z.string().optional(),
  isRecommended: z.boolean().optional(),
  minScore: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(100).default(50),
});

const getCmsMatchInputSchema = z.object({
  id: z.string(),
});

const listByPitchInputSchema = z.object({
  pitchId: z.string(),
  sortBy: z.enum(['rank', 'totalScore']).default('rank'),
});

const getRecommendedInputSchema = z.object({
  pitchId: z.string(),
});

const createCmsMatchInputSchema = z.object({
  pitchId: z.string(),
  technologyId: z.string(),
  totalScore: z.number().min(0).max(100),
  featureScore: z.number().min(0).max(100),
  industryScore: z.number().min(0).max(100),
  sizeScore: z.number().min(0).max(100),
  budgetScore: z.number().min(0).max(100),
  migrationScore: z.number().min(0).max(100),
  matchedFeatures: z.array(z.any()).optional(),
  reasoning: z.string().optional(),
  rank: z.number().min(1),
  isRecommended: z.boolean().default(false),
});

const updateCmsMatchInputSchema = z.object({
  id: z.string(),
  totalScore: z.number().min(0).max(100).optional(),
  featureScore: z.number().min(0).max(100).optional(),
  industryScore: z.number().min(0).max(100).optional(),
  sizeScore: z.number().min(0).max(100).optional(),
  budgetScore: z.number().min(0).max(100).optional(),
  migrationScore: z.number().min(0).max(100).optional(),
  matchedFeatures: z.array(z.any()).optional(),
  reasoning: z.string().optional(),
  rank: z.number().min(1).optional(),
  isRecommended: z.boolean().optional(),
});

// analysis.listCmsMatch - List CMS match results with filters
registry.register({
  name: 'analysis.listCmsMatch',
  description:
    'List CMS match results. Filter by pitchId, isRecommended, or minScore. Non-admin users only see results for pitches they own.',
  category: 'analysis',
  inputSchema: listCmsMatchInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    // Access control: non-admin users can only see their own pitches
    if (context.userRole !== 'admin') {
      const ownedPitchIds = await getUserOwnedPitchIds(context.userId);
      if (ownedPitchIds.length === 0) {
        return { success: true, data: [], metadata: { count: 0, filters: input } };
      }
      conditions.push(inArray(cmsMatchResults.pitchId, ownedPitchIds));
    }

    if (input.pitchId) {
      conditions.push(eq(cmsMatchResults.pitchId, input.pitchId));
    }

    if (input.isRecommended !== undefined) {
      conditions.push(eq(cmsMatchResults.isRecommended, input.isRecommended));
    }

    const results = await db
      .select({
        id: cmsMatchResults.id,
        pitchId: cmsMatchResults.pitchId,
        technologyId: cmsMatchResults.technologyId,
        technologyName: technologies.name,
        totalScore: cmsMatchResults.totalScore,
        featureScore: cmsMatchResults.featureScore,
        industryScore: cmsMatchResults.industryScore,
        sizeScore: cmsMatchResults.sizeScore,
        budgetScore: cmsMatchResults.budgetScore,
        migrationScore: cmsMatchResults.migrationScore,
        matchedFeatures: cmsMatchResults.matchedFeatures,
        reasoning: cmsMatchResults.reasoning,
        rank: cmsMatchResults.rank,
        isRecommended: cmsMatchResults.isRecommended,
        createdAt: cmsMatchResults.createdAt,
      })
      .from(cmsMatchResults)
      .leftJoin(technologies, eq(cmsMatchResults.technologyId, technologies.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(cmsMatchResults.rank))
      .limit(input.limit);

    // Apply minScore filter in-memory (more flexible than SQL)
    const filtered =
      input.minScore !== undefined ? results.filter(r => r.totalScore >= input.minScore!) : results;

    return {
      success: true,
      data: filtered.map(r => ({
        ...r,
        matchedFeatures: parseJsonField(r.matchedFeatures as string | null),
      })),
      metadata: {
        count: filtered.length,
        filters: input,
      },
    };
  },
});

// analysis.getCmsMatch - Get a single CMS match result by ID
registry.register({
  name: 'analysis.getCmsMatch',
  description:
    'Get a single CMS match result by ID. Returns full details including technology name and parsed features.',
  category: 'analysis',
  inputSchema: getCmsMatchInputSchema,
  async execute(input, context: ToolContext) {
    const [result] = await db
      .select({
        id: cmsMatchResults.id,
        pitchId: cmsMatchResults.pitchId,
        technologyId: cmsMatchResults.technologyId,
        technologyName: technologies.name,
        totalScore: cmsMatchResults.totalScore,
        featureScore: cmsMatchResults.featureScore,
        industryScore: cmsMatchResults.industryScore,
        sizeScore: cmsMatchResults.sizeScore,
        budgetScore: cmsMatchResults.budgetScore,
        migrationScore: cmsMatchResults.migrationScore,
        matchedFeatures: cmsMatchResults.matchedFeatures,
        reasoning: cmsMatchResults.reasoning,
        rank: cmsMatchResults.rank,
        isRecommended: cmsMatchResults.isRecommended,
        createdAt: cmsMatchResults.createdAt,
      })
      .from(cmsMatchResults)
      .leftJoin(technologies, eq(cmsMatchResults.technologyId, technologies.id))
      .where(eq(cmsMatchResults.id, input.id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'CMS Match Result not found' };
    }

    // Access control: non-admin must own the pitch
    if (context.userRole !== 'admin') {
      const accessCheck = await verifyPitchAccess(result.pitchId, context);
      if (!accessCheck.success) {
        return { success: false, error: 'Access denied' };
      }
    }

    return {
      success: true,
      data: {
        ...result,
        matchedFeatures: parseJsonField(result.matchedFeatures as string | null),
      },
    };
  },
});

// analysis.listCmsMatchByPitch - List all CMS matches for a specific pitch
registry.register({
  name: 'analysis.listCmsMatchByPitch',
  description:
    'List all CMS match results for a specific pitch, sorted by rank or totalScore. Returns full details with technology names.',
  category: 'analysis',
  inputSchema: listByPitchInputSchema,
  async execute(input, context: ToolContext) {
    // Verify pitch access
    const accessCheck = await verifyPitchAccess(input.pitchId, context);
    if (!accessCheck.success) {
      return accessCheck;
    }

    const orderBy =
      input.sortBy === 'totalScore' ? desc(cmsMatchResults.totalScore) : asc(cmsMatchResults.rank);

    const results = await db
      .select({
        id: cmsMatchResults.id,
        pitchId: cmsMatchResults.pitchId,
        technologyId: cmsMatchResults.technologyId,
        technologyName: technologies.name,
        totalScore: cmsMatchResults.totalScore,
        featureScore: cmsMatchResults.featureScore,
        industryScore: cmsMatchResults.industryScore,
        sizeScore: cmsMatchResults.sizeScore,
        budgetScore: cmsMatchResults.budgetScore,
        migrationScore: cmsMatchResults.migrationScore,
        matchedFeatures: cmsMatchResults.matchedFeatures,
        reasoning: cmsMatchResults.reasoning,
        rank: cmsMatchResults.rank,
        isRecommended: cmsMatchResults.isRecommended,
        createdAt: cmsMatchResults.createdAt,
      })
      .from(cmsMatchResults)
      .leftJoin(technologies, eq(cmsMatchResults.technologyId, technologies.id))
      .where(eq(cmsMatchResults.pitchId, input.pitchId))
      .orderBy(orderBy);

    return {
      success: true,
      data: results.map(r => ({
        ...r,
        matchedFeatures: parseJsonField(r.matchedFeatures as string | null),
      })),
      metadata: {
        pitchId: input.pitchId,
        count: results.length,
        sortBy: input.sortBy,
      },
    };
  },
});

// analysis.getRecommendedCmsMatch - Get the recommended CMS match for a pitch
registry.register({
  name: 'analysis.getRecommendedCmsMatch',
  description:
    'Get the recommended CMS match for a pitch (isRecommended=true). Returns null if no recommendation exists.',
  category: 'analysis',
  inputSchema: getRecommendedInputSchema,
  async execute(input, context: ToolContext) {
    // Verify pitch access
    const accessCheck = await verifyPitchAccess(input.pitchId, context);
    if (!accessCheck.success) {
      return accessCheck;
    }

    const [result] = await db
      .select({
        id: cmsMatchResults.id,
        pitchId: cmsMatchResults.pitchId,
        technologyId: cmsMatchResults.technologyId,
        technologyName: technologies.name,
        totalScore: cmsMatchResults.totalScore,
        featureScore: cmsMatchResults.featureScore,
        industryScore: cmsMatchResults.industryScore,
        sizeScore: cmsMatchResults.sizeScore,
        budgetScore: cmsMatchResults.budgetScore,
        migrationScore: cmsMatchResults.migrationScore,
        matchedFeatures: cmsMatchResults.matchedFeatures,
        reasoning: cmsMatchResults.reasoning,
        rank: cmsMatchResults.rank,
        isRecommended: cmsMatchResults.isRecommended,
        createdAt: cmsMatchResults.createdAt,
      })
      .from(cmsMatchResults)
      .leftJoin(technologies, eq(cmsMatchResults.technologyId, technologies.id))
      .where(
        and(eq(cmsMatchResults.pitchId, input.pitchId), eq(cmsMatchResults.isRecommended, true))
      )
      .limit(1);

    if (!result) {
      return {
        success: true,
        data: null,
        message: 'No recommended CMS match found for this pitch',
      };
    }

    return {
      success: true,
      data: {
        ...result,
        matchedFeatures: parseJsonField(result.matchedFeatures as string | null),
      },
    };
  },
});

// analysis.createCmsMatch - Create a new CMS match result
registry.register({
  name: 'analysis.createCmsMatch',
  description:
    'Create a new CMS match result linking a pitch to a CMS technology with scoring and ranking.',
  category: 'analysis',
  inputSchema: createCmsMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Verify pitch access
    const accessCheck = await verifyPitchAccess(input.pitchId, context);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Verify technology exists
    const [tech] = await db
      .select()
      .from(technologies)
      .where(eq(technologies.id, input.technologyId))
      .limit(1);

    if (!tech) {
      return { success: false, error: 'Technology not found' };
    }

    const [match] = await db
      .insert(cmsMatchResults)
      .values({
        pitchId: input.pitchId,
        technologyId: input.technologyId,
        totalScore: input.totalScore,
        featureScore: input.featureScore,
        industryScore: input.industryScore,
        sizeScore: input.sizeScore,
        budgetScore: input.budgetScore,
        migrationScore: input.migrationScore,
        matchedFeatures: input.matchedFeatures ? JSON.stringify(input.matchedFeatures) : null,
        reasoning: input.reasoning || null,
        rank: input.rank,
        isRecommended: input.isRecommended,
      })
      .returning();

    return {
      success: true,
      data: {
        id: match.id,
        pitchId: match.pitchId,
        technologyId: match.technologyId,
        technologyName: tech.name,
        totalScore: match.totalScore,
        rank: match.rank,
        isRecommended: match.isRecommended,
      },
    };
  },
});

// analysis.updateCmsMatch - Update a CMS match result
registry.register({
  name: 'analysis.updateCmsMatch',
  description:
    'Update a CMS match result with new scores, ranking, recommendation status, or reasoning.',
  category: 'analysis',
  inputSchema: updateCmsMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Fetch existing match
    const [existing] = await db
      .select()
      .from(cmsMatchResults)
      .where(eq(cmsMatchResults.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'CMS Match Result not found' };
    }

    // Verify pitch access
    const accessCheck = await verifyPitchAccess(existing.pitchId, context);
    if (!accessCheck.success) {
      return accessCheck;
    }

    const updateData: Record<string, unknown> = {};
    if (input.totalScore !== undefined) updateData.totalScore = input.totalScore;
    if (input.featureScore !== undefined) updateData.featureScore = input.featureScore;
    if (input.industryScore !== undefined) updateData.industryScore = input.industryScore;
    if (input.sizeScore !== undefined) updateData.sizeScore = input.sizeScore;
    if (input.budgetScore !== undefined) updateData.budgetScore = input.budgetScore;
    if (input.migrationScore !== undefined) updateData.migrationScore = input.migrationScore;
    if (input.reasoning !== undefined) updateData.reasoning = input.reasoning;
    if (input.rank !== undefined) updateData.rank = input.rank;
    if (input.isRecommended !== undefined) updateData.isRecommended = input.isRecommended;
    if (input.matchedFeatures !== undefined) {
      updateData.matchedFeatures = JSON.stringify(input.matchedFeatures);
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    await db.update(cmsMatchResults).set(updateData).where(eq(cmsMatchResults.id, input.id));

    return {
      success: true,
      message: 'CMS Match Result updated successfully',
      updatedId: input.id,
    };
  },
});

// ============================================================================
// ReferenceMatch CRUD
// ============================================================================

registry.register({
  name: 'analysis.createReferenceMatch',
  description:
    'Create a Reference Match linking a lead to a reference project with scoring and ranking',
  category: 'analysis',
  inputSchema: createReferenceMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Verify lead access via preQualification.userId
    const [leadData] = await db
      .select({ lead: pitches, preQualification: preQualifications })
      .from(pitches)
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(pitches.id, input.pitchId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const [match] = await db
      .insert(referenceMatches)
      .values({
        pitchId: input.pitchId,
        referenceId: input.referenceId,
        totalScore: input.totalScore,
        techStackScore: input.techStackScore,
        industryScore: input.industryScore,
        matchedTechnologies: input.matchedTechnologies
          ? JSON.stringify(input.matchedTechnologies)
          : null,
        matchedIndustries: input.matchedIndustries ? JSON.stringify(input.matchedIndustries) : null,
        reasoning: input.reasoning || null,
        rank: input.rank,
      })
      .returning();

    return {
      success: true,
      data: {
        id: match.id,
        pitchId: match.pitchId,
        referenceId: match.referenceId,
        totalScore: match.totalScore,
        rank: match.rank,
      },
    };
  },
});

registry.register({
  name: 'analysis.updateReferenceMatch',
  description: 'Update a Reference Match with new scores, ranking or reasoning',
  category: 'analysis',
  inputSchema: updateReferenceMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Fetch existing match and verify access via lead → preQualification
    const [existing] = await db
      .select({ match: referenceMatches, lead: pitches, preQualification: preQualifications })
      .from(referenceMatches)
      .innerJoin(pitches, eq(referenceMatches.pitchId, pitches.id))
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(referenceMatches.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Reference Match not found or no access' };
    }

    const updateData: Record<string, unknown> = {};
    if (input.totalScore !== undefined) updateData.totalScore = input.totalScore;
    if (input.techStackScore !== undefined) updateData.techStackScore = input.techStackScore;
    if (input.industryScore !== undefined) updateData.industryScore = input.industryScore;
    if (input.reasoning !== undefined) updateData.reasoning = input.reasoning;
    if (input.rank !== undefined) updateData.rank = input.rank;
    if (input.matchedTechnologies !== undefined)
      updateData.matchedTechnologies = JSON.stringify(input.matchedTechnologies);
    if (input.matchedIndustries !== undefined)
      updateData.matchedIndustries = JSON.stringify(input.matchedIndustries);

    await db.update(referenceMatches).set(updateData).where(eq(referenceMatches.id, input.id));

    return {
      success: true,
      message: 'Reference Match updated successfully',
      updatedId: input.id,
    };
  },
});

registry.register({
  name: 'analysis.deleteReferenceMatch',
  description: 'Delete a Reference Match (hard delete)',
  category: 'analysis',
  inputSchema: deleteReferenceMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Fetch existing match and verify access via lead → preQualification
    const [existing] = await db
      .select({ match: referenceMatches, lead: pitches, preQualification: preQualifications })
      .from(referenceMatches)
      .innerJoin(pitches, eq(referenceMatches.pitchId, pitches.id))
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(referenceMatches.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Reference Match not found or no access' };
    }

    await db.delete(referenceMatches).where(eq(referenceMatches.id, input.id));

    return {
      success: true,
      message: 'Reference Match deleted successfully',
      deletedId: input.id,
    };
  },
});

// ============================================================================
// CompetitorMatch CRUD
// ============================================================================

registry.register({
  name: 'analysis.createCompetitorMatch',
  description:
    'Create a Competitor Match linking a lead to a competitor with likelihood and intelligence data',
  category: 'analysis',
  inputSchema: createCompetitorMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Verify lead access via preQualification.userId
    const [leadData] = await db
      .select({ lead: pitches, preQualification: preQualifications })
      .from(pitches)
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(pitches.id, input.pitchId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const [match] = await db
      .insert(competitorMatches)
      .values({
        pitchId: input.pitchId,
        competitorId: input.competitorId,
        source: input.source,
        relevanceScore: input.relevanceScore || null,
        reasoning: input.reasoning || null,
        likelyInvolved: input.likelyInvolved,
        encounterHistory: input.encounterHistory ? JSON.stringify(input.encounterHistory) : null,
      })
      .returning();

    return {
      success: true,
      data: {
        id: match.id,
        pitchId: match.pitchId,
        competitorId: match.competitorId,
        source: match.source,
        likelyInvolved: match.likelyInvolved,
      },
    };
  },
});

registry.register({
  name: 'analysis.updateCompetitorMatch',
  description: 'Update a Competitor Match with new relevance, likelihood or intelligence data',
  category: 'analysis',
  inputSchema: updateCompetitorMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Fetch existing match and verify access via lead → preQualification
    const [existing] = await db
      .select({ match: competitorMatches, lead: pitches, preQualification: preQualifications })
      .from(competitorMatches)
      .innerJoin(pitches, eq(competitorMatches.pitchId, pitches.id))
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(competitorMatches.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Competitor Match not found or no access' };
    }

    const updateData: Record<string, unknown> = {};
    if (input.relevanceScore !== undefined) updateData.relevanceScore = input.relevanceScore;
    if (input.reasoning !== undefined) updateData.reasoning = input.reasoning;
    if (input.likelyInvolved !== undefined) updateData.likelyInvolved = input.likelyInvolved;
    if (input.encounterHistory !== undefined)
      updateData.encounterHistory = JSON.stringify(input.encounterHistory);

    await db.update(competitorMatches).set(updateData).where(eq(competitorMatches.id, input.id));

    return {
      success: true,
      message: 'Competitor Match updated successfully',
      updatedId: input.id,
    };
  },
});

registry.register({
  name: 'analysis.deleteCompetitorMatch',
  description: 'Delete a Competitor Match (hard delete)',
  category: 'analysis',
  inputSchema: deleteCompetitorMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Fetch existing match and verify access via lead → preQualification
    const [existing] = await db
      .select({ match: competitorMatches, lead: pitches, preQualification: preQualifications })
      .from(competitorMatches)
      .innerJoin(pitches, eq(competitorMatches.pitchId, pitches.id))
      .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
      .where(and(eq(competitorMatches.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Competitor Match not found or no access' };
    }

    await db.delete(competitorMatches).where(eq(competitorMatches.id, input.id));

    return {
      success: true,
      message: 'Competitor Match deleted successfully',
      deletedId: input.id,
    };
  },
});
