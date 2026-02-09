// lib/pitch/processor.ts
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { pitches } from '@/lib/db/schema';
import { runDynamicOrchestrator } from '@/lib/pitch-scan/orchestrator';
import type { EventEmitter } from '@/lib/streaming/event-emitter';

import type { PitchJobData, PitchJobResult } from './types';
import { updateRunStatus } from './checkpoints';
import { publishToChannel, closeProgressPublisher } from './tools/progress-tool';

/**
 * Create an EventEmitter that forwards events to Redis pub/sub.
 * This allows the /progress SSE endpoint to relay them to the browser.
 */
function createRedisEmitter(runId: string): EventEmitter {
  return event => {
    void publishToChannel(runId, event);
  };
}

export async function processPitchJob(
  job: Job<PitchJobData, PitchJobResult>
): Promise<PitchJobResult> {
  const { runId, pitchId, websiteUrl, targetCmsIds } = job.data;
  console.log(`[Pitch] Processing job ${job.id} for run ${runId}`);

  try {
    await updateRunStatus(runId, 'running', { progress: 5, currentStep: 'Starte Pitch Scan...' });
    await job.updateProgress(5);

    // Fetch pitch details for planning context
    const [pitch] = await db
      .select({ customerName: pitches.customerName, websiteUrl: pitches.websiteUrl })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    const emit = createRedisEmitter(runId);

    const result = await runDynamicOrchestrator(
      {
        runId,
        pitchId,
        websiteUrl: websiteUrl || pitch?.websiteUrl || '',
        targetCmsIds,
        planningContext: {
          customerName: pitch?.customerName ?? undefined,
          websiteUrl: websiteUrl || pitch?.websiteUrl || undefined,
        },
      },
      emit
    );

    await updateRunStatus(runId, 'completed', {
      progress: 100,
      currentStep: 'Pitch Scan abgeschlossen',
      completedAt: new Date(),
    });
    await job.updateProgress(100);
    console.log(
      `[Pitch] Job ${job.id} completed — phases=${result.completedPhases.length}/${result.completedPhases.length + result.failedPhases.length}`
    );

    // Transition pitch status so the page shows results instead of restarting
    await db
      .update(pitches)
      .set({ status: 'bl_reviewing', updatedAt: new Date() })
      .where(eq(pitches.id, pitchId));

    return {
      success: true,
      phase: 'complete',
      completedAgents: result.completedPhases,
      failedAgents: result.failedPhases,
      generatedDocuments: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Pitch] Job ${job.id} for run ${runId} failed:`, error);

    await updateRunStatus(runId, 'failed', { currentStep: `Fehler: ${message.slice(0, 200)}` });

    return {
      success: false,
      phase: 'audit',
      completedAgents: [],
      failedAgents: [],
      generatedDocuments: [],
      error: message,
    };
  } finally {
    await closeProgressPublisher();
  }
}
