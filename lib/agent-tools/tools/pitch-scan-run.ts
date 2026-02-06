import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import {
  auditScanRuns,
  pitchScanResults,
  pitchDocuments,
  pitches,
  technologies,
} from '@/lib/db/schema';

/**
 * PitchScanRun & PitchScanResult CRUD Tools
 *
 * PitchScanRun tracks scan/generation progress for Leads.
 * PitchScanResult stores website audit data from scans.
 *
 * These tools provide full CRUD access for agents to:
 * - Monitor scan progress
 * - Read audit results
 * - Update run status
 * - Access generated documents
 */

// ============================================================================
// pitchScanRun.create - Create a new audit scan run for a lead
// ============================================================================

const createPitchScanRunInputSchema = z.object({
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
  name: 'pitchScanRun.create',
  description:
    'Create a new audit scan run for a lead. Automatically resolves available CMS technologies from the business unit.',
  category: 'pitch-scan',
  inputSchema: createPitchScanRunInputSchema,
  async execute(input, context: ToolContext) {
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.pitchId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    const existingRuns = await db
      .select({ runNumber: auditScanRuns.runNumber })
      .from(auditScanRuns)
      .where(eq(auditScanRuns.pitchId, input.pitchId))
      .orderBy(desc(auditScanRuns.runNumber))
      .limit(1);

    const nextRunNumber = existingRuns.length > 0 ? existingRuns[0].runNumber + 1 : 1;

    let targetCmsIds = input.targetCmsIds;
    if (!targetCmsIds && lead.businessUnitId) {
      const availableCms = await db
        .select({ id: technologies.id })
        .from(technologies)
        .where(eq(technologies.businessUnitId, lead.businessUnitId));

      targetCmsIds = availableCms.map(c => c.id);
    }

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

    const [created] = await db
      .insert(auditScanRuns)
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
// pitchScanRun.list - List all audit scan runs
// ============================================================================

const listPitchScanRunsInputSchema = z.object({
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
  name: 'pitchScanRun.list',
  description: 'List all audit scan runs, optionally filtered by pitch or status',
  category: 'pitch-scan',
  inputSchema: listPitchScanRunsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [eq(auditScanRuns.userId, context.userId)];

    if (input.pitchId) {
      conditions.push(eq(auditScanRuns.pitchId, input.pitchId));
    }
    if (input.status) {
      conditions.push(eq(auditScanRuns.status, input.status));
    }

    const runs = await db
      .select()
      .from(auditScanRuns)
      .where(and(...conditions))
      .orderBy(desc(auditScanRuns.createdAt))
      .limit(input.limit);

    return { success: true, data: runs };
  },
});

// ============================================================================
// pitchScanRun.get - Get a single audit scan run by ID
// ============================================================================

const getPitchScanRunInputSchema = z.object({
  id: z.string(),
  includeAuditResults: z.boolean().default(false),
  includeDocuments: z.boolean().default(false),
});

registry.register({
  name: 'pitchScanRun.get',
  description: 'Get a single audit scan run by ID with optional audit results and documents',
  category: 'pitch-scan',
  inputSchema: getPitchScanRunInputSchema,
  async execute(input, context: ToolContext) {
    const [run] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.id, input.id), eq(auditScanRuns.userId, context.userId)))
      .limit(1);

    if (!run) {
      return { success: false, error: 'Audit scan run not found or no access' };
    }

    let auditResults = undefined;
    let documents = undefined;

    if (input.includeAuditResults) {
      auditResults = await db
        .select()
        .from(pitchScanResults)
        .where(eq(pitchScanResults.runId, input.id));
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
// pitchScanRun.update - Update an audit scan run
// ============================================================================

const updatePitchScanRunInputSchema = z.object({
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
  name: 'pitchScanRun.update',
  description: 'Update an audit scan run status, progress, or phase',
  category: 'pitch-scan',
  inputSchema: updatePitchScanRunInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.id, input.id), eq(auditScanRuns.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Audit scan run not found or no access' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.status !== undefined) {
      updateData.status = input.status;
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
      .update(auditScanRuns)
      .set(updateData)
      .where(eq(auditScanRuns.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

// ============================================================================
// pitchScanRun.cancel - Cancel a running audit scan run
// ============================================================================

const cancelPitchScanRunInputSchema = z.object({
  id: z.string(),
  reason: z.string().optional(),
});

registry.register({
  name: 'pitchScanRun.cancel',
  description: 'Cancel a running audit scan run and mark it as failed',
  category: 'pitch-scan',
  inputSchema: cancelPitchScanRunInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.id, input.id), eq(auditScanRuns.userId, context.userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Audit scan run not found or no access' };
    }

    if (existing.status === 'completed') {
      return { success: false, error: 'Cannot cancel a completed run' };
    }

    if (existing.status === 'failed') {
      return { success: false, error: 'Run is already failed/cancelled' };
    }

    const [updated] = await db
      .update(auditScanRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(auditScanRuns.id, input.id))
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
// pitchScanRun.get_latest - Get the latest audit scan run for a lead
// ============================================================================

const getLatestPitchScanRunInputSchema = z.object({
  pitchId: z.string(),
});

registry.register({
  name: 'pitchScanRun.get_latest',
  description: 'Get the most recent audit scan run for a lead',
  category: 'pitch-scan',
  inputSchema: getLatestPitchScanRunInputSchema,
  async execute(input, context: ToolContext) {
    const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.pitchId)).limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    const [run] = await db
      .select()
      .from(auditScanRuns)
      .where(eq(auditScanRuns.pitchId, input.pitchId))
      .orderBy(desc(auditScanRuns.runNumber))
      .limit(1);

    if (!run) {
      return { success: false, error: 'No runs found for this lead' };
    }

    return { success: true, data: run };
  },
});

// ============================================================================
// pitchScanResult.list - List audit scan results
// ============================================================================

const listPitchScanResultsInputSchema = z.object({
  runId: z.string().optional(),
  pitchId: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'pitchScanResult.list',
  description: 'List audit scan results, filtered by run or pitch',
  category: 'pitch-scan',
  inputSchema: listPitchScanResultsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.runId) {
      const [run] = await db
        .select()
        .from(auditScanRuns)
        .where(and(eq(auditScanRuns.id, input.runId), eq(auditScanRuns.userId, context.userId)))
        .limit(1);

      if (!run) {
        return { success: false, error: 'Run not found or no access' };
      }
      conditions.push(eq(pitchScanResults.runId, input.runId));
    }

    if (input.pitchId) {
      conditions.push(eq(pitchScanResults.pitchId, input.pitchId));
    }

    if (conditions.length === 0) {
      const userRuns = await db
        .select({ id: auditScanRuns.id })
        .from(auditScanRuns)
        .where(eq(auditScanRuns.userId, context.userId));

      const runIds = userRuns.map(r => r.id);
      if (runIds.length === 0) {
        return { success: true, data: [] };
      }

      const results = await db
        .select()
        .from(pitchScanResults)
        .where(inArray(pitchScanResults.runId, runIds))
        .orderBy(desc(pitchScanResults.createdAt))
        .limit(input.limit);

      return { success: true, data: results };
    }

    const results = await db
      .select()
      .from(pitchScanResults)
      .where(and(...conditions))
      .orderBy(desc(pitchScanResults.createdAt))
      .limit(input.limit);

    return { success: true, data: results };
  },
});

// ============================================================================
// pitchScanResult.get - Get a single audit scan result
// ============================================================================

const getPitchScanResultInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'pitchScanResult.get',
  description: 'Get a single audit scan result by ID with full details',
  category: 'pitch-scan',
  inputSchema: getPitchScanResultInputSchema,
  async execute(input, context: ToolContext) {
    const [result] = await db
      .select()
      .from(pitchScanResults)
      .where(eq(pitchScanResults.id, input.id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'Audit scan result not found' };
    }

    const [run] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.id, result.runId), eq(auditScanRuns.userId, context.userId)))
      .limit(1);

    if (!run) {
      return { success: false, error: 'No access to this audit scan result' };
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
  description: 'List generated documents for an audit scan run',
  category: 'pitch-scan',
  inputSchema: listDocumentsInputSchema,
  async execute(input, context: ToolContext) {
    const conditions = [];

    if (input.runId) {
      const [run] = await db
        .select()
        .from(auditScanRuns)
        .where(and(eq(auditScanRuns.id, input.runId), eq(auditScanRuns.userId, context.userId)))
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
  category: 'pitch-scan',
  inputSchema: getDocumentInputSchema,
  async execute(input, context: ToolContext) {
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

    const [run] = await db
      .select()
      .from(auditScanRuns)
      .where(and(eq(auditScanRuns.id, doc.runId), eq(auditScanRuns.userId, context.userId)))
      .limit(1);

    if (!run) {
      return { success: false, error: 'No access to this document' };
    }

    const result = input.includeContent
      ? doc
      : { ...doc, content: doc.content ? '[content available]' : null };

    return { success: true, data: result };
  },
});
