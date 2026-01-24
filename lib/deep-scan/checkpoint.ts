/**
 * Deep Scan Checkpoint Utilities
 *
 * Enables robust resume functionality for the Deep Scan Agent:
 * - Saves progress after each expert completes
 * - Allows resume after crashes or timeouts
 * - Tracks current phase and completed experts
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { qualifications } from '@/lib/db/schema';

export type DeepScanPhase = 'scraping' | 'phase2' | 'phase3';

export interface CheckpointState {
  currentPhase: DeepScanPhase | null;
  completedExperts: string[];
  lastCheckpoint: Date | null;
  lastError: string | null;
}

/**
 * Get the current checkpoint state for a lead
 */
export async function getCheckpointState(leadId: string): Promise<CheckpointState> {
  const [lead] = await db
    .select({
      currentPhase: qualifications.deepScanCurrentPhase,
      completedExperts: qualifications.deepScanCompletedExperts,
      lastCheckpoint: qualifications.deepScanLastCheckpoint,
      lastError: qualifications.deepScanError,
    })
    .from(qualifications)
    .where(eq(qualifications.id, leadId))
    .limit(1);

  if (!lead) {
    return {
      currentPhase: null,
      completedExperts: [],
      lastCheckpoint: null,
      lastError: null,
    };
  }

  return {
    currentPhase: lead.currentPhase as DeepScanPhase | null,
    completedExperts: lead.completedExperts ? JSON.parse(lead.completedExperts) : [],
    lastCheckpoint: lead.lastCheckpoint,
    lastError: lead.lastError,
  };
}

/**
 * Get list of completed experts for a lead
 */
export async function getCompletedExperts(leadId: string): Promise<string[]> {
  const state = await getCheckpointState(leadId);
  return state.completedExperts;
}

/**
 * Save checkpoint after an expert completes
 */
export async function saveCheckpoint(
  leadId: string,
  expertName: string,
  success: boolean,
  phase: DeepScanPhase
): Promise<void> {
  const state = await getCheckpointState(leadId);
  const completed = [...state.completedExperts];

  // Only add to completed if successful and not already in list
  if (success && !completed.includes(expertName)) {
    completed.push(expertName);
  }

  await db
    .update(qualifications)
    .set({
      deepScanCurrentPhase: phase,
      deepScanCompletedExperts: JSON.stringify(completed),
      deepScanLastCheckpoint: new Date(),
      deepScanError: null, // Clear error on successful checkpoint
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Save an error state (for debugging and retry logic)
 */
export async function saveError(
  leadId: string,
  errorMessage: string,
  phase: DeepScanPhase
): Promise<void> {
  await db
    .update(qualifications)
    .set({
      deepScanCurrentPhase: phase,
      deepScanError: errorMessage,
      deepScanLastCheckpoint: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Reset all checkpoints for a fresh start
 */
export async function resetCheckpoints(leadId: string): Promise<void> {
  await db
    .update(qualifications)
    .set({
      deepScanCurrentPhase: null,
      deepScanCompletedExperts: null,
      deepScanLastCheckpoint: null,
      deepScanError: null,
      deepScanStatus: 'pending',
      deepScanStartedAt: null,
      deepScanCompletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Mark deep scan as started
 */
export async function markDeepScanStarted(leadId: string): Promise<void> {
  await db
    .update(qualifications)
    .set({
      deepScanStatus: 'running',
      deepScanStartedAt: new Date(),
      deepScanCurrentPhase: 'scraping',
      deepScanError: null,
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Mark deep scan as completed
 */
export async function markDeepScanCompleted(
  leadId: string,
  success: boolean,
  error?: string
): Promise<void> {
  await db
    .update(qualifications)
    .set({
      deepScanStatus: success ? 'completed' : 'failed',
      deepScanCompletedAt: new Date(),
      deepScanError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(qualifications.id, leadId));
}

/**
 * Check if we should resume from a previous run
 */
export async function shouldResume(leadId: string): Promise<{
  shouldResume: boolean;
  phase: DeepScanPhase | null;
  completedExperts: string[];
}> {
  const state = await getCheckpointState(leadId);

  // Resume if we have completed experts but scan is not done
  const [lead] = await db
    .select({ status: qualifications.deepScanStatus })
    .from(qualifications)
    .where(eq(qualifications.id, leadId))
    .limit(1);

  const shouldResumeFromCheckpoint =
    state.completedExperts.length > 0 &&
    lead?.status !== 'completed' &&
    state.currentPhase !== null;

  return {
    shouldResume: shouldResumeFromCheckpoint,
    phase: state.currentPhase,
    completedExperts: state.completedExperts,
  };
}
