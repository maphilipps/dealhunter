// lib/pitch/processor.ts
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { pitches } from '@/lib/db/schema';

import type { PitchJobData, PitchJobResult } from './types';
import { runOrchestrator } from './orchestrator';
import { closeProgressPublisher } from './tools/progress-tool';

export async function processPitchJob(
  job: Job<PitchJobData, PitchJobResult>
): Promise<PitchJobResult> {
  const { runId, pitchId } = job.data;
  console.log(`[Pitch] Processing job ${job.id} for run ${runId}`);

  try {
    await job.updateProgress(5);

    const result = await runOrchestrator(job.data);

    await job.updateProgress(100);
    console.log(
      `[Pitch] Job ${job.id} completed — phase=${result.phase}, agents=${result.completedAgents.length}`
    );

    // Transition pitch status so the page shows results instead of restarting
    if (result.success) {
      await db
        .update(pitches)
        .set({ status: 'bl_reviewing', updatedAt: new Date() })
        .where(eq(pitches.id, pitchId));
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Pitch] Job ${job.id} for run ${runId} failed:`, error);

    return {
      success: false,
      phase: 'audit', // Fallback — actual failure phase is tracked in DB via checkpoints
      completedAgents: [],
      failedAgents: [],
      generatedDocuments: [],
      error: message,
    };
  } finally {
    await closeProgressPublisher();
  }
}
