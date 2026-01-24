/**
 * Checkpoint Cleanup Cron Job
 *
 * Runs daily to clean up old checkpoint files (>7 days)
 * Prevents filesystem bloat from completed/failed workflows
 */

import { inngest } from '../client';

import { cleanupOldCheckpoints } from '@/lib/workflow/checkpoints';

export const checkpointCleanupFunction = inngest.createFunction(
  {
    id: 'checkpoint-cleanup',
    name: 'Checkpoint Cleanup',
    retries: 0, // No retries needed for cleanup
  },
  {
    cron: '0 3 * * *', // Run daily at 3 AM
  },
  async () => {
    try {
      const daysOld = parseInt(process.env.CHECKPOINT_RETENTION_DAYS || '7', 10);
      const deletedCount = await cleanupOldCheckpoints(daysOld);

      return {
        success: true,
        deletedCount,
        daysOld,
        message: `Cleaned up ${deletedCount} checkpoint(s) older than ${daysOld} days`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Inngest] Checkpoint cleanup failed:', errorMessage);

      return {
        success: false,
        deletedCount: 0,
        error: errorMessage,
      };
    }
  }
);
