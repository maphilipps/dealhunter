import { eq, desc, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { qualificationScans, preQualifications } from '@/lib/db/schema';

/** @deprecated Use qualificationScans */
const leadScans = qualificationScans;

// ============================================================================
// Helper: Check access to PreQualification for creating LeadScan
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

  if (context.userRole === 'admin') {
    return { allowed: true, preQual };
  }

  if (preQual.userId !== context.userId) {
    return { allowed: false, error: 'No access to this PreQualification' };
  }

  return { allowed: true, preQual };
}

// ============================================================================
// Helper: Parse JSON fields for consistent response format
// ============================================================================

function parseQualificationScanJsonFields(scan: typeof leadScans.$inferSelect) {
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
// Helper: Check access to LeadScan via PreQualification ownership
// ============================================================================

async function checkQualificationScanAccess(
  scanId: string,
  context: ToolContext
): Promise<{ allowed: boolean; scan?: typeof leadScans.$inferSelect; error?: string }> {
  const [scan] = await db.select().from(leadScans).where(eq(leadScans.id, scanId)).limit(1);

  if (!scan) {
    return { allowed: false, error: 'Qualification Scan not found' };
  }

  if (context.userRole === 'admin') {
    return { allowed: true, scan };
  }

  const [preQual] = await db
    .select({ userId: preQualifications.userId })
    .from(preQualifications)
    .where(eq(preQualifications.id, scan.preQualificationId))
    .limit(1);

  if (!preQual || preQual.userId !== context.userId) {
    return { allowed: false, error: 'No access to this Qualification Scan' };
  }

  return { allowed: true, scan };
}

// ============================================================================
// leadScan.create - Create a new LeadScan for a PreQualification
// ============================================================================

const createLeadScanInputSchema = z.object({
  preQualificationId: z.string(),
  websiteUrl: z.string().url(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
});

registry.register({
  name: 'qualificationScan.create',
  description:
    'Create a new Qualification Scan for a PreQualification. Only one Qualification Scan per PreQualification is allowed.',
  category: 'qualification-scan',
  inputSchema: createLeadScanInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkPreQualificationAccess(input.preQualificationId, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const [existingScan] = await db
      .select({ id: leadScans.id })
      .from(leadScans)
      .where(eq(leadScans.preQualificationId, input.preQualificationId))
      .limit(1);

    if (existingScan) {
      return {
        success: false,
        error: 'Qualification Scan already exists for this Qualification',
        existingId: existingScan.id,
      };
    }

    const timestamps: Record<string, Date> = {
      createdAt: new Date(),
    };

    if (input.status === 'running') {
      timestamps.startedAt = new Date();
    } else if (input.status === 'completed' || input.status === 'failed') {
      timestamps.startedAt = new Date();
      timestamps.completedAt = new Date();
    }

    const [created] = await db
      .insert(leadScans)
      .values({
        preQualificationId: input.preQualificationId,
        websiteUrl: input.websiteUrl,
        status: input.status,
        ...timestamps,
      })
      .returning();

    await db
      .update(preQualifications)
      .set({
        qualificationScanId: created.id,
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
// leadScan.list - List LeadScans with optional filters
// ============================================================================

const listLeadScansInputSchema = z.object({
  preQualificationId: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'qualificationScan.list',
  description: 'List Qualification Scans, optionally filtered by preQualificationId or status',
  category: 'qualification-scan',
  inputSchema: listLeadScansInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.preQualificationId) {
      conditions.push(eq(leadScans.preQualificationId, input.preQualificationId));
    }

    if (input.status) {
      conditions.push(eq(leadScans.status, input.status));
    }

    // For non-admin users, use EXISTS subquery for ownership check (single query, no unbounded IN)
    if (context.userRole !== 'admin') {
      conditions.push(
        inArray(
          leadScans.preQualificationId,
          db
            .select({ id: preQualifications.id })
            .from(preQualifications)
            .where(eq(preQualifications.userId, context.userId))
        )
      );
    }

    const results = await db
      .select()
      .from(leadScans)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leadScans.createdAt))
      .limit(input.limit);

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
// leadScan.get - Get a single LeadScan by ID with full parsed data
// ============================================================================

const getLeadScanInputSchema = z.object({
  id: z.string(),
  includeRawData: z.boolean().default(false),
});

registry.register({
  name: 'qualificationScan.get',
  description: 'Get a single Qualification Scan by ID with all parsed JSON fields',
  category: 'qualification-scan',
  inputSchema: getLeadScanInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQualificationScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const parsed = parseQualificationScanJsonFields(access.scan!);

    if (!input.includeRawData) {
      parsed.rawScanData = null;
    }

    return { success: true, data: parsed };
  },
});

// ============================================================================
// leadScan.get_by_pre_qualification - Get LeadScan for a PreQualification
// ============================================================================

const getByPreQualInputSchema = z.object({
  preQualificationId: z.string(),
  includeRawData: z.boolean().default(false),
});

registry.register({
  name: 'qualificationScan.get_by_pre_qualification',
  description: 'Get the Qualification Scan for a specific PreQualification',
  category: 'qualification-scan',
  inputSchema: getByPreQualInputSchema,
  async execute(input, context: ToolContext) {
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
      .from(leadScans)
      .where(eq(leadScans.preQualificationId, input.preQualificationId))
      .limit(1);

    if (!scan) {
      return { success: false, error: 'No Qualification Scan found for this Qualification' };
    }

    const parsed = parseQualificationScanJsonFields(scan);

    if (!input.includeRawData) {
      parsed.rawScanData = null;
    }

    return { success: true, data: parsed };
  },
});

// ============================================================================
// leadScan.update - Update LeadScan fields (merge semantics)
// ============================================================================

const updateLeadScanInputSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  cms: z.string().optional(),
  framework: z.string().optional(),
  hosting: z.string().optional(),
  pageCount: z.number().optional(),
  recommendedBusinessUnit: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  reasoning: z.string().optional(),
});

registry.register({
  name: 'qualificationScan.update',
  description:
    'Update Qualification Scan scalar fields (status, cms, framework, etc). For JSON fields, use specialized append tools.',
  category: 'qualification-scan',
  inputSchema: updateLeadScanInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQualificationScanAccess(input.id, context);
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

    if (input.status === 'running') {
      updateData.startedAt = new Date();
    } else if (input.status === 'completed' || input.status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const [updated] = await db
      .update(leadScans)
      .set(updateData)
      .where(eq(leadScans.id, input.id))
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
// leadScan.append_activity - Append to activity log (merge semantics)
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
  name: 'qualificationScan.append_activity',
  description: 'Append an activity entry to the Qualification Scan activity log',
  category: 'qualification-scan',
  inputSchema: appendActivityInputSchema,
  async execute(input, context: ToolContext) {
    const access = await checkQualificationScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    let activityLog: unknown[] = [];
    if (access.scan!.activityLog) {
      try {
        activityLog = JSON.parse(access.scan!.activityLog);
      } catch {
        activityLog = [];
      }
    }

    activityLog.push({
      ...input.activity,
      timestamp: new Date().toISOString(),
    });

    const [updated] = await db
      .update(leadScans)
      .set({ activityLog: JSON.stringify(activityLog) })
      .where(eq(leadScans.id, input.id))
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
// leadScan.delete - Delete a LeadScan
// ============================================================================

const deleteLeadScanInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'qualificationScan.delete',
  description: 'Delete a Qualification Scan (hard delete - cascades to related data)',
  category: 'qualification-scan',
  inputSchema: deleteLeadScanInputSchema,
  async execute(input, context: ToolContext) {
    if (context.userRole === 'bl') {
      return { success: false, error: 'Access denied: BL users cannot delete Qualification Scans' };
    }

    const access = await checkQualificationScanAccess(input.id, context);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    await db.delete(leadScans).where(eq(leadScans.id, input.id));

    return {
      success: true,
      message: 'Qualification Scan deleted successfully',
      deletedId: input.id,
    };
  },
});
