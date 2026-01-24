import { eq } from 'drizzle-orm';
import { and } from 'drizzle-orm';
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
  qualifications,
  preQualifications,
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
  qualificationId: z.string(),
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
  qualificationId: z.string(),
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
// ReferenceMatch CRUD
// ============================================================================

registry.register({
  name: 'analysis.createReferenceMatch',
  description:
    'Create a Reference Match linking a lead to a reference project with scoring and ranking',
  category: 'analysis',
  inputSchema: createReferenceMatchInputSchema,
  async execute(input, context: ToolContext) {
    // Verify lead access via rfp.userId
    const [leadData] = await db
      .select({ lead: qualifications, rfp: preQualifications })
      .from(qualifications)
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
      .where(
        and(
          eq(qualifications.id, input.qualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const [match] = await db
      .insert(referenceMatches)
      .values({
        qualificationId: input.qualificationId,
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
        qualificationId: match.qualificationId,
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
    // Fetch existing match and verify access via lead → rfp
    const [existing] = await db
      .select({ match: referenceMatches, lead: qualifications, rfp: preQualifications })
      .from(referenceMatches)
      .innerJoin(qualifications, eq(referenceMatches.qualificationId, qualifications.id))
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
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
    // Fetch existing match and verify access via lead → rfp
    const [existing] = await db
      .select({ match: referenceMatches, lead: qualifications, rfp: preQualifications })
      .from(referenceMatches)
      .innerJoin(qualifications, eq(referenceMatches.qualificationId, qualifications.id))
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
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
    // Verify lead access via rfp.userId
    const [leadData] = await db
      .select({ lead: qualifications, rfp: preQualifications })
      .from(qualifications)
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
      .where(
        and(
          eq(qualifications.id, input.qualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const [match] = await db
      .insert(competitorMatches)
      .values({
        qualificationId: input.qualificationId,
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
        qualificationId: match.qualificationId,
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
    // Fetch existing match and verify access via lead → rfp
    const [existing] = await db
      .select({ match: competitorMatches, lead: qualifications, rfp: preQualifications })
      .from(competitorMatches)
      .innerJoin(qualifications, eq(competitorMatches.qualificationId, qualifications.id))
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
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
    // Fetch existing match and verify access via lead → rfp
    const [existing] = await db
      .select({ match: competitorMatches, lead: qualifications, rfp: preQualifications })
      .from(competitorMatches)
      .innerJoin(qualifications, eq(competitorMatches.qualificationId, qualifications.id))
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
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
