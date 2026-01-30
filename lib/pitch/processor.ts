import type { Job } from 'bullmq';

import type { PitchJobData, PitchJobResult } from './types';

export async function processPitchJob(
  job: Job<PitchJobData, PitchJobResult>
): Promise<PitchJobResult> {
  console.log(`[Pitch] Processing job ${job.id} for run ${job.data.runId}`);

  // TODO: Wire up orchestrator in Task 13
  return {
    success: true,
    phase: 'complete',
    completedAgents: [],
    failedAgents: [],
    generatedDocuments: [],
  };
}
