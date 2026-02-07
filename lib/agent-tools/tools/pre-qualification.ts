import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import {
  preQualifications,
  documents,
  qualificationScans,
  businessUnits,
  auditTrails,
} from '@/lib/db/schema';

// Valid PreQualification status transitions
// Based on workflow: draft → processing → extracting → reviewing → lead_scanning → decision_made → routed → ...
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['processing', 'extracting', 'archived'],
  processing: ['duplicate_checking', 'extracting', 'archived'],
  duplicate_checking: ['duplicate_warning', 'duplicate_check_failed', 'extracting', 'archived'],
  duplicate_check_failed: ['extracting', 'archived'],
  duplicate_warning: ['extracting', 'archived'],
  extracting: ['extraction_failed', 'manual_extraction', 'reviewing', 'archived'],
  extraction_failed: ['manual_extraction', 'archived'],
  manual_extraction: ['reviewing', 'archived'],
  reviewing: ['qualification_scanning', 'archived'],
  qualification_scanning: [
    'qualification_scan_failed',
    'bit_pending',
    'questions_ready',
    'archived',
  ],
  qualification_scan_failed: ['bit_pending', 'questions_ready', 'archived'],
  bit_pending: ['timeline_estimating', 'decision_made', 'archived'],
  questions_ready: ['evaluating', 'decision_made', 'archived'],
  timeline_estimating: ['timeline_failed', 'decision_made', 'archived'],
  timeline_failed: ['decision_made', 'archived'],
  evaluating: ['decision_made', 'archived'],
  decision_made: ['routed', 'bid_voted', 'archived'],
  bid_voted: ['routed', 'archived'],
  routed: ['audit_scanning', 'bl_reviewing', 'archived'],
  audit_scanning: ['bl_reviewing', 'archived'],
  bl_reviewing: ['team_assigned', 'archived'],
  team_assigned: ['notified', 'archived'],
  notified: ['handed_off', 'analysis_complete', 'archived'],
  handed_off: ['analysis_complete', 'archived'],
  analysis_complete: ['archived'],
  archived: [], // Terminal state - no transitions out
};

const listPreQualificationsInputSchema = z.object({
  status: z
    .enum([
      'draft',
      'extracting',
      'reviewing',
      'qualification_scanning',
      'evaluating',
      'decision_made',
      'archived',
      'routed',
      'audit_scanning',
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
  description: 'List all Qualifications/Bids for the current user, optionally filtered by status',
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
  description: 'Get a single Qualification/Bid by ID',
  category: 'pre-qualification',
  inputSchema: getPreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Qualification not found or no access' };
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
  description: 'Create a new Qualification/Bid from text input',
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
      'qualification_scanning',
      'evaluating',
      'decision_made',
      'archived',
      'routed',
      'audit_scanning',
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
  description: 'Update an existing Qualification/Bid',
  category: 'pre-qualification',
  inputSchema: updatePreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Qualification not found or no access' };
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

// ===== Status Update Tool (with validation + audit trail) =====

const updateStatusInputSchema = z.object({
  id: z.string().describe('Qualification ID'),
  targetStatus: z
    .enum([
      'draft',
      'processing',
      'duplicate_checking',
      'duplicate_check_failed',
      'duplicate_warning',
      'extracting',
      'extraction_failed',
      'manual_extraction',
      'reviewing',
      'qualification_scanning',
      'qualification_scan_failed',
      'bit_pending',
      'questions_ready',
      'timeline_estimating',
      'timeline_failed',
      'evaluating',
      'decision_made',
      'bid_voted',
      'archived',
      'routed',
      'audit_scanning',
      'bl_reviewing',
      'team_assigned',
      'notified',
      'handed_off',
      'analysis_complete',
    ])
    .describe('Target status to transition to'),
  reason: z
    .string()
    .optional()
    .describe('Optional reason for the status change (recorded in audit trail)'),
});

registry.register({
  name: 'preQualification.updateStatus',
  description:
    'Update the status of a Qualification with validation. Enforces valid status transitions and creates an audit trail. Admin users can bypass ownership checks.',
  category: 'pre-qualification',
  inputSchema: updateStatusInputSchema,
  async execute(input, context: ToolContext) {
    // Build access query - admin can access any, others only their own
    const isAdmin = context.userRole === 'admin';

    let existing;
    if (isAdmin) {
      [existing] = await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, input.id))
        .limit(1);
    } else {
      [existing] = await db
        .select()
        .from(preQualifications)
        .where(
          and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId))
        )
        .limit(1);
    }

    if (!existing) {
      return { success: false, error: 'Qualification not found or no access' };
    }

    const currentStatus = existing.status;
    const targetStatus = input.targetStatus;

    // Validate status transition
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!validTransitions.includes(targetStatus)) {
      return {
        success: false,
        error: `Invalid status transition: ${currentStatus} -> ${targetStatus}. Valid transitions: ${validTransitions.join(', ') || 'none'}`,
      };
    }

    // Update status
    const [updated] = await db
      .update(preQualifications)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(eq(preQualifications.id, input.id))
      .returning();

    // Create audit trail entry
    await db.insert(auditTrails).values({
      userId: context.userId,
      action: 'status_change',
      entityType: 'pre_qualification',
      entityId: input.id,
      previousValue: JSON.stringify({ status: currentStatus }),
      newValue: JSON.stringify({ status: targetStatus }),
      reason: input.reason || null,
    });

    return {
      success: true,
      data: {
        id: updated.id,
        previousStatus: currentStatus,
        status: updated.status,
        auditLogged: true,
      },
    };
  },
});

const deletePreQualificationInputSchema = z.object({
  id: z.string().describe('Qualification ID to delete'),
  reason: z.string().optional().describe('Optional reason for deletion (recorded in audit trail)'),
});

registry.register({
  name: 'preQualification.delete',
  description:
    'Soft-delete a Qualification/Bid (archives it). Admin users can delete any Qualification. Creates an audit trail entry.',
  category: 'pre-qualification',
  inputSchema: deletePreQualificationInputSchema,
  async execute(input, context: ToolContext) {
    // Build access query - admin can access any, others only their own
    const isAdmin = context.userRole === 'admin';

    let existing;
    if (isAdmin) {
      [existing] = await db
        .select()
        .from(preQualifications)
        .where(eq(preQualifications.id, input.id))
        .limit(1);
    } else {
      [existing] = await db
        .select()
        .from(preQualifications)
        .where(
          and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId))
        )
        .limit(1);
    }

    if (!existing) {
      return { success: false, error: 'Qualification not found or no access' };
    }

    const previousStatus = existing.status as string;

    // Already archived - nothing to do
    if (existing.status === 'archived') {
      return {
        success: true,
        data: { id: existing.id, status: 'archived', previousStatus, alreadyArchived: true },
      };
    }

    const [archived] = await db
      .update(preQualifications)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(preQualifications.id, input.id))
      .returning();

    // Create audit trail entry
    await db.insert(auditTrails).values({
      userId: context.userId,
      action: 'delete',
      entityType: 'pre_qualification',
      entityId: input.id,
      previousValue: JSON.stringify({ status: previousStatus }),
      newValue: JSON.stringify({ status: 'archived' }),
      reason: input.reason || null,
    });

    return {
      success: true,
      data: { id: archived.id, status: 'archived', previousStatus, alreadyArchived: false },
    };
  },
});

const getQualificationScanInputSchema = z.object({
  preQualificationId: z.string(),
});

registry.register({
  name: 'preQualification.getQualificationScan',
  description: 'Get Quick Scan results for a Qualification',
  category: 'pre-qualification',
  inputSchema: getQualificationScanInputSchema,
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
      return { success: false, error: 'Qualification not found or no access' };
    }

    if (!preQualification.qualificationScanId) {
      return { success: false, error: 'No Quick Scan for this Qualification' };
    }

    const [scan] = await db
      .select()
      .from(qualificationScans)
      .where(eq(qualificationScans.id, preQualification.qualificationScanId))
      .limit(1);

    return { success: true, data: scan };
  },
});

// Snake_case alias for naming convention compliance
registry.alias('preQualification.get_qualification_scan', 'preQualification.getQualificationScan');

const listDocumentsInputSchema = z.object({
  preQualificationId: z.string(),
});

registry.register({
  name: 'preQualification.listDocuments',
  description: 'List all documents attached to a Qualification',
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
      return { success: false, error: 'Qualification not found or no access' };
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
  id: z.string().describe('Qualification ID to route'),
  businessUnitId: z.string().describe('Target Business Unit ID'),
});

registry.register({
  name: 'preQualification.route',
  description:
    'Route a Qualification to a Business Unit for BL review. Validates business unit exists and updates status to bl_reviewing.',
  category: 'pre-qualification',
  inputSchema: routeToBusinessUnitInputSchema,
  async execute(input, context: ToolContext) {
    // Verify Qualification exists and user has access
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Qualification not found or no access' };
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

    // Update Qualification with business unit assignment and status
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
  id: z.string().describe('Qualification ID'),
  decision: z.enum(['bid', 'no_bid']).describe('BID or NO-BID decision'),
  reason: z.string().optional().describe('Optional reason for the decision'),
});

// ===== Business Unit Assignment Tools =====

const assignBusinessUnitInputSchema = z.object({
  bidId: z.string().describe('Qualification/Bid ID to assign'),
  businessLineName: z.string().describe('Name of the Business Unit to assign'),
  overrideReason: z
    .string()
    .optional()
    .describe('Required if overriding AI recommendation - explain why'),
});

registry.register({
  name: 'routing.assignBusinessUnit',
  description:
    'Assign a Qualification/Bid to a Business Unit. Validates routing-ready status, creates audit log for overrides, auto-converts to Lead, and sends email notification to BL leader.',
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
  bidId: z.string().describe('Qualification/Bid ID to get recommendation for'),
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
  preQualificationId: z.string().describe('Qualification ID to archive'),
  reason: z.string().describe('Reason for the NO-BID decision'),
});

registry.register({
  name: 'routing.archiveAsNoBid',
  description:
    'Archive a Qualification as NO-BID with a reason. Sets decision to no_bid and status to archived.',
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
    'Make a BID or NO-BID decision for a Qualification. BID moves to routed status, NO-BID archives.',
  category: 'pre-qualification',
  inputSchema: makeDecisionInputSchema,
  async execute(input, context: ToolContext) {
    // Verify Qualification exists and user has access
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(and(eq(preQualifications.id, input.id), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'Qualification not found or no access' };
    }

    // Update Qualification with decision
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

// ===== Input Creation Tools =====

const createFromFreetextInputSchema = z.object({
  projectDescription: z.string().min(50).describe('Project description (min 50 characters)'),
  customerName: z.string().min(1).describe('Customer name'),
  source: z.enum(['reactive', 'proactive']).default('reactive'),
  stage: z.enum(['cold', 'warm', 'pre-qualification']).default('warm'),
  accountId: z.string().optional().describe('Optional Account ID to link'),
});

registry.register({
  name: 'preQualification.createFromFreetext',
  description:
    'Create a new Qualification from freetext input (customer name + project description). Automatically triggers the extraction workflow. This is the agent equivalent of the user "Upload Freetext" action.',
  category: 'pre-qualification',
  inputSchema: createFromFreetextInputSchema,
  async execute(input, _context: ToolContext) {
    // Import server action
    const { uploadFreetextBid } = await import('@/lib/bids/actions');

    // Call the server action
    const result = await uploadFreetextBid({
      projectDescription: input.projectDescription,
      customerName: input.customerName,
      source: input.source,
      stage: input.stage,
      accountId: input.accountId,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        bidId: result.bidId,
        message: 'Qualification created and extraction workflow triggered',
      },
    };
  },
});

// ===== Extraction Tools =====

const startExtractionInputSchema = z.object({
  bidId: z.string().describe('Qualification/Bid ID to extract requirements from'),
});

registry.register({
  name: 'extraction.start',
  description:
    'Start the extraction process for a Qualification. Extracts structured requirements from the raw document text using AI. Status transitions: draft → extracting → reviewing.',
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
    'Start the audit scan pipeline for a Lead. Creates an audit scan run, enqueues background processing job, and begins website analysis. Requires Lead to have a websiteUrl. Returns the runId for progress tracking.',
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
