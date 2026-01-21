import { sql, lt } from 'drizzle-orm';

import { inngest } from '../client';

import { db } from '@/lib/db';
import { backgroundJobs } from '@/lib/db/schema';

/**
 * Cleanup Job - Deletes completed/failed jobs older than 7 days
 * Runs daily at 2 AM
 */
export const cleanupFunction = inngest.createFunction(
  {
    id: 'cleanup-old-jobs',
    name: 'Cleanup Old Jobs',
    retries: 1,
  },
  { cron: '0 2 * * *' }, // Daily at 2 AM
  async ({ step }) => {
    const deleted = await step.run('delete-old-jobs', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      console.log('[Cleanup] Deleting jobs older than:', sevenDaysAgo);

      // Delete completed, failed, and cancelled jobs older than 7 days
      const result = await db
        .delete(backgroundJobs)
        .where(
          sql`${backgroundJobs.completedAt} < ${sevenDaysAgo.getTime()} AND ${backgroundJobs.status} IN ('completed', 'failed', 'cancelled')`
        );

      // SQLite doesn't return rowsAffected, so we count before deletion
      // For now, we just log success
      console.log(
        '[Cleanup] Deleted old jobs (completed/failed/cancelled before',
        sevenDaysAgo,
        ')'
      );

      return {
        deletedCount: 0, // SQLite doesn't provide count
        cutoffDate: sevenDaysAgo,
      };
    });

    return {
      success: true,
      message: `Cleaned up ${deleted.deletedCount} old jobs`,
      deletedCount: deleted.deletedCount,
      cutoffDate: deleted.cutoffDate,
    };
  }
);
