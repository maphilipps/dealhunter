import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { backgroundJobs, pitches, preQualifications } from '@/lib/db/schema';

/**
 * Sprint 4.1: Workflow Orchestration Tools
 *
 * Tools for managing background jobs (Team Notification, etc.)
 * Provides full lifecycle: cancel, status, list, retry
 */

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
        .select({ lead: pitches, preQualification: preQualifications })
        .from(pitches)
        .innerJoin(preQualifications, eq(pitches.preQualificationId, preQualifications.id))
        .where(and(eq(pitches.id, input.leadId), eq(preQualifications.userId, context.userId)))
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
      const [lead] = await db.select().from(pitches).where(eq(pitches.id, input.leadId)).limit(1);
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
