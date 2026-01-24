/**
 * Phase 1 Workflow Orchestrator (DEA-90)
 *
 * Auto-triggers agents in sequence during RFP qualification workflow:
 * 1. Upload → Duplicate Check
 * 2. Duplicate Check (no dups) → Extract
 * 3. Extract Review + Confirm → Quick Scan (if website URL)
 * 4. Quick Scan Complete → Questions Ready
 * 5. BID Decision → Timeline Agent
 * 6. Timeline Complete → Decision Made (show BL routing modal)
 *
 * Key Principles:
 * - Linear workflow (no parallelization in Phase 1)
 * - User override points: Duplicate Warning, Extract Review, BID/NO-BID
 * - NO auto-routing - BD Manager manually selects BL
 * - Graceful degradation on missing prerequisites
 */

import { eq } from 'drizzle-orm';

import { db } from '../db';
import { rfps, type Rfp } from '../db/schema';
import type { ExtractedRequirements } from '../extraction/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RFP Status types from schema
 */
export type RFPStatus = Rfp['status'];

/**
 * Agent names in Phase 1 workflow
 */
export type Phase1Agent = 'DuplicateCheck' | 'Extract' | 'QuickScan' | 'Timeline';

/**
 * Trigger conditions for status transitions
 */
type TriggerCondition = (rfp: Rfp) => boolean | Promise<boolean>;

/**
 * Trigger rule definition
 */
interface TriggerRule {
  nextAgent: Phase1Agent | null;
  nextStatus: RFPStatus | null;
  trigger: 'auto' | 'auto_if_no_duplicates' | 'auto_after_user_confirm' | 'status_update_only';
  condition: TriggerCondition;
  skipReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW RULES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Trigger rules for Phase 1 workflow
 * Maps current status → next agent + condition
 */
const TRIGGER_RULES: Partial<Record<RFPStatus, TriggerRule>> = {
  // 1. Upload → Extract (ALWAYS auto-trigger to get customer data)
  draft: {
    nextAgent: 'Extract',
    nextStatus: 'extracting',
    trigger: 'auto',
    condition: () => true,
  },

  // 2. Extract Complete → User Review (status update only, no auto-trigger)
  extracting: {
    nextAgent: null,
    nextStatus: 'reviewing',
    trigger: 'status_update_only',
    condition: () => true,
  },

  // 3. Extract Review + Confirm → Duplicate Check (user confirms extracted data)
  reviewing: {
    nextAgent: 'DuplicateCheck',
    nextStatus: 'duplicate_checking',
    trigger: 'auto_after_user_confirm',
    condition: () => true, // Always run duplicate check after user confirms
  },

  // 4. Duplicate Check → Quick Scan (if no duplicates AND website URL exists)
  duplicate_checking: {
    nextAgent: 'QuickScan',
    nextStatus: 'quick_scanning',
    trigger: 'auto_if_no_duplicates',
    condition: rfp => {
      // First check for duplicates
      if (rfp.duplicateCheckResult) {
        const result = JSON.parse(rfp.duplicateCheckResult) as {
          hasDuplicates?: boolean;
          userOverride?: boolean;
        };
        // If duplicates found and no override, skip
        if (result.hasDuplicates && !result.userOverride) {
          return false;
        }
      }

      // Then check for website URL
      if (rfp.websiteUrl) return true;

      if (rfp.extractedRequirements) {
        const extracted = JSON.parse(rfp.extractedRequirements) as ExtractedRequirements;
        return !!(
          extracted.websiteUrl ||
          (extracted.websiteUrls && extracted.websiteUrls.length > 0)
        );
      }

      return false;
    },
    skipReason: 'Duplicate found or Website URL required',
  },

  // 5. Quick Scan → BL Routing Pending (NO AGENT, just status update)
  // BD Manager routes to BL, then BL makes BID/NO-BID decision
  quick_scanning: {
    nextAgent: null,
    nextStatus: 'bit_pending', // Waiting for BL routing (not BID decision by BD!)
    trigger: 'status_update_only',
    condition: () => true,
  },

  // 6. BID/NO-BID Decision by BL is handled in Leads workflow, not RFP workflow
  // Timeline Agent runs AFTER BL approves (in Phase 2)
  // NOTE: bit_pending now means "waiting for BL routing", not "waiting for BID decision"

  // 7. Timeline → Decision Made (NO AGENT, show BL routing modal)
  timeline_estimating: {
    nextAgent: null,
    nextStatus: 'decision_made',
    trigger: 'status_update_only',
    condition: () => true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map agent completion to next status
 * Called by agents after they finish
 */
export function getNextStatusAfterAgent(agentName: Phase1Agent): RFPStatus {
  switch (agentName) {
    case 'Extract':
      return 'reviewing'; // User must review + confirm
    case 'DuplicateCheck':
      return 'duplicate_checking'; // Will check duplicates, then proceed or wait
    case 'QuickScan':
      return 'bit_pending'; // Waiting for BID/NO-BID decision
    case 'Timeline':
      return 'decision_made'; // Ready for BL routing
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Trigger next agent based on current RFP status
 *
 * This is the main orchestration function - called after agent completion
 * or user actions (e.g., BID decision, duplicate override)
 *
 * @param rfpId - RFP ID
 * @param currentStatus - Current RFP status
 * @param context - Additional context (e.g., user override flag)
 */
export async function triggerNextAgent(
  rfpId: string,
  currentStatus: RFPStatus,
  context?: {
    userOverride?: boolean; // For duplicate warning override
    decision?: 'bid' | 'no_bid'; // For BID/NO-BID decision
  }
): Promise<{ triggered: boolean; agent?: Phase1Agent; reason?: string }> {
  const rule = TRIGGER_RULES[currentStatus];

  // No rule for this status
  if (!rule) {
    console.error(`[Orchestrator] No trigger rule for status: ${currentStatus}`);
    return { triggered: false, reason: 'No trigger rule defined' };
  }

  // No next agent (status update only)
  if (!rule.nextAgent) {
    console.error(`[Orchestrator] Status update only for: ${currentStatus}`);

    // Update status if there's a next status
    if (rule.nextStatus) {
      await updateRfpStatus(rfpId, rule.nextStatus);
    }

    return { triggered: false, reason: 'Status update only, no agent to trigger' };
  }

  // Load RFP data
  const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

  if (!rfp) {
    console.error(`[Orchestrator] RFP not found: ${rfpId}`);
    return { triggered: false, reason: 'RFP not found' };
  }

  // Apply context updates (e.g., user override, decision)
  const contextualRfp = { ...rfp };
  if (context?.userOverride && rfp.duplicateCheckResult) {
    const result = JSON.parse(rfp.duplicateCheckResult) as Record<string, unknown>;
    result.userOverride = true;
    contextualRfp.duplicateCheckResult = JSON.stringify(result);
  }
  if (context?.decision) {
    contextualRfp.decision = context.decision;
  }

  // Check condition
  const shouldTrigger = await rule.condition(contextualRfp);

  if (!shouldTrigger) {
    console.error(
      `[Orchestrator] Skipping ${rule.nextAgent} for ${rfpId}: ${rule.skipReason || 'condition not met'}`
    );
    return { triggered: false, reason: rule.skipReason || 'Condition not met' };
  }

  // Update status to next agent's running status
  if (rule.nextStatus) {
    await updateRfpStatus(rfpId, rule.nextStatus);
  }

  // Trigger next agent (via background job or direct call)
  console.error(`[Orchestrator] Triggering ${rule.nextAgent} for ${rfpId}`);

  // NOTE: Actual agent execution happens in API routes or server actions
  // This function just updates status and logs intent
  // The respective API endpoints will check status and run agents

  return { triggered: true, agent: rule.nextAgent };
}

/**
 * Called by agents after successful completion
 * Updates status and triggers next agent
 *
 * @param rfpId - RFP ID
 * @param agentName - Agent that just completed
 */
export async function onAgentComplete(
  rfpId: string,
  agentName: Phase1Agent
): Promise<{ nextAgent?: Phase1Agent }> {
  console.error(`[Orchestrator] Agent ${agentName} completed for RFP ${rfpId}`);

  // Get next status
  const nextStatus = getNextStatusAfterAgent(agentName);

  // Update RFP status
  await updateRfpStatus(rfpId, nextStatus);

  // Try to trigger next agent
  const result = await triggerNextAgent(rfpId, nextStatus);

  return { nextAgent: result.agent };
}

/**
 * Handle user override on duplicate warning
 * Continues workflow even with duplicates
 */
export async function handleDuplicateOverride(rfpId: string): Promise<{ success: boolean }> {
  console.error(`[Orchestrator] User override duplicate warning for ${rfpId}`);

  // Trigger Extract Agent with override context
  const result = await triggerNextAgent(rfpId, 'duplicate_checking', { userOverride: true });

  return { success: result.triggered };
}

/**
 * Handle BID/NO-BID decision
 * Triggers Timeline Agent if BID, archives if NO-BID
 */
export async function handleBidDecision(
  rfpId: string,
  decision: 'bid' | 'no_bid'
): Promise<{ success: boolean; nextAgent?: Phase1Agent }> {
  console.error(`[Orchestrator] BID decision "${decision}" for ${rfpId}`);

  // Update decision in RFP
  await db
    .update(rfps)
    .set({
      decision,
      updatedAt: new Date(),
    })
    .where(eq(rfps.id, rfpId));

  // NO-BID → Archive
  if (decision === 'no_bid') {
    await updateRfpStatus(rfpId, 'archived');
    return { success: true };
  }

  // BID → Trigger Timeline Agent
  const result = await triggerNextAgent(rfpId, 'bit_pending', { decision: 'bid' });

  return { success: result.triggered, nextAgent: result.agent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update RFP status
 */
async function updateRfpStatus(rfpId: string, status: RFPStatus): Promise<void> {
  await db
    .update(rfps)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(rfps.id, rfpId));

  console.error(`[Orchestrator] Updated RFP ${rfpId} status to: ${status}`);
}

/**
 * Get current workflow status for UI display
 * Returns human-readable labels and next agent info
 */
export async function getWorkflowStatus(rfpId: string): Promise<{
  currentStatus: RFPStatus;
  currentStatusLabel: string;
  nextAgent: Phase1Agent | null;
  nextAgentLabel: string | null;
  isProcessing: boolean;
  canProceed: boolean;
  blockReason?: string;
}> {
  const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);

  if (!rfp) {
    throw new Error(`RFP not found: ${rfpId}`);
  }

  const rule = TRIGGER_RULES[rfp.status];
  const isProcessing = [
    'duplicate_checking',
    'extracting',
    'quick_scanning',
    'timeline_estimating',
  ].includes(rfp.status);

  // Determine if workflow can proceed
  let canProceed = true;
  let blockReason: string | undefined;

  if (rule) {
    const shouldTrigger = await rule.condition(rfp);
    canProceed = shouldTrigger;
    if (!shouldTrigger) {
      blockReason = rule.skipReason;
    }
  }

  return {
    currentStatus: rfp.status,
    currentStatusLabel: getStatusLabel(rfp.status),
    nextAgent: rule?.nextAgent || null,
    nextAgentLabel: rule?.nextAgent ? getAgentLabel(rule.nextAgent) : null,
    isProcessing,
    canProceed,
    blockReason,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI LABELS
// ═══════════════════════════════════════════════════════════════════════════════

function getStatusLabel(status: RFPStatus): string {
  const labels: Record<RFPStatus, string> = {
    draft: 'Entwurf',
    duplicate_checking: 'Duplikat-Prüfung läuft',
    duplicate_check_failed: 'Duplikat-Prüfung fehlgeschlagen',
    duplicate_warning: 'Duplikat gefunden',
    extracting: 'Extraktion läuft',
    extraction_failed: 'Extraktion fehlgeschlagen',
    manual_extraction: 'Manuelle Eingabe erforderlich',
    reviewing: 'Prüfung erforderlich',
    quick_scanning: 'Quick Scan läuft',
    quick_scan_failed: 'Quick Scan fehlgeschlagen',
    timeline_estimating: 'Timeline-Schätzung läuft',
    timeline_failed: 'Timeline-Schätzung fehlgeschlagen',
    bit_pending: 'BL-Routing erforderlich', // BID/NO-BID by BL after routing
    questions_ready: 'Fragen bereit',
    decision_made: 'Entscheidung getroffen',
    bid_voted: 'BID-Entscheidung getroffen',
    evaluating: 'Evaluierung läuft',
    archived: 'Archiviert (NO-BID)',
    routed: 'An BL weitergeleitet',
    full_scanning: 'Deep Analysis läuft',
    bl_reviewing: 'BL prüft',
    team_assigned: 'Team zugewiesen',
    notified: 'Team benachrichtigt',
    handed_off: 'Übergeben',
    analysis_complete: 'Analyse abgeschlossen',
  };

  return labels[status] || status;
}

function getAgentLabel(agent: Phase1Agent): string {
  const labels: Record<Phase1Agent, string> = {
    DuplicateCheck: 'Duplikat-Prüfung',
    Extract: 'Extraktion',
    QuickScan: 'Quick Scan',
    Timeline: 'Timeline-Schätzung',
  };

  return labels[agent];
}
