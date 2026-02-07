/**
 * Unified types for AgentActivityView
 *
 * Generic AgentPhase interface that works for both:
 * - Lead Scan (QualificationScanPhase: bootstrap → multi_page → analysis → synthesis)
 * - Pitch Scan (PitchScanPhase: 13 phases from discovery → documentation)
 *
 * This decouples the activity view from any specific scan type.
 */

// ============================================================================
// Generic Phase Interface
// ============================================================================

export type PhaseStatus = 'pending' | 'running' | 'complete' | 'error';

/**
 * Generic agent phase — works across all scan types.
 * Each scan type maps its specific phases into this shape.
 */
export interface AgentPhase {
  /** Unique phase identifier (e.g. 'bootstrap', 'ps-discovery') */
  id: string;
  /** Human-readable label */
  label: string;
  /** Current status */
  status: PhaseStatus;
  /** Optional sub-analyses completed within this phase */
  analyses?: AgentPhaseAnalysis[];
  /** Timestamp when phase started */
  startedAt?: number;
  /** Timestamp when phase completed */
  completedAt?: number;
}

export interface AgentPhaseAnalysis {
  name: string;
  success: boolean;
  duration: number;
  details?: string;
}

// ============================================================================
// Agent Group (for event-based grouping)
// ============================================================================

export interface AgentGroup {
  name: string;
  status: PhaseStatus;
  events: AgentGroupEvent[];
  startTime?: number;
  endTime?: number;
}

export interface AgentGroupEvent {
  id: string;
  timestamp: number;
  message?: string;
  type: string;
}

// ============================================================================
// Tab types for AgentActivityView
// ============================================================================

export type ActivityTab = 'agents' | 'queue' | 'reasoning' | 'tools';
