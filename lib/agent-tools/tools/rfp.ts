import { z } from 'zod';
import { db } from '@/lib/db';
import { rfps, documents, quickScans } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { registry } from '../registry';
import type { ToolContext } from '../types';

const listRfpsInputSchema = z.object({
  status: z.enum([
    'draft', 'extracting', 'reviewing', 'quick_scanning', 'evaluating',
    'decision_made', 'archived', 'routed', 'full_scanning', 'bl_reviewing',
    'team_assigned', 'notified', 'handed_off', 'analysis_complete'
  ]).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'rfp.list',
  description: 'List all RFPs/Bids for the current user, optionally filtered by status',
  category: 'rfp',
  inputSchema: listRfpsInputSchema,
  async execute(input, context: ToolContext) {
    let results;
    if (input.status) {
      results = await db.select().from(rfps)
        .where(and(eq(rfps.userId, context.userId), eq(rfps.status, input.status)))
        .orderBy(desc(rfps.createdAt))
        .limit(input.limit);
    } else {
      results = await db.select().from(rfps)
        .where(eq(rfps.userId, context.userId))
        .orderBy(desc(rfps.createdAt))
        .limit(input.limit);
    }
    
    return { success: true, data: results };
  },
});

const getRfpInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'rfp.get',
  description: 'Get a single RFP/Bid by ID',
  category: 'rfp',
  inputSchema: getRfpInputSchema,
  async execute(input, context: ToolContext) {
    const [rfp] = await db.select().from(rfps)
      .where(and(eq(rfps.id, input.id), eq(rfps.userId, context.userId)))
      .limit(1);
    
    if (!rfp) {
      return { success: false, error: 'RFP not found or no access' };
    }
    
    return { success: true, data: rfp };
  },
});

const createRfpInputSchema = z.object({
  source: z.enum(['reactive', 'proactive']),
  stage: z.enum(['cold', 'warm', 'rfp']),
  inputType: z.enum(['pdf', 'crm', 'freetext', 'email', 'combined']),
  rawInput: z.string().min(20),
  websiteUrl: z.string().url().optional(),
  accountId: z.string().optional(),
});

registry.register({
  name: 'rfp.create',
  description: 'Create a new RFP/Bid from text input',
  category: 'rfp',
  inputSchema: createRfpInputSchema,
  async execute(input, context: ToolContext) {
    const [rfp] = await db.insert(rfps).values({
      userId: context.userId,
      source: input.source,
      stage: input.stage,
      inputType: input.inputType,
      rawInput: input.rawInput,
      websiteUrl: input.websiteUrl,
      accountId: input.accountId,
      status: 'draft',
      decision: 'pending',
    }).returning();
    
    return { success: true, data: rfp };
  },
});

const updateRfpInputSchema = z.object({
  id: z.string(),
  status: z.enum([
    'draft', 'extracting', 'reviewing', 'quick_scanning', 'evaluating',
    'decision_made', 'archived', 'routed', 'full_scanning', 'bl_reviewing',
    'team_assigned', 'notified', 'handed_off', 'analysis_complete'
  ]).optional(),
  decision: z.enum(['bid', 'no_bid', 'pending']).optional(),
  extractedRequirements: z.record(z.string(), z.any()).optional(),
  websiteUrl: z.string().url().optional(),
  assignedBusinessUnitId: z.string().optional(),
});

registry.register({
  name: 'rfp.update',
  description: 'Update an existing RFP/Bid',
  category: 'rfp',
  inputSchema: updateRfpInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db.select().from(rfps)
      .where(and(eq(rfps.id, input.id), eq(rfps.userId, context.userId)))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'RFP not found or no access' };
    }
    
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status) updateData.status = input.status;
    if (input.decision) updateData.decision = input.decision;
    if (input.extractedRequirements) updateData.extractedRequirements = JSON.stringify(input.extractedRequirements);
    if (input.websiteUrl) updateData.websiteUrl = input.websiteUrl;
    if (input.assignedBusinessUnitId) updateData.assignedBusinessUnitId = input.assignedBusinessUnitId;
    
    const [updated] = await db.update(rfps)
      .set(updateData)
      .where(eq(rfps.id, input.id))
      .returning();
    
    return { success: true, data: updated };
  },
});

const deleteRfpInputSchema = z.object({
  id: z.string(),
});

registry.register({
  name: 'rfp.delete',
  description: 'Delete an RFP/Bid (archives it)',
  category: 'rfp',
  inputSchema: deleteRfpInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db.select().from(rfps)
      .where(and(eq(rfps.id, input.id), eq(rfps.userId, context.userId)))
      .limit(1);
    
    if (!existing) {
      return { success: false, error: 'RFP not found or no access' };
    }
    
    const [archived] = await db.update(rfps)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(rfps.id, input.id))
      .returning();
    
    return { success: true, data: { id: archived.id, status: 'archived' } };
  },
});

const getQuickScanInputSchema = z.object({
  rfpId: z.string(),
});

registry.register({
  name: 'rfp.getQuickScan',
  description: 'Get Quick Scan results for an RFP',
  category: 'rfp',
  inputSchema: getQuickScanInputSchema,
  async execute(input, context: ToolContext) {
    const [rfp] = await db.select().from(rfps)
      .where(and(eq(rfps.id, input.rfpId), eq(rfps.userId, context.userId)))
      .limit(1);
    
    if (!rfp) {
      return { success: false, error: 'RFP not found or no access' };
    }
    
    if (!rfp.quickScanId) {
      return { success: false, error: 'No Quick Scan for this RFP' };
    }
    
    const [scan] = await db.select().from(quickScans)
      .where(eq(quickScans.id, rfp.quickScanId))
      .limit(1);
    
    return { success: true, data: scan };
  },
});

const listDocumentsInputSchema = z.object({
  rfpId: z.string(),
});

registry.register({
  name: 'rfp.listDocuments',
  description: 'List all documents attached to an RFP',
  category: 'rfp',
  inputSchema: listDocumentsInputSchema,
  async execute(input, context: ToolContext) {
    const [rfp] = await db.select().from(rfps)
      .where(and(eq(rfps.id, input.rfpId), eq(rfps.userId, context.userId)))
      .limit(1);
    
    if (!rfp) {
      return { success: false, error: 'RFP not found or no access' };
    }
    
    const docs = await db.select({
      id: documents.id,
      fileName: documents.fileName,
      fileType: documents.fileType,
      fileSize: documents.fileSize,
      uploadSource: documents.uploadSource,
      uploadedAt: documents.uploadedAt,
    }).from(documents)
      .where(eq(documents.rfpId, input.rfpId))
      .orderBy(desc(documents.uploadedAt));
    
    return { success: true, data: docs };
  },
});
