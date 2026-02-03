import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { preQualifications, documents, quickScans, businessUnits } from '@/lib/db/schema';

const listPreQualificationsInputSchema = z.object({
  status: z
    .enum([
      'draft',
      'extracting',
      'reviewing',
      'quick_scanning',
      'evaluating',
      'decision_made',
      'archived',
      'routed',
      'full_scanning',
      'bl_reviewing',
      'team_assigned',
      'notified',
      'handed_off',
      'analysis_complete',
    ])
    .optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'preQualification.list',
  description:
    'List all Pre-Qualifications/Bids for the current user, optionally filtered by status',
  category: 'pre-qualification',
  inputSchema: listPreQualificationsInputSchema,
  async execute(input, context: ToolContext) {
    let results;
    if (input.status) {
      results = await db
        .select()
        .from(preQualifications)
        .where(
          and(
            eq(preQualifications.userId, context.userId),
            eq(preQualifications.status, input.status)
          )
        )
        .orderBy(desc(preQualifications.createdAt))
        .limit(input.limit);
    } else {
      results = await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.userId, context.userId))
        .orderBy(desc(preQualifications.createdAt))
        .limit(input.limit);
    }

    return { success: true, data: results };
  },
});

const getPreQualificationInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'preQualification.get',
  description: 'Get a single Pre-Qualification/Bid by ID',
  category: 'pre-qualification',
  inputSchema: getPreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    return { success: true, data: preQualification };
  },
});

const createPreQualificationInputSchema = z.object({
  source: z.enum(['reactive', 'proactive']),
  stage: z.enum(['cold', 'warm', 'pre-qualification']),
  inputType: z.enum(['pdf', 'crm', 'freetext', 'email', 'combined']),
  rawInput: z.string().min(20),
  websiteUrl: z.string().url().optional(),
  accountId: z.string().optional(),
});

registry.register({
  name: 'preQualification.create',
  description: 'Create a new Pre-Qualification/Bid from text input',
  category: 'pre-qualification',
  inputSchema: createPreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    const [preQualification] = await db
      .insert(preQualifications)
      .values({
        userId: context.userId,
        source: input.source,
        stage: input.stage,
        inputType: input.inputType,
        rawInput: input.rawInput,
        websiteUrl: input.websiteUrl,
        accountId: input.accountId,
        status: 'draft',
        decision: 'pending',
      })
      .returning();

    return { success: true, data: preQualification };
  },
});

const updatePreQualificationInputSchema = z.object({
  id: z.string(),
  status: z
    .enum([
      'draft',
      'extracting',
      'reviewing',
      'quick_scanning',
      'evaluating',
      'decision_made',
      'archived',
      'routed',
      'full_scanning',
      'bl_reviewing',
      'team_assigned',
      'notified',
      'handed_off',
      'analysis_complete',
    ])
    .optional(),
  decision: z.enum(['bid', 'no_bid', 'pending']).optional(),
  extractedRequirements: z.object({}).passthrough().optional(),
  websiteUrl: z.string().url().optional(),
  assignedBusinessUnitId: z.string().optional(),
});

registry.register({
  name: 'preQualification.update',
  description: 'Update an existing Pre-Qualification/Bid',
  category: 'pre-qualification',
  inputSchema: updatePreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status) updateData.status = input.status;
    if (input.decision) updateData.decision = input.decision;
    if (input.extractedRequirements)
      updateData.extractedRequirements = JSON.stringify(input.extractedRequirements);
    if (input.websiteUrl) updateData.websiteUrl = input.websiteUrl;
    if (input.assignedBusinessUnitId)
      updateData.assignedBusinessUnitId = input.assignedBusinessUnitId;

    const [updated] = await db
      .update(preQualifications)
      .set(updateData)
      .where(eq(preQualifications.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

const deletePreQualificationInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'preQualification.delete',
  description: 'Delete an Pre-Qualification/Bid (archives it)',
  category: 'pre-qualification',
  inputSchema: deletePreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    const [archived] = await db
      .update(preQualifications)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(preQualifications.id, input.id))
      .returning();

    return { success: true, data: { id: archived.id, status: 'archived' } };
  },
});

const getQuickScanInputSchema = z.object({
  preQualificationId: z.string(),
});

registry.register({
  name: 'preQualification.getQuickScan',
  description: 'Get Quick Scan results for an Pre-Qualification',
  category: 'pre-qualification',
  inputSchema: getQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, input.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    if (!preQualification.quickScanId) {
      return { success: false, error: 'No Quick Scan for this Pre-Qualification' };
    }

    const [scan] = await db
      .select()
      .from(quickScans)
      .where(eq(quickScans.id, preQualification.quickScanId))
      .limit(1);

    return { success: true, data: scan };
  },
});

const listDocumentsInputSchema = z.object({
  preQualificationId: z.string(),
});

registry.register({
  name: 'preQualification.listDocuments',
  description: 'List all documents attached to an Pre-Qualification',
  category: 'pre-qualification',
  inputSchema: listDocumentsInputSchema,
  async execute(input, context: ToolContext) {
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(
        and(
          eq(preQualifications.id, input.preQualificationId),
          eq(preQualifications.userId, context.userId)
        )
      )
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    const docs = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        uploadSource: documents.uploadSource,
        uploadedAt: documents.uploadedAt,
      })
      .from(documents)
      .where(eq(documents.preQualificationId, input.preQualificationId))
      .orderBy(desc(documents.uploadedAt));

    return { success: true, data: docs };
  },
});

// ===== Routing Tools =====

const routeToBusinessUnitInputSchema = z.object({
  id: z.string().describe('Pre-Qualification ID to route'),
  businessUnitId: z.string().describe('Target Business Unit ID'),
});

registry.register({
  name: 'preQualification.route',
  description:
    'Route a Pre-Qualification to a Business Unit for BL review. Validates business unit exists and updates status to bl_reviewing.',
  category: 'pre-qualification',
  inputSchema: routeToBusinessUnitInputSchema,
  async execute(input, context: ToolContext) {
    // Verify Pre-Qualification exists and user has access
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    // Verify Business Unit exists
    const [businessUnit] = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, input.businessUnitId))
      .limit(1);

    if (!businessUnit) {
      return { success: false, error: 'Business Unit not found' };
    }

    // Update Pre-Qualification with business unit assignment and status
    const [updated] = await db
      .update(preQualifications)
      .set({
        assignedBusinessUnitId: input.businessUnitId,
        status: 'bl_reviewing',
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, input.id))
      .returning();

    return {
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        businessUnit: {
          id: businessUnit.id,
          name: businessUnit.name,
          leaderName: businessUnit.leaderName,
        },
      },
    };
  },
});

const makeDecisionInputSchema = z.object({
  id: z.string().describe('Pre-Qualification ID'),
  decision: z.enum(['bid', 'no_bid']).describe('BID or NO-BID decision'),
  reason: z.string().optional().describe('Optional reason for the decision'),
});

// ===== Business Unit Assignment Tools =====

const assignBusinessUnitInputSchema = z.object({
  bidId: z.string().describe('Pre-Qualification/Bid ID to assign'),
  businessLineName: z.string().describe('Name of the Business Unit to assign'),
  overrideReason: z
    .string()
    .optional()
    .describe('Required if overriding AI recommendation - explain why'),
});

registry.register({
  name: 'routing.assignBusinessUnit',
  description:
    'Assign a Pre-Qualification/Bid to a Business Unit. Validates routing-ready status, creates audit log for overrides, auto-converts to Lead, and sends email notification to BL leader.',
  category: 'routing',
  inputSchema: assignBusinessUnitInputSchema,
  async execute(input, context: ToolContext) {
    // Import server action
    const { assignBusinessUnit } = await import('@/lib/routing/actions');

    // Call the server action
    const result = await assignBusinessUnit({
      bidId: input.bidId,
      businessLineName: input.businessLineName,
      overrideReason: input.overrideReason,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        leadId: result.leadId,
        warning: result.warning,
      },
    };
  },
});

const getBusinessLineRecommendationInputSchema = z.object({
  bidId: z.string().describe('Pre-Qualification/Bid ID to get recommendation for'),
});

registry.register({
  name: 'routing.getRecommendation',
  description:
    'Get AI-powered Business Line recommendation for a bid. Returns recommended BU with confidence score and reasoning.',
  category: 'routing',
  inputSchema: getBusinessLineRecommendationInputSchema,
  async execute(input, _context: ToolContext) {
    // Import server action
    const { getBusinessLineRecommendation } = await import('@/lib/routing/actions');

    // Call the server action
    const result = await getBusinessLineRecommendation(input.bidId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: result.recommendation,
    };
  },
});

const archiveAsNoBidInputSchema = z.object({
  preQualificationId: z.string().describe('Pre-Qualification ID to archive'),
  reason: z.string().describe('Reason for the NO-BID decision'),
});

registry.register({
  name: 'routing.archiveAsNoBid',
  description:
    'Archive a Pre-Qualification as NO-BID with a reason. Sets decision to no_bid and status to archived.',
  category: 'routing',
  inputSchema: archiveAsNoBidInputSchema,
  async execute(input, _context: ToolContext) {
    // Import server action
    const { archiveAsNoBid } = await import('@/lib/routing/actions');

    // Call the server action
    const result = await archiveAsNoBid({
      preQualificationId: input.preQualificationId,
      reason: input.reason,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: { archived: true } };
  },
});

registry.register({
  name: 'preQualification.makeDecision',
  description:
    'Make a BID or NO-BID decision for a Pre-Qualification. BID moves to routed status, NO-BID archives.',
  category: 'pre-qualification',
  inputSchema: makeDecisionInputSchema,
  async execute(input, context: ToolContext) {
    // Verify Pre-Qualification exists and user has access
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Pre-Qualification not found or no access' };
    }

    // Update Pre-Qualification with decision
    const [updated] = await db
      .update(preQualifications)
      .set({
        decision: input.decision,
        status: input.decision === 'bid' ? 'routed' : 'archived',
        alternativeRecommendation: input.reason || null,
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, input.id))
      .returning();

    return {
      success: true,
      data: {
        id: updated.id,
        decision: updated.decision,
        status: updated.status,
      },
    };
  },
});

// ===== Extraction Tools =====

const startExtractionInputSchema = z.object({
  bidId: z.string().describe('Pre-Qualification/Bid ID to extract requirements from'),
});

registry.register({
  name: 'extraction.start',
  description:
    'Start the extraction process for a Pre-Qualification. Extracts structured requirements from the raw document text using AI. Status transitions: draft → extracting → reviewing.',
  category: 'extraction',
  inputSchema: startExtractionInputSchema,
  async execute(input, _context: ToolContext) {
    // Import server action
    const { startExtraction } = await import('@/lib/bids/actions');

    // Call the server action
    const result = await startExtraction(input.bidId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        requirements: result.requirements,
      },
    };
  },
});

// ===== Pitch Scan Tools =====

const startPitchScanInputSchema = z.object({
  pitchId: z.string().describe('Lead/Pitch ID to start the scan pipeline for'),
});

registry.register({
  name: 'pitchScan.start',
  description:
    'Start the pitch scan pipeline for a Lead. Creates a pitch run, enqueues background processing job, and begins website analysis. Requires Lead to have a websiteUrl. Returns the runId for progress tracking.',
  category: 'scan',
  inputSchema: startPitchScanInputSchema,
  async execute(input, _context: ToolContext) {
    // Import server action
    const { startPitchScan } = await import('@/lib/pitches/actions');

    // Call the server action
    const result = await startPitchScan(input.pitchId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        runId: result.runId,
      },
    };
  },
});
