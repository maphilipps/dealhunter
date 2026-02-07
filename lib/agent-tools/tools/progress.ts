import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';

import { registry } from '../registry';
import type { ToolContext } from '../types';

import { db } from '@/lib/db';
import { auditScanRuns, backgroundJobs, preQualifications } from '@/lib/db/schema';

/**
 * Progress tool — query scan and workflow progress
 *
 * Provides agent-readable access to the current state of
 * audit scan runs and background jobs for a given entity.
 */

const getProgressInputSchema = z.object({
  qualificationId: z.string().min(1),
  type: z.enum(['pitch-scan', 'background-job', 'all']).default('all'),
});

registry.register({
  name: 'progress.get',
  description: 'Get current scan/workflow progress for a qualification',
  category: 'progress',
  inputSchema: getProgressInputSchema,
  async execute(input, context: ToolContext) {
    const { qualificationId, type } = input;

    // Verify qualification exists and belongs to user
    const [qualification] = await db
      .select({ id: preQualifications.id, status: preQualifications.status })
      .from(preQualifications)
      .where(
        and(eq(preQualifications.id, qualificationId), eq(preQualifications.userId, context.userId))
      )
      .limit(1);

    if (!qualification) {
      return { success: false, error: 'Qualification not found' };
    }

    const result: Record<string, unknown> = {
      qualificationId,
      qualificationStatus: qualification.status,
    };

    // Audit scan runs (via pitch → auditScanRuns), scoped to user
    if (type === 'pitch-scan' || type === 'all') {
      const runs = await db
        .select({
          id: auditScanRuns.id,
          status: auditScanRuns.status,
          progress: auditScanRuns.progress,
          completedAgents: auditScanRuns.completedAgents,
          currentPhase: auditScanRuns.currentPhase,
          createdAt: auditScanRuns.createdAt,
          completedAt: auditScanRuns.completedAt,
        })
        .from(auditScanRuns)
        .where(eq(auditScanRuns.userId, context.userId))
        .orderBy(desc(auditScanRuns.createdAt))
        .limit(5);

      const activeRun = runs.find(r => r.status === 'running' || r.status === 'pending');
      const latestRun = runs[0];

      result.pitchScan = {
        activeRun: activeRun
          ? {
              id: activeRun.id,
              status: activeRun.status,
              progress: activeRun.progress,
              completedAgents: activeRun.completedAgents,
              currentPhase: activeRun.currentPhase,
            }
          : null,
        latestRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              progress: latestRun.progress,
              completedAt: latestRun.completedAt,
            }
          : null,
        totalRuns: runs.length,
      };
    }

    // Background jobs
    if (type === 'background-job' || type === 'all') {
      const jobs = await db
        .select({
          id: backgroundJobs.id,
          jobType: backgroundJobs.jobType,
          status: backgroundJobs.status,
          progress: backgroundJobs.progress,
          createdAt: backgroundJobs.createdAt,
          completedAt: backgroundJobs.completedAt,
          errorMessage: backgroundJobs.errorMessage,
        })
        .from(backgroundJobs)
        .where(and(eq(backgroundJobs.preQualificationId, qualificationId)))
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(10);

      const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');

      result.backgroundJobs = {
        active: activeJobs.map(j => ({
          id: j.id,
          jobType: j.jobType,
          status: j.status,
          progress: j.progress,
        })),
        recent: jobs.slice(0, 5).map(j => ({
          id: j.id,
          jobType: j.jobType,
          status: j.status,
          completedAt: j.completedAt,
          errorMessage: j.errorMessage,
        })),
        totalJobs: jobs.length,
      };
    }

    return { success: true, data: result };
  },
});
