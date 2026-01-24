import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { qualifications, qualificationSectionData, preQualifications } from '@/lib/db/schema';

// ===== Input Schemas =====

const listLeadsInputSchema = z.object({
  businessUnitId: z.string().optional(),
  status: z.enum(['routed', 'full_scanning', 'bl_reviewing', 'bid_voted', 'archived']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

const getLeadInputSchema = z.object({
  id: z.string(),
  includeSections: z.boolean().default(false),
});

const createLeadInputSchema = z.object({
  rfpId: z.string(),
  customerName: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  industry: z.string().optional(),
  projectDescription: z.string().optional(),
  budget: z.string().optional(),
  requirements: z.record(z.string(), z.any()).optional(),
  businessUnitId: z.string(),
  quickScanId: z.string().optional(),
});

const updateLeadInputSchema = z.object({
  id: z.string(),
  status: z.enum(['routed', 'full_scanning', 'bl_reviewing', 'bid_voted', 'archived']).optional(),
  customerName: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  industry: z.string().optional(),
  projectDescription: z.string().optional(),
  budget: z.string().optional(),
  requirements: z.record(z.string(), z.any()).optional(),
  selectedCmsId: z.string().optional(),
});

const deleteLeadInputSchema = z.object({
  id: z.string(),
});

const transitionStatusInputSchema = z.object({
  id: z.string(),
  targetStatus: z.enum(['routed', 'full_scanning', 'bl_reviewing', 'bid_voted', 'archived']),
  reason: z.string().optional(),
});

const triggerDeepScanInputSchema = z.object({
  id: z.string(),
  force: z.boolean().default(false), // Force restart even if already running
});

const requestMoreInfoInputSchema = z.object({
  id: z.string(),
  notes: z.string().min(1),
});

const submitBLVoteInputSchema = z.object({
  id: z.string(),
  vote: z.enum(['BID', 'NO-BID']),
  reasoning: z.string().min(1),
  confidenceScore: z.number().min(0).max(100),
});

const updateLeadSectionInputSchema = z.object({
  leadId: z.string(),
  sectionId: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(100).optional(),
  sources: z.array(z.any()).optional(),
});

const deleteLeadSectionInputSchema = z.object({
  leadId: z.string(),
  sectionId: z.string(),
});

// ===== Tool Implementations =====

registry.register({
  name: 'lead.list',
  description:
    'List all Leads for the current user, optionally filtered by business unit or status',
  category: 'lead',
  inputSchema: listLeadsInputSchema,
  async execute(input, context: ToolContext) {
    // BL users can only see leads from their own business unit
    const filterBusinessUnitId =
      context.userRole === 'bl' && context.businessUnitId
        ? context.businessUnitId
        : input.businessUnitId;

    let query = db
      .select()
      .from(qualifications)
      .orderBy(desc(qualifications.createdAt))
      .limit(input.limit);

    // Build WHERE conditions
    const conditions = [];
    if (filterBusinessUnitId) {
      conditions.push(eq(qualifications.businessUnitId, filterBusinessUnitId));
    }
    if (input.status) {
      conditions.push(eq(qualifications.status, input.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query;

    return { success: true, data: results };
  },
});

registry.register({
  name: 'lead.get',
  description: 'Get a single Lead by ID, optionally with section data',
  category: 'lead',
  inputSchema: getLeadInputSchema,
  async execute(input, context: ToolContext) {
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only access leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Fetch section data if requested
    let sections = undefined;
    if (input.includeSections) {
      sections = await db
        .select()
        .from(qualificationSectionData)
        .where(eq(qualificationSectionData.qualificationId, input.id));
    }

    return {
      success: true,
      data: {
        ...lead,
        sections,
      },
    };
  },
});

registry.register({
  name: 'lead.create',
  description: 'Create a new Lead from an existing RFP',
  category: 'lead',
  inputSchema: createLeadInputSchema,
  async execute(input, context: ToolContext) {
    // Verify RFP exists and is accessible
    const [rfp] = await db
      .select()
      .from(preQualifications)
      .where(
        and(eq(preQualifications.id, input.rfpId), eq(preQualifications.userId, context.userId))
      )
      .limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP not found or no access' };
    }

    // Verify RFP is in a state that allows Lead creation
    if (!['decision_made', 'bid_voted', 'routed'].includes(rfp.status)) {
      return {
        success: false,
        error: 'RFP must be in decision_made, bid_voted, or routed status to create a Lead',
      };
    }

    // Check if Lead already exists for this RFP
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.preQualificationId, input.rfpId))
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: 'Lead already exists for this RFP',
        data: { id: existing.id },
      };
    }

    // Create Lead
    const [lead] = await db
      .insert(qualifications)
      .values({
        preQualificationId: input.rfpId,
        customerName: input.customerName,
        websiteUrl: input.websiteUrl,
        industry: input.industry,
        projectDescription: input.projectDescription,
        budget: input.budget,
        requirements: input.requirements ? JSON.stringify(input.requirements) : undefined,
        businessUnitId: input.businessUnitId,
        quickScanId: input.quickScanId,
        status: 'routed',
      })
      .returning();

    return { success: true, data: lead };
  },
});

registry.register({
  name: 'lead.update',
  description: 'Update an existing Lead',
  category: 'lead',
  inputSchema: updateLeadInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only update leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      existing.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.status) updateData.status = input.status;
    if (input.customerName) updateData.customerName = input.customerName;
    if (input.websiteUrl) updateData.websiteUrl = input.websiteUrl;
    if (input.industry) updateData.industry = input.industry;
    if (input.projectDescription) updateData.projectDescription = input.projectDescription;
    if (input.budget) updateData.budget = input.budget;
    if (input.requirements) updateData.requirements = JSON.stringify(input.requirements);
    if (input.selectedCmsId) updateData.selectedCmsId = input.selectedCmsId;

    const [updated] = await db
      .update(qualifications)
      .set(updateData)
      .where(eq(qualifications.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

registry.register({
  name: 'lead.delete',
  description: 'Delete a Lead (soft-delete by archiving)',
  category: 'lead',
  inputSchema: deleteLeadInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only delete leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      existing.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    const [archived] = await db
      .update(qualifications)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(qualifications.id, input.id))
      .returning();

    return { success: true, data: { id: archived.id, status: 'archived' } };
  },
});

registry.register({
  name: 'lead.transitionStatus',
  description: 'Transition a Lead to a new status with validation',
  category: 'lead',
  inputSchema: transitionStatusInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only transition leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      existing.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Validate state transition
    const currentStatus = existing.status;
    const targetStatus = input.targetStatus;

    // Define valid state transitions
    const validTransitions: Record<string, string[]> = {
      routed: ['full_scanning', 'archived'],
      full_scanning: ['bl_reviewing', 'archived'],
      bl_reviewing: ['bid_voted', 'archived'],
      bid_voted: ['archived'],
      archived: [], // Cannot transition from archived
    };

    if (!validTransitions[currentStatus]?.includes(targetStatus)) {
      return {
        success: false,
        error: `Invalid status transition: ${currentStatus} -> ${targetStatus}`,
      };
    }

    const [updated] = await db
      .update(qualifications)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(eq(qualifications.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

registry.register({
  name: 'lead.triggerDeepScan',
  description: 'Trigger a Deep Scan for a Lead',
  category: 'lead',
  inputSchema: triggerDeepScanInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only trigger deep scan for leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      existing.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Check if Deep Scan is already running
    if (existing.deepScanStatus === 'running' && !input.force) {
      return { success: false, error: 'Deep Scan is already running. Use force=true to restart.' };
    }

    // Update Deep Scan status
    const [updated] = await db
      .update(qualifications)
      .set({
        deepScanStatus: 'running',
        deepScanStartedAt: new Date(),
        deepScanCompletedAt: null, // Clear completion timestamp
        deepScanError: null, // Clear previous errors
        status: 'full_scanning', // Transition to full_scanning status
        updatedAt: new Date(),
      })
      .where(eq(qualifications.id, input.id))
      .returning();

    // TODO: Trigger actual Deep Scan background job here
    // This would typically trigger an Inngest function or Workflow

    return { success: true, data: updated };
  },
});

registry.register({
  name: 'lead.requestMoreInfo',
  description: 'Mark a Lead as needing more information from BD',
  category: 'lead',
  inputSchema: requestMoreInfoInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only request more info for leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      existing.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    const [updated] = await db
      .update(qualifications)
      .set({
        moreInfoRequested: true,
        moreInfoRequestedAt: new Date(),
        moreInfoNotes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(qualifications.id, input.id))
      .returning();

    // TODO: Send notification to BD user (original RFP creator)
    // This would typically trigger a notification system

    return { success: true, data: updated };
  },
});

registry.register({
  name: 'lead.submitBLVote',
  description: 'Submit a BL BID/NO-BID vote for a Lead',
  category: 'lead',
  inputSchema: submitBLVoteInputSchema,
  async execute(input, context: ToolContext) {
    const [existing] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Lead not found' };
    }

    // Only BL users can vote
    if (context.userRole !== 'bl') {
      return { success: false, error: 'Only BL users can submit BID/NO-BID votes' };
    }

    // BL users can only vote on leads from their own business unit
    if (context.businessUnitId && existing.businessUnitId !== context.businessUnitId) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Update Lead with BL vote
    const [updated] = await db
      .update(qualifications)
      .set({
        blVote: input.vote,
        blVotedAt: new Date(),
        blVotedByUserId: context.userId,
        blReasoning: input.reasoning,
        blConfidenceScore: input.confidenceScore,
        status: input.vote === 'BID' ? 'bid_voted' : 'archived', // BID -> bid_voted, NO-BID -> archived
        updatedAt: new Date(),
      })
      .where(eq(qualifications.id, input.id))
      .returning();

    return { success: true, data: updated };
  },
});

registry.register({
  name: 'lead.updateSection',
  description: 'Update or create a Lead Section (upsert by leadId + sectionId)',
  category: 'lead',
  inputSchema: updateLeadSectionInputSchema,
  async execute(input, context: ToolContext) {
    // Verify Lead access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.leadId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only update sections for leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Check if section already exists
    const [existing] = await db
      .select()
      .from(qualificationSectionData)
      .where(
        and(
          eq(qualificationSectionData.qualificationId, input.leadId),
          eq(qualificationSectionData.sectionId, input.sectionId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing section
      const updateData: Record<string, unknown> = {
        content: input.content,
        updatedAt: new Date(),
      };
      if (input.confidence !== undefined) updateData.confidence = input.confidence;
      if (input.sources !== undefined) updateData.sources = JSON.stringify(input.sources);

      const [updated] = await db
        .update(qualificationSectionData)
        .set(updateData)
        .where(eq(qualificationSectionData.id, existing.id))
        .returning();

      return { success: true, data: updated, operation: 'updated' };
    } else {
      // Create new section
      const [created] = await db
        .insert(qualificationSectionData)
        .values({
          qualificationId: input.leadId,
          sectionId: input.sectionId,
          content: input.content,
          confidence: input.confidence || null,
          sources: input.sources ? JSON.stringify(input.sources) : null,
        })
        .returning();

      return { success: true, data: created, operation: 'created' };
    }
  },
});

registry.register({
  name: 'lead.deleteSection',
  description: 'Delete a Lead Section (hard delete)',
  category: 'lead',
  inputSchema: deleteLeadSectionInputSchema,
  async execute(input, context: ToolContext) {
    // Verify Lead access
    const [lead] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.id, input.leadId))
      .limit(1);

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // BL users can only delete sections for leads from their own business unit
    if (
      context.userRole === 'bl' &&
      context.businessUnitId &&
      lead.businessUnitId !== context.businessUnitId
    ) {
      return { success: false, error: 'Access denied: Lead belongs to different business unit' };
    }

    // Find and delete section
    const [existing] = await db
      .select()
      .from(qualificationSectionData)
      .where(
        and(
          eq(qualificationSectionData.qualificationId, input.leadId),
          eq(qualificationSectionData.sectionId, input.sectionId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Section not found' };
    }

    await db.delete(qualificationSectionData).where(eq(qualificationSectionData.id, existing.id));

    return {
      success: true,
      message: 'Lead Section deleted successfully',
      deletedId: existing.id,
    };
  },
});
