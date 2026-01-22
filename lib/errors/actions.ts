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
import { rfps, type Rfp } from '../db/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retry a failed agent
 *
 * Resets the agent's error state and re-triggers the agent with the same inputs.
 *
 * @param rfpId - RFP ID
 * @param agentName - Name of the agent to retry
 * @returns Updated RFP with new status
 */
export async function retryAgent(
  rfpId: string,
  agentName: AgentName
): Promise<{ success: boolean; rfp?: Rfp; error?: string }> {
  try {
    // Fetch current RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP not found' };
    }

    // Parse agent errors
    const agentErrors: AgentError[] = rfp.agentErrors
      ? (JSON.parse(rfp.agentErrors) as AgentError[])
      : [];

    // Find error for this agent
    const agentError = agentErrors.find(e => e.agentName === agentName && !e.isResolved);

    if (!agentError) {
      return { success: false, error: `Agent ${agentName} is not in failed state` };
    }

    // Remove error from list (will be re-added if fails again)
    const updatedErrors = agentErrors.filter(e => e.id !== agentError.id);

    // Determine new status based on agent
    const newStatus = getRetryStatus(agentName, rfp.status) as typeof rfp.status;

    // Update RFP
    const [updatedRfp] = await db
      .update(rfps)
      .set({
        status: newStatus,
        agentErrors: JSON.stringify(updatedErrors),
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId))
      .returning();

    revalidatePath(`/rfps/${rfpId}`);

    return { success: true, rfp: updatedRfp };
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
 * @param rfpId - RFP ID
 * @param agentName - Name of the agent to skip
 * @returns Updated RFP with new status
 */
export async function skipAgent(
  rfpId: string,
  agentName: AgentName
): Promise<{ success: boolean; rfp?: Rfp; error?: string }> {
  try {
    // Check if agent can be skipped
    if (!canSkipAgent(agentName)) {
      return { success: false, error: `Agent ${agentName} cannot be skipped` };
    }

    // Fetch current RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP not found' };
    }

    // Parse agent errors
    const agentErrors: AgentError[] = rfp.agentErrors
      ? (JSON.parse(rfp.agentErrors) as AgentError[])
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

    // Update RFP
    const [updatedRfp] = await db
      .update(rfps)
      .set({
        status: newStatus as typeof rfp.status,
        agentErrors: JSON.stringify(agentErrors),
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId))
      .returning();

    revalidatePath(`/rfps/${rfpId}`);

    return { success: true, rfp: updatedRfp };
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
 * @param rfpId - RFP ID
 * @returns Updated RFP with manual_extraction status
 */
export async function switchToManualMode(
  rfpId: string
): Promise<{ success: boolean; rfp?: Rfp; error?: string }> {
  try {
    // Fetch current RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP not found' };
    }

    // Check if currently in extraction_failed state
    if (rfp.status !== 'extraction_failed') {
      return { success: false, error: 'RFP must be in extraction_failed state' };
    }

    // Update to manual extraction mode
    const [updatedRfp] = await db
      .update(rfps)
      .set({
        status: 'manual_extraction',
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId))
      .returning();

    revalidatePath(`/rfps/${rfpId}`);

    return { success: true, rfp: updatedRfp };
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
 * @param rfpId - RFP ID
 * @param errorId - Error ID to resolve
 * @returns Updated RFP
 */
export async function resolveAgentError(
  rfpId: string,
  errorId: string
): Promise<{ success: boolean; rfp?: Rfp; error?: string }> {
  try {
    // Fetch current RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP not found' };
    }

    // Parse agent errors
    const agentErrors: AgentError[] = rfp.agentErrors
      ? (JSON.parse(rfp.agentErrors) as AgentError[])
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

    // Update RFP
    const [updatedRfp] = await db
      .update(rfps)
      .set({
        agentErrors: JSON.stringify(agentErrors),
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId))
      .returning();

    revalidatePath(`/rfps/${rfpId}`);

    return { success: true, rfp: updatedRfp };
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
 * @param rfpId - RFP ID
 * @param agentError - Agent error to save
 * @returns Updated RFP
 */
export async function saveAgentError(
  rfpId: string,
  agentError: AgentError
): Promise<{ success: boolean; rfp?: Rfp; error?: string }> {
  try {
    // Fetch current RFP
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

    if (!rfp) {
      return { success: false, error: 'RFP not found' };
    }

    // Parse existing errors
    const agentErrors: AgentError[] = rfp.agentErrors
      ? (JSON.parse(rfp.agentErrors) as AgentError[])
      : [];

    // Add new error
    agentErrors.push(agentError);

    // Update RFP
    const [updatedRfp] = await db
      .update(rfps)
      .set({
        agentErrors: JSON.stringify(agentErrors),
        updatedAt: new Date(),
      })
      .where(eq(rfps.id, rfpId))
      .returning();

    revalidatePath(`/rfps/${rfpId}`);

    return { success: true, rfp: updatedRfp };
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
