/**
 * Server Actions for Error Handling
 *
 * Implements user-initiated error recovery actions:
 * - retryAgent: Retry a failed agent
 * - skipAgent: Skip an optional agent (QuickScan, Timeline)
 * - switchToManualMode: Activate manual extraction mode
 * - resolveAgentError: Mark an error as resolved
 */

'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '../db';
import { type AgentError, type AgentName, getSkipStatus, canSkipAgent } from './agent-wrapper';
import { preQualifications, type PreQualification } from '../db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retry a failed agent
 *
 * Resets the agent's error state and re-triggers the agent with the same inputs.
 *
 * @param preQualificationId - Pre-Qualification ID
 * @param agentName - Name of the agent to retry
 * @returns Updated Pre-Qualification with new status
 */
export async function retryAgent(
  preQualificationId: string,
  agentName: AgentName
): Promise<{ success: boolean; preQualification?: PreQualification; error?: string }> {
  try {
    // Fetch current PreQualification
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'PreQualification not found' };
    }

    // Parse agent errors
    const agentErrors: AgentError[] = preQualification.agentErrors
      ? (JSON.parse(preQualification.agentErrors) as AgentError[])
      : [];

    // Find error for this agent
    const agentError = agentErrors.find(e => e.agentName === agentName && !e.isResolved);

    if (!agentError) {
      return { success: false, error: `Agent ${agentName} is not in failed state` };
    }

    // Remove error from list (will be re-added if fails again)
    const updatedErrors = agentErrors.filter(e => e.id !== agentError.id);

    // Determine new status based on agent
    const newStatus = getRetryStatus(
      agentName,
      preQualification.status
    ) as typeof preQualification.status;

    // Update PreQualification
    const [updatedPreQualification] = await db
      .update(preQualifications)
      .set({
        status: newStatus,
        agentErrors: JSON.stringify(updatedErrors),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId))
      .returning();

    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true, preQualification: updatedPreQualification };
  } catch (error) {
    console.error('[retryAgent] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry agent',
    };
  }
}

/**
 * Skip an optional agent (QuickScan, Timeline)
 *
 * Marks the error as resolved with userAction='skip' and moves to next workflow step.
 *
 * @param preQualificationId - Pre-Qualification ID
 * @param agentName - Name of the agent to skip
 * @returns Updated Pre-Qualification with new status
 */
export async function skipAgent(
  preQualificationId: string,
  agentName: AgentName
): Promise<{ success: boolean; preQualification?: PreQualification; error?: string }> {
  try {
    // Check if agent can be skipped
    if (!canSkipAgent(agentName)) {
      return { success: false, error: `Agent ${agentName} cannot be skipped` };
    }

    // Fetch current PreQualification
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'PreQualification not found' };
    }

    // Parse agent errors
    const agentErrors: AgentError[] = preQualification.agentErrors
      ? (JSON.parse(preQualification.agentErrors) as AgentError[])
      : [];

    // Find error for this agent
    const agentErrorIndex = agentErrors.findIndex(e => e.agentName === agentName && !e.isResolved);

    if (agentErrorIndex === -1) {
      return { success: false, error: `No unresolved error found for agent ${agentName}` };
    }

    // Mark error as resolved with skip action
    agentErrors[agentErrorIndex] = {
      ...agentErrors[agentErrorIndex],
      isResolved: true,
      userAction: 'skip',
      resolvedAt: new Date().toISOString(),
    };

    // Determine new status
    const newStatus = getSkipStatus(agentName);

    if (!newStatus) {
      return { success: false, error: `Cannot determine next status for skipping ${agentName}` };
    }

    // Update PreQualification
    const [updatedPreQualification] = await db
      .update(preQualifications)
      .set({
        status: newStatus as typeof preQualification.status,
        agentErrors: JSON.stringify(agentErrors),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId))
      .returning();

    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true, preQualification: updatedPreQualification };
  } catch (error) {
    console.error('[skipAgent] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to skip agent',
    };
  }
}

/**
 * Switch to manual extraction mode
 *
 * Activates manual input form for Extract Agent after max retries.
 *
 * @param preQualificationId - Pre-Qualification ID
 * @returns Updated Pre-Qualification with manual_extraction status
 */
export async function switchToManualMode(
  preQualificationId: string
): Promise<{ success: boolean; preQualification?: PreQualification; error?: string }> {
  try {
    // Fetch current PreQualification
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'PreQualification not found' };
    }

    // Check if currently in extraction_failed state
    if (preQualification.status !== 'extraction_failed') {
      return { success: false, error: 'PreQualification must be in extraction_failed state' };
    }

    // Update to manual extraction mode
    const [updatedPreQualification] = await db
      .update(preQualifications)
      .set({
        status: 'manual_extraction',
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId))
      .returning();

    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true, preQualification: updatedPreQualification };
  } catch (error) {
    console.error('[switchToManualMode] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to switch to manual mode',
    };
  }
}

/**
 * Resolve an agent error (mark as resolved)
 *
 * Used for dismissing errors after successful resolution.
 *
 * @param preQualificationId - Pre-Qualification ID
 * @param errorId - Error ID to resolve
 * @returns Updated Pre-Qualification
 */
export async function resolveAgentError(
  preQualificationId: string,
  errorId: string
): Promise<{ success: boolean; preQualification?: PreQualification; error?: string }> {
  try {
    // Fetch current PreQualification
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'PreQualification not found' };
    }

    // Parse agent errors
    const agentErrors: AgentError[] = preQualification.agentErrors
      ? (JSON.parse(preQualification.agentErrors) as AgentError[])
      : [];

    // Find error
    const errorIndex = agentErrors.findIndex(e => e.id === errorId);

    if (errorIndex === -1) {
      return { success: false, error: 'Error not found' };
    }

    // Mark as resolved
    agentErrors[errorIndex] = {
      ...agentErrors[errorIndex],
      isResolved: true,
      resolvedAt: new Date().toISOString(),
    };

    // Update PreQualification
    const [updatedPreQualification] = await db
      .update(preQualifications)
      .set({
        agentErrors: JSON.stringify(agentErrors),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId))
      .returning();

    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true, preQualification: updatedPreQualification };
  } catch (error) {
    console.error('[resolveAgentError] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve error',
    };
  }
}

/**
 * Save agent error to database
 *
 * Helper function to save an error during agent execution.
 *
 * @param preQualificationId - Pre-Qualification ID
 * @param agentError - Agent error to save
 * @returns Updated Pre-Qualification
 */
export async function saveAgentError(
  preQualificationId: string,
  agentError: AgentError
): Promise<{ success: boolean; preQualification?: PreQualification; error?: string }> {
  try {
    // Fetch current PreQualification
    const [preQualification] = await db
      .select()
      .from(preQualifications)
      .where(eq(preQualifications.id, preQualificationId))
      .limit(1);

    if (!preQualification) {
      return { success: false, error: 'PreQualification not found' };
    }

    // Parse existing errors
    const agentErrors: AgentError[] = preQualification.agentErrors
      ? (JSON.parse(preQualification.agentErrors) as AgentError[])
      : [];

    // Add new error
    agentErrors.push(agentError);

    // Update PreQualification
    const [updatedPreQualification] = await db
      .update(preQualifications)
      .set({
        agentErrors: JSON.stringify(agentErrors),
        updatedAt: new Date(),
      })
      .where(eq(preQualifications.id, preQualificationId))
      .returning();

    revalidatePath(`/pre-qualifications/${preQualificationId}`);

    return { success: true, preQualification: updatedPreQualification };
  } catch (error) {
    console.error('[saveAgentError] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get status to set when retrying an agent
 *
 * Maps failed status back to running status
 */
function getRetryStatus(agentName: AgentName, currentStatus: string): string {
  const statusMap: Record<AgentName, string> = {
    DuplicateCheck: 'duplicate_checking',
    Extract: 'extracting',
    QuickScan: 'quick_scanning',
    Timeline: 'timeline_estimating',
  };

  return statusMap[agentName] || currentStatus;
}
