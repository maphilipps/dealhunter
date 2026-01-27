import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { backgroundJobs, qualifications, preQualifications } from '@/lib/db/schema';

/**
 * Sprint 4.1: Workflow Orchestration Tools
 *
 * Tools for managing background jobs (Deep Scan, Team Notification, etc.)
 * Provides full lifecycle: start, cancel, status, list, retry
 */

// ============================================================================
// workflow.startDeepScan
// ============================================================================

const startDeepScanInputSchema = z.object({
  leadId: z.string(),
});

registry.register({
  name: 'workflow.startDeepScan',
  description:
    'Start a Deep Scan background job for a lead. Creates job and updates lead status to running.',
  category: 'workflow',
  inputSchema: startDeepScanInputSchema,
  async execute(input, context: ToolContext) {
    // Get lead with preQualificationId (check authorization via preQualification.userId)
    const [leadData] = await db
      .select({ lead: qualifications, preQualification: preQualifications })
      .from(qualifications)
      .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
      .where(and(eq(qualifications.id, input.leadId), eq(preQualifications.userId, context.userId)))
      .limit(1);

    if (!leadData) {
      return { success: false, error: 'Lead not found or no access' };
    }

    const lead = leadData.lead;

    if (lead.deepScanStatus === 'running') {
      return { success: false, error: 'Deep Scan already running for this lead' };
    }

    if (lead.deepScanStatus === 'completed') {
      return {
        success: false,
        error: 'Deep Scan already completed. Use workflow.retryJob to re-run.',
      };
    }

    // Create background job
    const [job] = await db
      .insert(backgroundJobs)
      .values({
        jobType: 'deep-analysis',
        preQualificationId: lead.preQualificationId,
        userId: context.userId,
        status: 'pending',
        progress: 0,
        currentStep: 'Initializing Deep Scan',
      })
      .returning();

    // Update lead status
    await db
      .update(qualifications)
      .set({
        deepScanStatus: 'running',
        deepScanStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(qualifications.id, input.leadId));

    return {
      success: true,
      data: {
        jobId: job.id,
        leadId: input.leadId,
        status: job.status,
        message: 'Deep Scan job created successfully',
      },
    };
  },
});

// ============================================================================
// workflow.cancelJob
// ============================================================================

const cancelJobInputSchema = z.object({
  jobId: z.string(),
});

registry.register({
  name: 'workflow.cancelJob',
  description: 'Cancel a running background job. Updates job and lead status.',
  category: 'workflow',
  inputSchema: cancelJobInputSchema,
  async execute(input, context: ToolContext) {
    // Get job
    const [job] = await db
      .select()
      .from(backgroundJobs)
      .where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.userId, context.userId)))
      .limit(1);

    if (!job) {
      return { success: false, error: 'Job not found or no access' };
    }

    if (job.status === 'completed') {
      return { success: false, error: 'Cannot cancel completed job' };
    }

    if (job.status === 'cancelled') {
      return { success: false, error: 'Job already cancelled' };
    }

    // Update job status
    await db
      .update(backgroundJobs)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, input.jobId));

    // If Deep Analysis job, update lead status
    if (job.jobType === 'deep-analysis' && job.preQualificationId) {
      // Find lead by preQualificationId
      const [lead] = await db
        .select()
        .from(qualifications)
        .where(eq(qualifications.preQualificationId, job.preQualificationId))
        .limit(1);

      if (lead) {
        await db
          .update(qualifications)
          .set({
            deepScanStatus: 'failed',
            deepScanError: 'Job cancelled by user',
            updatedAt: new Date(),
          })
          .where(eq(qualifications.id, lead.id));
      }
    }

    return {
      success: true,
      data: {
        jobId: input.jobId,
        status: 'cancelled',
        message: 'Job cancelled successfully',
      },
    };
  },
});

// ============================================================================
// workflow.getJobStatus
// ============================================================================

const getJobStatusInputSchema = z.object({
  jobId: z.string(),
});

registry.register({
  name: 'workflow.getJobStatus',
  description:
    'Get detailed status of a background job. Returns progress, current step, and result.',
  category: 'workflow',
  inputSchema: getJobStatusInputSchema,
  async execute(input, context: ToolContext) {
    const [job] = await db
      .select()
      .from(backgroundJobs)
      .where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.userId, context.userId)))
      .limit(1);

    if (!job) {
      return { success: false, error: 'Job not found or no access' };
    }

    return {
      success: true,
      data: {
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        result: job.result ? JSON.parse(job.result) : null,
        errorMessage: job.errorMessage,
        attemptNumber: job.attemptNumber,
        maxAttempts: job.maxAttempts,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
    };
  },
});

// ============================================================================
// workflow.listJobs
// ============================================================================

const listJobsInputSchema = z.object({
  leadId: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  jobType: z.enum(['qualification', 'deep-analysis', 'team-notification', 'cleanup']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

registry.register({
  name: 'workflow.listJobs',
  description:
    'List all background jobs for a lead or user. Filter by status, job type. Sorted by creation date.',
  category: 'workflow',
  inputSchema: listJobsInputSchema,
  async execute(input, context: ToolContext) {
    let query = db.select().from(backgroundJobs).where(eq(backgroundJobs.userId, context.userId));

    // Filter by leadId (via preQualificationId, authorize via preQualification.userId)
    if (input.leadId) {
      const [leadData] = await db
        .select({ lead: qualifications, preQualification: preQualifications })
        .from(qualifications)
        .innerJoin(preQualifications, eq(qualifications.preQualificationId, preQualifications.id))
        .where(
          and(eq(qualifications.id, input.leadId), eq(preQualifications.userId, context.userId))
        )
        .limit(1);

      if (!leadData) {
        return { success: false, error: 'Lead not found or no access' };
      }

      const _lead = leadData.lead;

      query = db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.userId, context.userId),
            eq(backgroundJobs.preQualificationId, _lead.preQualificationId)
          )
        );
    }

    // Apply additional filters
    const conditions = [eq(backgroundJobs.userId, context.userId)];

    if (input.leadId) {
      const [lead] = await db
        .select()
        .from(qualifications)
        .where(eq(qualifications.id, input.leadId))
        .limit(1);
      if (lead?.preQualificationId) {
        conditions.push(eq(backgroundJobs.preQualificationId, lead.preQualificationId));
      }
    }

    if (input.status) {
      conditions.push(eq(backgroundJobs.status, input.status));
    }

    if (input.jobType) {
      conditions.push(eq(backgroundJobs.jobType, input.jobType));
    }

    const jobs = await db
      .select()
      .from(backgroundJobs)
      .where(and(...conditions))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(input.limit);

    return { success: true, data: jobs };
  },
});

// ============================================================================
// workflow.retryJob
// ============================================================================

const retryJobInputSchema = z.object({
  jobId: z.string(),
});

registry.register({
  name: 'workflow.retryJob',
  description:
    'Retry a failed background job. Increments attempt counter and resets status to pending.',
  category: 'workflow',
  inputSchema: retryJobInputSchema,
  async execute(input, context: ToolContext) {
    // Get job
    const [job] = await db
      .select()
      .from(backgroundJobs)
      .where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.userId, context.userId)))
      .limit(1);

    if (!job) {
      return { success: false, error: 'Job not found or no access' };
    }

    if (job.status === 'running' || job.status === 'pending') {
      return { success: false, error: 'Cannot retry job that is still pending or running' };
    }

    // Check max attempts
    if (job.attemptNumber >= job.maxAttempts) {
      return {
        success: false,
        error: `Max retry attempts (${job.maxAttempts}) reached`,
      };
    }

    // Reset job status
    await db
      .update(backgroundJobs)
      .set({
        status: 'pending',
        attemptNumber: job.attemptNumber + 1,
        errorMessage: null,
        progress: 0,
        currentStep: 'Retrying job',
        updatedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, input.jobId));

    // If Deep Analysis job, update lead status
    if (job.jobType === 'deep-analysis' && job.preQualificationId) {
      const [lead] = await db
        .select()
        .from(qualifications)
        .where(eq(qualifications.preQualificationId, job.preQualificationId))
        .limit(1);

      if (lead) {
        await db
          .update(qualifications)
          .set({
            deepScanStatus: 'pending',
            deepScanError: null,
            updatedAt: new Date(),
          })
          .where(eq(qualifications.id, lead.id));
      }
    }

    return {
      success: true,
      data: {
        jobId: input.jobId,
        attemptNumber: job.attemptNumber + 1,
        maxAttempts: job.maxAttempts,
        status: 'pending',
        message: 'Job queued for retry',
      },
    };
  },
});
