/**
 * BL-Review Workflow Status Helpers
 * Simple, linear workflow validation without over-engineering
 */

import type { PreQualification } from '@/lib/db/schema';

export type BLReviewPhase =
  | 'bu_matching'
  | 'deep_analysis'
  | 'team_assignment'
  | 'notification'
  | 'handoff';

export type TabId = 'overview' | 'bu-matching' | 'questions' | 'baseline' | 'planning' | 'team';

interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a transition to the next phase is allowed
 * Simple switch-based validation - no XState needed for linear workflow
 */
export function canTransitionTo(
  bid: Pick<
    PreQualification,
    'quickScanId' | 'deepMigrationAnalysisId' | 'assignedTeam' | 'teamNotifiedAt'
  >,
  nextPhase: BLReviewPhase
): TransitionResult {
  switch (nextPhase) {
    case 'bu_matching':
      // BU Matching requires Quick Scan to be completed
      if (!bid.quickScanId) {
        return { allowed: false, reason: 'Quick Scan muss zuerst abgeschlossen sein' };
      }
      return { allowed: true };

    case 'deep_analysis':
      // Deep Analysis requires Quick Scan
      if (!bid.quickScanId) {
        return { allowed: false, reason: 'Quick Scan muss zuerst abgeschlossen sein' };
      }
      return { allowed: true };

    case 'team_assignment':
      // Team Assignment requires Deep Analysis (baseline comparison)
      if (!bid.deepMigrationAnalysisId) {
        return { allowed: false, reason: 'Deep Analysis muss zuerst abgeschlossen sein' };
      }
      return { allowed: true };

    case 'notification':
      // Notification requires Team to be assigned
      if (!bid.assignedTeam) {
        return { allowed: false, reason: 'Team muss zuerst zugewiesen sein' };
      }
      return { allowed: true };

    case 'handoff':
      // Handoff requires team to be notified
      if (!bid.teamNotifiedAt) {
        return { allowed: false, reason: 'Team muss zuerst benachrichtigt sein' };
      }
      return { allowed: true };

    default: {
      // Ensure all cases are handled - TypeScript will error if a phase is missing
      const _exhaustiveCheck: never = nextPhase;
      return { allowed: false, reason: 'Unbekannte Phase' };
    }
  }
}

/**
 * Get list of enabled tabs based on workflow progress
 * Tabs are progressively unlocked as phases complete
 */
export function getEnabledTabs(
  bid: Pick<PreQualification, 'quickScanId' | 'deepMigrationAnalysisId' | 'assignedTeam'>
): TabId[] {
  const tabs: TabId[] = ['overview'];

  // BU Matching and 10 Questions require Quick Scan
  if (bid.quickScanId) {
    tabs.push('bu-matching', 'questions');
  }

  // Baseline and Planning require Deep Analysis
  if (bid.deepMigrationAnalysisId) {
    tabs.push('baseline', 'planning');
  }

  // Team tab is always shown but actions are gated
  tabs.push('team');

  return tabs;
}

/**
 * Get current workflow phase based on bid status
 */
export function getCurrentPhase(
  bid: Pick<PreQualification, 'status' | 'assignedTeam' | 'teamNotifiedAt'>
): BLReviewPhase {
  const status = bid.status;

  if (status === 'handed_off') return 'handoff';
  if (status === 'notified' || bid.teamNotifiedAt) return 'notification';
  if (status === 'team_assigned' || bid.assignedTeam) return 'team_assignment';
  if (['bl_reviewing', 'full_scanning', 'analysis_complete'].includes(status))
    return 'deep_analysis';

  return 'bu_matching';
}

/**
 * Get workflow progress for visual indicator
 * Returns array of phases with completion status
 */
export function getWorkflowProgress(
  bid: Pick<
    PreQualification,
    'quickScanId' | 'deepMigrationAnalysisId' | 'assignedTeam' | 'teamNotifiedAt' | 'status'
  >
): Array<{ phase: BLReviewPhase; label: string; completed: boolean; current: boolean }> {
  const phases: Array<{ phase: BLReviewPhase; label: string }> = [
    { phase: 'bu_matching', label: 'BU Matching' },
    { phase: 'deep_analysis', label: 'Deep Analysis' },
    { phase: 'team_assignment', label: 'Team' },
    { phase: 'notification', label: 'Benachrichtigung' },
    { phase: 'handoff', label: 'Abschluss' },
  ];

  const currentPhase = getCurrentPhase(bid);

  return phases.map(p => {
    let completed = false;

    switch (p.phase) {
      case 'bu_matching':
        completed = !!bid.quickScanId;
        break;
      case 'deep_analysis':
        completed = !!bid.deepMigrationAnalysisId;
        break;
      case 'team_assignment':
        completed = !!bid.assignedTeam;
        break;
      case 'notification':
        completed = !!bid.teamNotifiedAt;
        break;
      case 'handoff':
        completed = bid.status === 'handed_off';
        break;
      default: {
        const _exhaustiveCheck: never = p.phase;
        break;
      }
    }

    return {
      ...p,
      completed,
      current: p.phase === currentPhase && !completed,
    };
  });
}
