import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { deepScanV2Runs } from '@/lib/db/schema';
import type { OrchestratorCheckpoint, DeepScanV2Status } from './types';

export async function saveCheckpoint(
  runId: string,
  checkpoint: OrchestratorCheckpoint
): Promise<void> {
  await db
    .update(deepScanV2Runs)
    .set({
      snapshotData: JSON.stringify(checkpoint),
      currentPhase: checkpoint.phase,
      completedAgents: JSON.stringify(checkpoint.completedAgents),
      status: checkpoint.pendingQuestion ? 'waiting_for_user' : 'running',
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}

export async function loadCheckpoint(runId: string): Promise<OrchestratorCheckpoint | null> {
  const [run] = await db
    .select({
      snapshotData: deepScanV2Runs.snapshotData,
    })
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, runId))
    .limit(1);

  if (!run?.snapshotData) return null;

  return JSON.parse(run.snapshotData) as OrchestratorCheckpoint;
}

export async function updateRunStatus(
  runId: string,
  status: DeepScanV2Status,
  extra?: {
    progress?: number;
    currentStep?: string;
    error?: string;
    completedAt?: Date;
  }
): Promise<void> {
  await db
    .update(deepScanV2Runs)
    .set({
      status,
      ...(extra?.progress !== undefined && { progress: extra.progress }),
      ...(extra?.currentStep && { currentStep: extra.currentStep }),
      ...(extra?.completedAt && { completedAt: extra.completedAt }),
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}

export async function markAgentComplete(
  runId: string,
  agentName: string,
  confidence: number
): Promise<void> {
  const [run] = await db
    .select({
      completedAgents: deepScanV2Runs.completedAgents,
      agentConfidences: deepScanV2Runs.agentConfidences,
    })
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, runId))
    .limit(1);

  const completed: string[] = run?.completedAgents ? JSON.parse(run.completedAgents) : [];
  const confidences: Record<string, number> = run?.agentConfidences
    ? JSON.parse(run.agentConfidences)
    : {};

  if (!completed.includes(agentName)) {
    completed.push(agentName);
  }
  confidences[agentName] = confidence;

  await db
    .update(deepScanV2Runs)
    .set({
      completedAgents: JSON.stringify(completed),
      agentConfidences: JSON.stringify(confidences),
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}

export async function markAgentFailed(runId: string, agentName: string): Promise<void> {
  const [run] = await db
    .select({
      failedAgents: deepScanV2Runs.failedAgents,
    })
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, runId))
    .limit(1);

  const failed: string[] = run?.failedAgents ? JSON.parse(run.failedAgents) : [];
  if (!failed.includes(agentName)) {
    failed.push(agentName);
  }

  await db
    .update(deepScanV2Runs)
    .set({
      failedAgents: JSON.stringify(failed),
      updatedAt: new Date(),
    })
    .where(eq(deepScanV2Runs.id, runId));
}
