import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import {
  pitchRuns,
  pitchAuditResults,
  pitchDocuments,
  pitches,
  technologies,
} from '@/lib/db/schema';

/**
 * PitchRun & PitchAuditResult CRUD Tools
 *
 * PitchRun tracks scan/generation progress for Leads.
 * PitchAuditResult stores website audit data from scans.
 *
 * These tools provide full CRUD access for agents to:
 * - Monitor scan progress
 * - Read audit results
 * - Update run status
 * - Access generated documents
 */

// ============================================================================
// pitchRun.create - Create a new pitch run for a lead
// ============================================================================

const createPitchRunInputSchema = z.object({
  pitchId: z.string(),
  status: z
    .enum([
      'pending',
      'running',
      'audit_complete',
      'generating',
      'waiting_for_user',
      'review',
      'completed',
      'failed',
    ])
    .default('pending'),
  targetCmsIds: z.array(z.string()).optional(),
  selectedCmsId: z.string().optional(),
  currentPhase: z.string().optional(),
  currentStep: z.string().optional(),
});

registry.register({
  name: 'pitchRun.create',
  description:
    'Create a new pitch run for a lead. Automatically resolves available CMS technologies from the business unit.',
  category: 'pitch-run',
  inputSchema: createPitchRunInputSchema,
  async execute(input, context: ToolContext) {
    // Verify pitch/lead exists and user has access
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.pitchId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only create runs for leads in their BU
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Calculate next run number for this pitch
    const existingRuns = await db
      .select({ runNumber: pitchRuns.runNumber })
      .from(pitchRuns)
      .where(eq(pitchRuns.pitchId, input.pitchId))
      .orderBy(desc(pitchRuns.runNumber))
      .limit(1);

    const nextRunNumber = existingRuns.length > 0 ? existingRuns[0].runNumber + 1 : 1;

    // Resolve target CMS IDs if not provided
    let targetCmsIds = input.targetCmsIds;
    if (!targetCmsIds && lead.businessUnitId) {
      const availableCms = await db
        .select({ id: technologies.id })
        .from(technologies)
        .where(eq(technologies.businessUnitId, lead.businessUnitId));

      targetCmsIds = availableCms.map(c => c.id);
    }

    // Set timestamps based on status
    const timestamps: Record<string, Date> = {
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (input.status === 'running') {
      timestamps.startedAt = new Date();
    } else if (input.status === 'completed' || input.status === 'failed') {
      timestamps.startedAt = new Date();
      timestamps.completedAt = new Date();
    }

    // Create the pitch run
    const [created] = await db
      .insert(pitchRuns)
      .values({
        pitchId: input.pitchId,
        userId: context.userId,
        status: input.status,
        runNumber: nextRunNumber,
        targetCmsIds: targetCmsIds ? JSON.stringify(targetCmsIds) : null,
        selectedCmsId: input.selectedCmsId,
        currentPhase: input.currentPhase,
        currentStep: input.currentStep,
        progress: 0,
        ...timestamps,
      })
      .returning();

    return {
      success: true,
      data: {
        id: created.id,
        pitchId: created.pitchId,
        userId: created.userId,
        status: created.status,
        runNumber: created.runNumber,
        targetCmsIds: targetCmsIds,
        selectedCmsId: created.selectedCmsId,
        currentPhase: created.currentPhase,
        currentStep: created.currentStep,
        progress: created.progress,
        createdAt: created.createdAt,
      },
    };
  },
});

// ============================================================================
// pitchRun.list - List all pitch runs
// ============================================================================

const listPitchRunsInputSchema = z.object({
  pitchId: z.string().optional(),
  status: z
    .enum([
      'pending',
      'running',
      'audit_complete',
      'generating',
      'waiting_for_user',
      'review',
      'completed',
      'failed',
    ])
    .optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'pitchRun.list',
  description: 'List all pitch runs, optionally filtered by pitch or status',
  category: 'pitch-run',
  inputSchema: listPitchRunsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [eq(pitchRuns.userId, context.userId)];

    if (input.pitchId) {
      conditions.push(eq(pitchRuns.pitchId, input.pitchId));
    }
    if (input.status) {
      conditions.push(eq(pitchRuns.status, input.status));
    }

    const runs = await db
      .select()
      .from(pitchRuns)
      .where(and(...conditions))
      .orderBy(desc(pitchRuns.createdAt))
      .limit(input.limit);

    return { success: true, data: runs };
  },
});

// ============================================================================
// pitchRun.get - Get a single pitch run by ID
// ============================================================================

const getPitchRunInputSchema = z.object({
  id: z.string(),
  includeAuditResults: z.boolean().default(false),
  includeDocuments: z.boolean().default(false),
});

registry.register({
  name: 'pitchRun.get',
  description: 'Get a single pitch run by ID with optional audit results and documents',
  category: 'pitch-run',
  inputSchema: getPitchRunInputSchema,
  async execute(input, context: ToolContext) {
    const [run] = await db
      .select()
      .from(pitchRuns)
      .where(and(eq(pitchRuns.id, input.id), eq(pitchRuns.userId, context.userId)))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Pitch run not found or no access' };
    }

    let auditResults = undefined;
    let documents = undefined;

    if (input.includeAuditResults) {
      auditResults = await db
        .select()
        .from(pitchAuditResults)
        .where(eq(pitchAuditResults.runId, input.id));
    }

    if (input.includeDocuments) {
      documents = await db
        .select({
          id: pitchDocuments.id,
          documentType: pitchDocuments.documentType,
          format: pitchDocuments.format,
          cmsVariant: pitchDocuments.cmsVariant,
          fileName: pitchDocuments.fileName,
          fileSize: pitchDocuments.fileSize,
          confidence: pitchDocuments.confidence,
          generatedAt: pitchDocuments.generatedAt,
        })
        .from(pitchDocuments)
        .where(eq(pitchDocuments.runId, input.id));
    }

    return {
      success: true,
      data: {
        ...run,
        auditResults,
        documents,
      },
    };
  },
});

// ============================================================================
// pitchRun.update - Update a pitch run
// ============================================================================

const updatePitchRunInputSchema = z.object({
  id: z.string(),
  status: z
    .enum([
      'pending',
      'running',
      'audit_complete',
      'generating',
      'waiting_for_user',
      'review',
      'completed',
      'failed',
    ])
    .optional(),
  currentPhase: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  currentStep: z.string().optional(),
  selectedCmsId: z.string().optional(),
});

registry.register({
  name: 'pitchRun.update',
  description: 'Update a pitch run status, progress, or phase',
  category: 'pitch-run',
  inputSchema: updatePitchRunInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(pitchRuns)
      .where(and(eq(pitchRuns.id, input.id), eq(pitchRuns.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pitch run not found or no access' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.status !== undefined) {
      updateData.status = input.status;
      // Auto-set timestamps
      if (input.status === 'running' && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (input.status === 'completed' || input.status === 'failed') {
        updateData.completedAt = new Date();
      }
    }
    if (input.currentPhase !== undefined) updateData.currentPhase = input.currentPhase;
    if (input.progress !== undefined) updateData.progress = input.progress;
    if (input.currentStep !== undefined) updateData.currentStep = input.currentStep;
    if (input.selectedCmsId !== undefined) updateData.selectedCmsId = input.selectedCmsId;

    const [updated] = await db
      .update(pitchRuns)
      .set(updateData)
      .where(eq(pitchRuns.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

// ============================================================================
// pitchRun.cancel - Cancel a running pitch run
// ============================================================================

const cancelPitchRunInputSchema = z.object({
  id: z.string(),
  reason: z.string().optional(),
});

registry.register({
  name: 'pitchRun.cancel',
  description: 'Cancel a running pitch run and mark it as failed',
  category: 'pitch-run',
  inputSchema: cancelPitchRunInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(pitchRuns)
      .where(and(eq(pitchRuns.id, input.id), eq(pitchRuns.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Pitch run not found or no access' };
    }

    if (existing.status === 'completed') {
      return { success: false, error: 'Cannot cancel a completed run' };
    }

    if (existing.status === 'failed') {
      return { success: false, error: 'Run is already failed/cancelled' };
    }

    const [updated] = await db
      .update(pitchRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pitchRuns.id, input.id))
      .returning();

    return {
      success: true,
      data: {
        id: updated.id,
        status: 'failed',
        reason: input.reason || 'Cancelled by user',
      },
    };
  },
});

// ============================================================================
// pitchRun.getLatest - Get the latest pitch run for a lead
// ============================================================================

const getLatestPitchRunInputSchema = z.object({
  pitchId: z.string(),
});

registry.register({
  name: 'pitchRun.getLatest',
  description: 'Get the most recent pitch run for a lead',
  category: 'pitch-run',
  inputSchema: getLatestPitchRunInputSchema,
  async execute(input, context: ToolContext) {
    // Verify lead access
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.pitchId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only access runs for leads in their BU
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    const [run] = await db
      .select()
      .from(pitchRuns)
      .where(eq(pitchRuns.pitchId, input.pitchId))
      .orderBy(desc(pitchRuns.runNumber))
      .limit(1);

    if (!run) {
      return { success: false, error: 'No runs found for this lead' };
    }

    return { success: true, data: run };
  },
});

// ============================================================================
// pitchAuditResult.list - List audit results
// ============================================================================

const listAuditResultsInputSchema = z.object({
  runId: z.string().optional(),
  pitchId: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'pitchAuditResult.list',
  description: 'List audit results, filtered by run or pitch',
  category: 'pitch-run',
  inputSchema: listAuditResultsInputSchema,
  async execute(input, context: ToolContext) {
    // Build conditions
    const conditions = [];

    if (input.runId) {
      // Verify run access
      const [run] = await db
        .select()
        .from(pitchRuns)
        .where(and(eq(pitchRuns.id, input.runId), eq(pitchRuns.userId, context.userId)))
        .limit(1);

      if (!run) {
        return { success: false, error: 'Run not found or no access' };
      }
      conditions.push(eq(pitchAuditResults.runId, input.runId));
    }

    if (input.pitchId) {
      conditions.push(eq(pitchAuditResults.pitchId, input.pitchId));
    }

    // If no filters, return user's audit results via pitch runs
    if (conditions.length === 0) {
      const userRuns = await db
        .select({ id: pitchRuns.id })
        .from(pitchRuns)
        .where(eq(pitchRuns.userId, context.userId));

      const runIds = userRuns.map(r => r.id);
      if (runIds.length === 0) {
        return { success: true, data: [] };
      }

      const results = await db
        .select()
        .from(pitchAuditResults)
        .orderBy(desc(pitchAuditResults.createdAt))
        .limit(input.limit);

      // Filter to user's runs
      const filtered = results.filter(r => runIds.includes(r.runId));
      return { success: true, data: filtered };
    }

    const results = await db
      .select()
      .from(pitchAuditResults)
      .where(and(...conditions))
      .orderBy(desc(pitchAuditResults.createdAt))
      .limit(input.limit);

    return { success: true, data: results };
  },
});

// ============================================================================
// pitchAuditResult.get - Get a single audit result
// ============================================================================

const getAuditResultInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'pitchAuditResult.get',
  description: 'Get a single audit result by ID with full details',
  category: 'pitch-run',
  inputSchema: getAuditResultInputSchema,
  async execute(input, context: ToolContext) {
    const [result] = await db
      .select()
      .from(pitchAuditResults)
      .where(eq(pitchAuditResults.id, input.id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'Audit result not found' };
    }

    // Verify access via run
    const [run] = await db
      .select()
      .from(pitchRuns)
      .where(and(eq(pitchRuns.id, result.runId), eq(pitchRuns.userId, context.userId)))
      .limit(1);

    if (!run) {
      return { success: false, error: 'No access to this audit result' };
    }

    return { success: true, data: result };
  },
});

// ============================================================================
// pitchDocument.list - List documents for a run
// ============================================================================

const listDocumentsInputSchema = z.object({
  runId: z.string().optional(),
  pitchId: z.string().optional(),
  documentType: z.enum(['indication', 'calculation', 'presentation', 'proposal']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'pitchDocument.list',
  description: 'List generated documents for a pitch run',
  category: 'pitch-run',
  inputSchema: listDocumentsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.runId) {
      // Verify run access
      const [run] = await db
        .select()
        .from(pitchRuns)
        .where(and(eq(pitchRuns.id, input.runId), eq(pitchRuns.userId, context.userId)))
        .limit(1);

      if (!run) {
        return { success: false, error: 'Run not found or no access' };
      }
      conditions.push(eq(pitchDocuments.runId, input.runId));
    }

    if (input.pitchId) {
      conditions.push(eq(pitchDocuments.pitchId, input.pitchId));
    }

    if (input.documentType) {
      conditions.push(eq(pitchDocuments.documentType, input.documentType));
    }

    const documents = await db
      .select({
        id: pitchDocuments.id,
        runId: pitchDocuments.runId,
        pitchId: pitchDocuments.pitchId,
        documentType: pitchDocuments.documentType,
        format: pitchDocuments.format,
        cmsVariant: pitchDocuments.cmsVariant,
        technologyId: pitchDocuments.technologyId,
        fileName: pitchDocuments.fileName,
        fileSize: pitchDocuments.fileSize,
        confidence: pitchDocuments.confidence,
        flags: pitchDocuments.flags,
        generatedAt: pitchDocuments.generatedAt,
        createdAt: pitchDocuments.createdAt,
      })
      .from(pitchDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pitchDocuments.createdAt))
      .limit(input.limit);

    return { success: true, data: documents };
  },
});

// ============================================================================
// pitchDocument.get - Get a single document (without binary data)
// ============================================================================

const getDocumentInputSchema = z.object({
  id: z.string(),
  includeContent: z.boolean().default(false),
});

registry.register({
  name: 'pitchDocument.get',
  description:
    'Get a single document by ID. Set includeContent=true for HTML content (not binary).',
  category: 'pitch-run',
  inputSchema: getDocumentInputSchema,
  async execute(input, context: ToolContext) {
    // Select all fields except fileData (binary blob)
    const [doc] = await db
      .select({
        id: pitchDocuments.id,
        runId: pitchDocuments.runId,
        pitchId: pitchDocuments.pitchId,
        documentType: pitchDocuments.documentType,
        format: pitchDocuments.format,
        cmsVariant: pitchDocuments.cmsVariant,
        technologyId: pitchDocuments.technologyId,
        content: pitchDocuments.content,
        fileName: pitchDocuments.fileName,
        fileSize: pitchDocuments.fileSize,
        confidence: pitchDocuments.confidence,
        flags: pitchDocuments.flags,
        generatedAt: pitchDocuments.generatedAt,
        createdAt: pitchDocuments.createdAt,
      })
      .from(pitchDocuments)
      .where(eq(pitchDocuments.id, input.id))
      .limit(1);

    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    // Verify access via run
    const [run] = await db
      .select()
      .from(pitchRuns)
      .where(and(eq(pitchRuns.id, doc.runId), eq(pitchRuns.userId, context.userId)))
      .limit(1);

    if (!run) {
      return { success: false, error: 'No access to this document' };
    }

    // Optionally strip content if not requested
    const result = input.includeContent
      ? doc
      : { ...doc, content: doc.content ? '[content available]' : null };

    return { success: true, data: result };
  },
});
