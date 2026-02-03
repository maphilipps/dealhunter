import { eq, desc, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { quickScans, preQualifications } from '@/lib/db/schema';

// ============================================================================
// Helper: Check access to PreQualification for creating QuickScan
// ============================================================================

async function checkPreQualificationAccess(
  preQualificationId: string,
  context: ToolContext
): Promise<{ allowed: boolean; preQual?: typeof preQualifications.$inferSelect; error?: string }> {
  const [preQual] = await db
    .select()
    .from(preQualifications)
    .where(eq(preQualifications.id, preQualificationId))
    .limit(1);

  if (!preQual) {
    return { allowed: false, error: 'PreQualification not found' };
  }

  // Admin can access all
  if (context.userRole === 'admin') {
    return { allowed: true, preQual };
  }

  // Check ownership
  if (preQual.userId !== context.userId) {
    return { allowed: false, error: 'No access to this PreQualification' };
  }

  return { allowed: true, preQual };
}

// ============================================================================
// Helper: Parse JSON fields for consistent response format
// ============================================================================

function parseQuickScanJsonFields(scan: typeof quickScans.$inferSelect) {
  return {
    ...scan,
    techStack: scan.techStack ? JSON.parse(scan.techStack) : null,
    contentVolume: scan.contentVolume ? JSON.parse(scan.contentVolume) : null,
    features: scan.features ? JSON.parse(scan.features) : null,
    integrations: scan.integrations ? JSON.parse(scan.integrations) : null,
    activityLog: scan.activityLog ? JSON.parse(scan.activityLog) : [],
    navigationStructure: scan.navigationStructure ? JSON.parse(scan.navigationStructure) : null,
    accessibilityAudit: scan.accessibilityAudit ? JSON.parse(scan.accessibilityAudit) : null,
    seoAudit: scan.seoAudit ? JSON.parse(scan.seoAudit) : null,
    legalCompliance: scan.legalCompliance ? JSON.parse(scan.legalCompliance) : null,
    performanceIndicators: scan.performanceIndicators
      ? JSON.parse(scan.performanceIndicators)
      : null,
    screenshots: scan.screenshots ? JSON.parse(scan.screenshots) : null,
    companyIntelligence: scan.companyIntelligence ? JSON.parse(scan.companyIntelligence) : null,
    siteTree: scan.siteTree ? JSON.parse(scan.siteTree) : null,
    contentTypes: scan.contentTypes ? JSON.parse(scan.contentTypes) : null,
    migrationComplexity: scan.migrationComplexity ? JSON.parse(scan.migrationComplexity) : null,
    decisionMakers: scan.decisionMakers ? JSON.parse(scan.decisionMakers) : null,
    tenQuestions: scan.tenQuestions ? JSON.parse(scan.tenQuestions) : null,
    rawScanData: scan.rawScanData ? JSON.parse(scan.rawScanData) : null,
    visualizationTree: scan.visualizationTree ? JSON.parse(scan.visualizationTree) : null,
    cmsEvaluation: scan.cmsEvaluation ? JSON.parse(scan.cmsEvaluation) : null,
    timeline: scan.timeline ? JSON.parse(scan.timeline) : null,
  };
}

// ============================================================================
// Helper: Check access to QuickScan via PreQualification ownership
// ============================================================================

async function checkQuickScanAccess(
  scanId: string,
  context: ToolContext
): Promise<{ allowed: boolean; scan?: typeof quickScans.$inferSelect; error?: string }> {
  const [scan] = await db.select().from(quickScans).where(eq(quickScans.id, scanId)).limit(1);

  if (!scan) {
    return { allowed: false, error: 'QuickScan not found' };
  }

  // Admin can access all
  if (context.userRole === 'admin') {
    return { allowed: true, scan };
  }

  // Check PreQualification ownership
  const [preQual] = await db
    .select({ userId: preQualifications.userId })
    .from(preQualifications)
    .where(eq(preQualifications.id, scan.preQualificationId))
    .limit(1);

  if (!preQual || preQual.userId !== context.userId) {
    return { allowed: false, error: 'No access to this QuickScan' };
  }

  return { allowed: true, scan };
}

// ============================================================================
// scan.quickscan.create - Create a new QuickScan for a PreQualification
// ============================================================================

const createQuickScanInputSchema = z.object({
  preQualificationId: z.string(),
  websiteUrl: z.string().url(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
});

registry.register({
  name: 'scan.quickscan.create',
  description:
    'Create a new QuickScan for a PreQualification. Only one QuickScan per PreQualification is allowed.',
  category: 'scan',
  inputSchema: createQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    // Check PreQualification access
    const access = await checkPreQualificationAccess(input.preQualificationId, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Check if QuickScan already exists for this PreQualification
    const [existingScan] = await db
      .select({ id: quickScans.id })
      .from(quickScans)
      .where(eq(quickScans.preQualificationId, input.preQualificationId))
      .limit(1);

    if (existingScan) {
      return {
        success: false,
        error: 'QuickScan already exists for this PreQualification',
        existingId: existingScan.id,
      };
    }

    // Set timestamps based on status
    const timestamps: Record<string, Date> = {
      createdAt: new Date(),
    };

    if (input.status === 'running') {
      timestamps.startedAt = new Date();
    } else if (input.status === 'completed' || input.status === 'failed') {
      timestamps.startedAt = new Date();
      timestamps.completedAt = new Date();
    }

    // Create the QuickScan
    const [created] = await db
      .insert(quickScans)
      .values({
        preQualificationId: input.preQualificationId,
        websiteUrl: input.websiteUrl,
        status: input.status,
        ...timestamps,
      })
      .returning();

    // Update PreQualification with quickScanId reference
    await db
      .update(preQualifications)
      .set({
        quickScanId: created.id,
        websiteUrl: input.websiteUrl,
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, input.preQualificationId));

    return {
      success: true,
      data: {
        id: created.id,
        preQualificationId: created.preQualificationId,
        websiteUrl: created.websiteUrl,
        status: created.status,
        createdAt: created.createdAt,
      },
    };
  },
});

// ============================================================================
// scan.quickscan.list - List QuickScans with optional filters
// ============================================================================

const listQuickScansInputSchema = z.object({
  preQualificationId: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'scan.quickscan.list',
  description: 'List QuickScans, optionally filtered by preQualificationId or status',
  category: 'scan',
  inputSchema: listQuickScansInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.preQualificationId) {
      conditions.push(eq(quickScans.preQualificationId, input.preQualificationId));
    }

    if (input.status) {
      conditions.push(eq(quickScans.status, input.status));
    }

    // Non-admin users can only see their own QuickScans (via PreQualification ownership)
    if (context.userRole !== 'admin') {
      const userPreQuals = await db
        .select({ id: preQualifications.id })
        .from(preQualifications)
        .where(eq(preQualifications.userId, context.userId));

      const preQualIds = userPreQuals.map(p => p.id);

      if (preQualIds.length === 0) {
        return { success: true, data: [] };
      }

      conditions.push(inArray(quickScans.preQualificationId, preQualIds));
    }

    const results = await db
      .select()
      .from(quickScans)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(quickScans.createdAt))
      .limit(input.limit);

    // Return summary (not full parsed JSON to keep response small)
    const summaries = results.map(scan => ({
      id: scan.id,
      preQualificationId: scan.preQualificationId,
      websiteUrl: scan.websiteUrl,
      status: scan.status,
      cms: scan.cms,
      framework: scan.framework,
      hosting: scan.hosting,
      pageCount: scan.pageCount,
      recommendedBusinessUnit: scan.recommendedBusinessUnit,
      confidence: scan.confidence,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      createdAt: scan.createdAt,
    }));

    return { success: true, data: summaries };
  },
});

// ============================================================================
// scan.quickscan.get - Get a single QuickScan by ID with full parsed data
// ============================================================================

const getQuickScanInputSchema = z.object({
  id: z.string(),
  includeRawData: z.boolean().default(false),
});

registry.register({
  name: 'scan.quickscan.get',
  description: 'Get a single QuickScan by ID with all parsed JSON fields',
  category: 'scan',
  inputSchema: getQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQuickScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const parsed = parseQuickScanJsonFields(access.scan!);

    // Optionally exclude rawScanData to keep response smaller
    if (!input.includeRawData) {
      parsed.rawScanData = null;
    }

    return { success: true, data: parsed };
  },
});

// ============================================================================
// scan.quickscan.getByPreQualification - Get QuickScan for a PreQualification
// ============================================================================

const getByPreQualInputSchema = z.object({
  preQualificationId: z.string(),
  includeRawData: z.boolean().default(false),
});

registry.register({
  name: 'scan.quickscan.getByPreQualification',
  description: 'Get the QuickScan for a specific PreQualification',
  category: 'scan',
  inputSchema: getByPreQualInputSchema,
  async execute(input, context: ToolContext) {
    // Check PreQualification access
    if (context.userRole !== 'admin') {
      const [preQual] = await db
        .select({ userId: preQualifications.userId })
        .from(preQualifications)
        .where(eq(preQualifications.id, input.preQualificationId))
        .limit(1);

      if (!preQual) {
        return { success: false, error: 'PreQualification not found' };
      }

      if (preQual.userId !== context.userId) {
        return { success: false, error: 'No access to this PreQualification' };
      }
    }

    const [scan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.preQualificationId, input.preQualificationId))
      .limit(1);

    if (!scan) {
      return { success: false, error: 'No QuickScan found for this PreQualification' };
    }

    const parsed = parseQuickScanJsonFields(scan);

    if (!input.includeRawData) {
      parsed.rawScanData = null;
    }

    return { success: true, data: parsed };
  },
});

// ============================================================================
// scan.quickscan.update - Update QuickScan fields (merge semantics)
// ============================================================================

const updateQuickScanInputSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  // Scalar fields
  cms: z.string().optional(),
  framework: z.string().optional(),
  hosting: z.string().optional(),
  pageCount: z.number().optional(),
  recommendedBusinessUnit: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  reasoning: z.string().optional(),
});

registry.register({
  name: 'scan.quickscan.update',
  description:
    'Update QuickScan scalar fields (status, cms, framework, etc). For JSON fields, use specialized append tools.',
  category: 'scan',
  inputSchema: updateQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQuickScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const updateData: Record<string, unknown> = {};

    if (input.status) updateData.status = input.status;
    if (input.cms !== undefined) updateData.cms = input.cms;
    if (input.framework !== undefined) updateData.framework = input.framework;
    if (input.hosting !== undefined) updateData.hosting = input.hosting;
    if (input.pageCount !== undefined) updateData.pageCount = input.pageCount;
    if (input.recommendedBusinessUnit !== undefined)
      updateData.recommendedBusinessUnit = input.recommendedBusinessUnit;
    if (input.confidence !== undefined) updateData.confidence = input.confidence;
    if (input.reasoning !== undefined) updateData.reasoning = input.reasoning;

    // Update timestamps based on status
    if (input.status === 'running') {
      updateData.startedAt = new Date();
    } else if (input.status === 'completed' || input.status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const [updated] = await db
      .update(quickScans)
      .set(updateData)
      .where(eq(quickScans.id, input.id))
      .returning();

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        cms: updated.cms,
        framework: updated.framework,
        hosting: updated.hosting,
        pageCount: updated.pageCount,
        recommendedBusinessUnit: updated.recommendedBusinessUnit,
        confidence: updated.confidence,
      },
    };
  },
});

// ============================================================================
// scan.quickscan.appendActivity - Append to activity log (merge semantics)
// ============================================================================

const appendActivityInputSchema = z.object({
  id: z.string(),
  activity: z.object({
    type: z.string(),
    message: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
});

registry.register({
  name: 'scan.quickscan.appendActivity',
  description: 'Append an activity entry to the QuickScan activity log',
  category: 'scan',
  inputSchema: appendActivityInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQuickScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Parse existing activity log
    let activityLog: unknown[] = [];
    if (access.scan!.activityLog) {
      try {
        activityLog = JSON.parse(access.scan!.activityLog);
      } catch {
        activityLog = [];
      }
    }

    // Append new activity with timestamp
    activityLog.push({
      ...input.activity,
      timestamp: new Date().toISOString(),
    });

    const [updated] = await db
      .update(quickScans)
      .set({ activityLog: JSON.stringify(activityLog) })
      .where(eq(quickScans.id, input.id))
      .returning();

    return {
      success: true,
      data: {
        id: updated.id,
        activityLogLength: activityLog.length,
      },
    };
  },
});

// ============================================================================
// scan.quickscan.delete - Delete a QuickScan (existing, updated with access check)
// ============================================================================

const deleteQuickScanInputSchema = z.object({
  id: z.string(),
});

// ===== Tool Implementations =====

registry.register({
  name: 'scan.quickscan.delete',
  description: 'Delete a QuickScan (hard delete - cascades to related data)',
  category: 'scan',
  inputSchema: deleteQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    // Only BD and Admin can delete QuickScans
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete QuickScans' };
    }

    const access = await checkQuickScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    await db.delete(quickScans).where(eq(quickScans.id, input.id));

    return {
      success: true,
      message: 'QuickScan deleted successfully',
      deletedId: input.id,
    };
  },
});
