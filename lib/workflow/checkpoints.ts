/**
 * Filesystem-based Checkpoint System
 *
 * Provides crash-resilient workflow state management by saving intermediate
 * states as JSON files. This complements Inngest's step functions with
 * explicit state persistence for debugging and recovery.
 *
 * Features:
 * - Save/Load workflow state at any point
 * - Resume from last checkpoint after crash
 * - Cleanup completed checkpoints
 * - Debug mode (keep checkpoints for inspection)
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

// Checkpoint directory (outside .gitignore)
const CHECKPOINT_DIR = process.env.CHECKPOINT_DIR || path.join(process.cwd(), 'tmp', 'checkpoints');

/**
 * Workflow State Schema
 * Generic schema that can hold any workflow-specific data
 */
export const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  workflowType: z.enum(['deep-analysis', 'bit-evaluation', 'team-staffing', 'extraction']),
  rfpId: z.string().optional(),
  userId: z.string(),
  status: z.enum(['pending', 'running', 'paused', 'completed', 'failed']),
  currentStep: z.string(),
  stepIndex: z.number().int().min(0),
  totalSteps: z.number().int().min(1),
  progress: z.number().min(0).max(100),
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
  data: z.record(z.string(), z.any()), // Workflow-specific data
  errors: z.array(z.object({
    step: z.string(),
    message: z.string(),
    timestamp: z.date(),
  })).optional(),
  version: z.number().int().default(1),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

/**
 * Deep Analysis Workflow State
 * Specific schema for deep-analysis workflows
 */
export const DeepAnalysisStateSchema = WorkflowStateSchema.extend({
  workflowType: z.literal('deep-analysis'),
  data: z.object({
    analysisId: z.string().optional(),
    websiteUrl: z.string().url(),
    sourceCMS: z.string().optional(),
    targetCMS: z.string().default('Drupal'),
    // Results from each agent step
    fullScanResult: z.any().optional(),
    contentArchitectureResult: z.any().optional(),
    migrationComplexityResult: z.any().optional(),
    accessibilityAuditResult: z.any().optional(),
    ptEstimationResult: z.any().optional(),
  }),
});

export type DeepAnalysisState = z.infer<typeof DeepAnalysisStateSchema>;

/**
 * Initialize checkpoint directory
 */
async function ensureCheckpointDir(): Promise<void> {
  try {
    await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
  } catch (error) {
    console.error('[Checkpoint] Failed to create checkpoint directory:', error);
    throw error;
  }
}

/**
 * Get checkpoint file path for a workflow
 */
function getCheckpointPath(workflowId: string): string {
  return path.join(CHECKPOINT_DIR, `${workflowId}.json`);
}

/**
 * Save workflow state to checkpoint file
 *
 * @param state - Current workflow state
 * @returns Promise<void>
 */
export async function saveCheckpoint(state: WorkflowState): Promise<void> {
  try {
    await ensureCheckpointDir();

    const checkpointPath = getCheckpointPath(state.workflowId);

    // Serialize dates as ISO strings for JSON
    const serialized = {
      ...state,
      startedAt: state.startedAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
      completedAt: state.completedAt?.toISOString(),
      errors: state.errors?.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
    };

    await fs.writeFile(
      checkpointPath,
      JSON.stringify(serialized, null, 2),
      'utf-8'
    );

    console.log(`[Checkpoint] Saved state for workflow ${state.workflowId} (step ${state.currentStep}, progress ${state.progress}%)`);
  } catch (error) {
    console.error('[Checkpoint] Failed to save checkpoint:', error);
    throw error;
  }
}

/**
 * Load workflow state from checkpoint file
 *
 * @param workflowId - Unique workflow identifier
 * @returns Promise<WorkflowState | null> - State if exists, null otherwise
 */
export async function loadCheckpoint(workflowId: string): Promise<WorkflowState | null> {
  try {
    const checkpointPath = getCheckpointPath(workflowId);

    // Check if file exists
    try {
      await fs.access(checkpointPath);
    } catch {
      return null; // File doesn't exist
    }

    const content = await fs.readFile(checkpointPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Deserialize dates
    const deserialized = {
      ...parsed,
      startedAt: new Date(parsed.startedAt),
      updatedAt: new Date(parsed.updatedAt),
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
      errors: parsed.errors?.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
    };

    // Validate against schema
    const state = WorkflowStateSchema.parse(deserialized);

    console.log(`[Checkpoint] Loaded state for workflow ${workflowId} (step ${state.currentStep}, progress ${state.progress}%)`);

    return state;
  } catch (error) {
    console.error('[Checkpoint] Failed to load checkpoint:', error);
    return null;
  }
}

/**
 * Resume workflow from last checkpoint
 * Returns the last checkpoint state if workflow is incomplete
 *
 * @param workflowId - Unique workflow identifier
 * @returns Promise<WorkflowState | null> - State to resume from, or null if no resume needed
 */
export async function resumeFromCheckpoint(workflowId: string): Promise<WorkflowState | null> {
  const state = await loadCheckpoint(workflowId);

  if (!state) {
    console.log(`[Checkpoint] No checkpoint found for workflow ${workflowId}`);
    return null;
  }

  // Only resume if workflow is not complete
  if (state.status === 'completed') {
    console.log(`[Checkpoint] Workflow ${workflowId} already completed, no resume needed`);
    return null;
  }

  if (state.status === 'failed') {
    console.log(`[Checkpoint] Workflow ${workflowId} previously failed, resuming from step ${state.currentStep}`);
  } else {
    console.log(`[Checkpoint] Resuming workflow ${workflowId} from step ${state.currentStep} (${state.progress}%)`);
  }

  return state;
}

/**
 * Delete checkpoint file
 *
 * @param workflowId - Unique workflow identifier
 * @param keepForDebug - If true, rename file instead of deleting (default: false)
 * @returns Promise<void>
 */
export async function cleanupCheckpoint(workflowId: string, keepForDebug: boolean = false): Promise<void> {
  try {
    const checkpointPath = getCheckpointPath(workflowId);

    // Check if file exists
    try {
      await fs.access(checkpointPath);
    } catch {
      return; // File doesn't exist, nothing to cleanup
    }

    if (keepForDebug) {
      // Rename to .completed or .debug suffix
      const debugPath = `${checkpointPath}.completed`;
      await fs.rename(checkpointPath, debugPath);
      console.log(`[Checkpoint] Kept checkpoint for debugging: ${debugPath}`);
    } else {
      await fs.unlink(checkpointPath);
      console.log(`[Checkpoint] Deleted checkpoint for workflow ${workflowId}`);
    }
  } catch (error) {
    console.error('[Checkpoint] Failed to cleanup checkpoint:', error);
    // Don't throw - cleanup failures shouldn't break the workflow
  }
}

/**
 * List all checkpoints (useful for debugging)
 *
 * @returns Promise<string[]> - Array of workflow IDs with checkpoints
 */
export async function listCheckpoints(): Promise<string[]> {
  try {
    await ensureCheckpointDir();

    const files = await fs.readdir(CHECKPOINT_DIR);

    // Filter .json files and extract workflow IDs
    const workflowIds = files
      .filter(f => f.endsWith('.json') && !f.endsWith('.completed'))
      .map(f => f.replace('.json', ''));

    return workflowIds;
  } catch (error) {
    console.error('[Checkpoint] Failed to list checkpoints:', error);
    return [];
  }
}

/**
 * Cleanup old checkpoints (completed > N days ago)
 *
 * @param daysOld - Delete checkpoints older than this many days
 * @returns Promise<number> - Number of checkpoints deleted
 */
export async function cleanupOldCheckpoints(daysOld: number = 7): Promise<number> {
  try {
    await ensureCheckpointDir();

    const files = await fs.readdir(CHECKPOINT_DIR);
    const now = Date.now();
    const cutoff = daysOld * 24 * 60 * 60 * 1000; // days to milliseconds

    let deleted = 0;

    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.completed')) {
        continue;
      }

      const filePath = path.join(CHECKPOINT_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > cutoff) {
        await fs.unlink(filePath);
        deleted++;
        console.log(`[Checkpoint] Deleted old checkpoint: ${file}`);
      }
    }

    console.log(`[Checkpoint] Cleaned up ${deleted} old checkpoint(s)`);
    return deleted;
  } catch (error) {
    console.error('[Checkpoint] Failed to cleanup old checkpoints:', error);
    return 0;
  }
}

/**
 * Create initial workflow state
 * Helper to create a new workflow state object
 */
export function createWorkflowState<T extends WorkflowState>(
  params: Omit<T, 'workflowId' | 'startedAt' | 'updatedAt' | 'version'> & { workflowId?: string }
): T {
  return {
    ...params,
    workflowId: params.workflowId || createId(),
    startedAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  } as T;
}

/**
 * Update workflow state helper
 * Updates progress, current step, and timestamp
 */
export function updateWorkflowState<T extends WorkflowState>(
  state: T,
  updates: Partial<Pick<T, 'status' | 'currentStep' | 'stepIndex' | 'progress' | 'data' | 'errors' | 'completedAt'>>
): T {
  return {
    ...state,
    ...updates,
    updatedAt: new Date(),
  } as T;
}
