import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { pitchRuns } from '@/lib/db/schema';
import type { OrchestratorCheckpoint, PitchStatus } from './types';

export async function saveCheckpoint(
  runId: string,
  checkpoint: OrchestratorCheckpoint
): Promise<void> {
  await db
    .update(pitchRuns)
    .set({
      snapshotData: JSON.stringify(checkpoint),
      currentPhase: checkpoint.phase,
      completedAgents: JSON.stringify(checkpoint.completedAgents),
      status: checkpoint.pendingQuestion ? 'waiting_for_user' : 'running',
      updatedAt: new Date(),
    })
    .where(eq(pitchRuns.id, runId));
}

export async function loadCheckpoint(runId: string): Promise<OrchestratorCheckpoint | null> {
  const [run] = await db
    .select({
      snapshotData: pitchRuns.snapshotData,
    })
    .from(pitchRuns)
    .where(eq(pitchRuns.id, runId))
    .limit(1);

  if (!run?.snapshotData) return null;

  try {
    return JSON.parse(run.snapshotData) as OrchestratorCheckpoint;
  } catch (e) {
    console.error(`[Checkpoint] Failed to parse snapshot for run ${runId}:`, e);
    return null;
  }
}

export async function updateRunStatus(
  runId: string,
  status: PitchStatus,
  extra?: {
    progress?: number;
    currentStep?: string;
    completedAt?: Date;
  }
): Promise<void> {
  await db
    .update(pitchRuns)
    .set({
      status,
      ...(extra?.progress !== undefined && { progress: extra.progress }),
      ...(extra?.currentStep !== undefined && { currentStep: extra.currentStep }),
      ...(extra?.completedAt && { completedAt: extra.completedAt }),
      updatedAt: new Date(),
    })
    .where(eq(pitchRuns.id, runId));
}

// Note: markAgentComplete and markAgentFailed use atomic SQL JSON operations
// to avoid read-modify-write race conditions when agents complete concurrently.

export async function markAgentComplete(
  runId: string,
  agentName: string,
  confidence: number
): Promise<void> {
  // Atomic append to JSON array + merge confidence, no read-modify-write
  await db.execute(sql`
    UPDATE pitch_runs
    SET
      completed_agents = CASE
        WHEN completed_agents IS NULL THEN ${JSON.stringify([agentName])}
        WHEN completed_agents::jsonb ? ${agentName} THEN completed_agents
        ELSE (completed_agents::jsonb || ${JSON.stringify([agentName])}::jsonb)::text
      END,
      agent_confidences = CASE
        WHEN agent_confidences IS NULL THEN ${JSON.stringify({ [agentName]: confidence })}
        ELSE (agent_confidences::jsonb || ${JSON.stringify({ [agentName]: confidence })}::jsonb)::text
      END,
      updated_at = NOW()
    WHERE id = ${runId}
  `);
}

export async function markAgentFailed(runId: string, agentName: string): Promise<void> {
  // Atomic append to JSON array, no read-modify-write
  await db.execute(sql`
    UPDATE pitch_runs
    SET
      failed_agents = CASE
        WHEN failed_agents IS NULL THEN ${JSON.stringify([agentName])}
        WHEN failed_agents::jsonb ? ${agentName} THEN failed_agents
        ELSE (failed_agents::jsonb || ${JSON.stringify([agentName])}::jsonb)::text
      END,
      updated_at = NOW()
    WHERE id = ${runId}
  `);
}
