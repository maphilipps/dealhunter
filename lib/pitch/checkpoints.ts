import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditScanRuns } from '@/lib/db/schema';
import type { OrchestratorCheckpoint, PitchStatus, SnapshotEvent } from './types';
import { publishToChannel } from './tools/progress-tool';

export async function saveCheckpoint(
  runId: string,
  checkpoint: OrchestratorCheckpoint
): Promise<void> {
  await db
    .update(auditScanRuns)
    .set({
      snapshotData: JSON.stringify(checkpoint),
      currentPhase: checkpoint.phase,
      completedAgents: JSON.stringify(checkpoint.completedAgents),
      status: checkpoint.pendingQuestion ? 'waiting_for_user' : 'running',
      updatedAt: new Date(),
    })
    .where(eq(auditScanRuns.id, runId));
}

export async function loadCheckpoint(runId: string): Promise<OrchestratorCheckpoint | null> {
  const [run] = await db
    .select({
      snapshotData: auditScanRuns.snapshotData,
    })
    .from(auditScanRuns)
    .where(eq(auditScanRuns.id, runId))
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
    .update(auditScanRuns)
    .set({
      status,
      ...(extra?.progress !== undefined && { progress: extra.progress }),
      ...(extra?.currentStep !== undefined && { currentStep: extra.currentStep }),
      ...(extra?.completedAt && { completedAt: extra.completedAt }),
      updatedAt: new Date(),
    })
    .where(eq(auditScanRuns.id, runId));
}

// Note: markAgentComplete and markAgentFailed use atomic SQL JSON operations
// to avoid read-modify-write race conditions when agents complete concurrently.

export async function markAgentComplete(
  runId: string,
  agentName: string,
  confidence: number
): Promise<void> {
  // Atomic append + RETURNING to avoid read-after-write race
  const rows = await db.execute<typeof auditScanRuns.$inferSelect>(sql`
    UPDATE audit_scan_runs
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
    RETURNING *
  `);

  // Publish snapshot from the RETURNING row (no separate SELECT needed)
  const run = rows.rows?.[0];
  if (run) {
    await publishSnapshotSafe(runId, run);
  }
}

export async function markAgentFailed(runId: string, agentName: string): Promise<void> {
  // Atomic append + RETURNING to avoid read-after-write race
  const rows = await db.execute<typeof auditScanRuns.$inferSelect>(sql`
    UPDATE audit_scan_runs
    SET
      failed_agents = CASE
        WHEN failed_agents IS NULL THEN ${JSON.stringify([agentName])}
        WHEN failed_agents::jsonb ? ${agentName} THEN failed_agents
        ELSE (failed_agents::jsonb || ${JSON.stringify([agentName])}::jsonb)::text
      END,
      updated_at = NOW()
    WHERE id = ${runId}
    RETURNING *
  `);

  // Publish snapshot from the RETURNING row (no separate SELECT needed)
  const run = rows.rows?.[0];
  if (run) {
    await publishSnapshotSafe(runId, run);
  }
}

export function buildSnapshotEvent(run: typeof auditScanRuns.$inferSelect): SnapshotEvent {
  let completedAgents: string[] = [];
  let failedAgents: string[] = [];
  let agentConfidences: Record<string, number> = {};

  try {
    completedAgents = run.completedAgents ? JSON.parse(run.completedAgents) : [];
    failedAgents = run.failedAgents ? JSON.parse(run.failedAgents) : [];
    agentConfidences = run.agentConfidences ? JSON.parse(run.agentConfidences) : {};
  } catch (e) {
    console.error(`[Checkpoint] Malformed JSON in run ${run.id}:`, e);
  }

  return {
    type: 'snapshot',
    runId: run.id,
    status: run.status,
    progress: run.progress,
    currentPhase: run.currentPhase,
    currentStep: run.currentStep,
    completedAgents,
    failedAgents,
    agentConfidences,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    timestamp: new Date().toISOString(),
  };
}

async function publishSnapshotSafe(
  runId: string,
  run: typeof auditScanRuns.$inferSelect
): Promise<void> {
  try {
    await publishToChannel(runId, buildSnapshotEvent(run));
  } catch (error) {
    console.error(`[Checkpoint] Failed to publish snapshot for run ${runId}:`, error);
  }
}
