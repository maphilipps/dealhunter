'use client';

import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { useAgentStream } from '@/hooks/use-agent-stream';
import type { AgentEvent } from '@/lib/streaming/event-types';

// ============================================================================
// Types
// ============================================================================

export type ExpertStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ExpertState {
  status: ExpertStatus;
  progress?: string;
  result?: unknown;
  confidence?: number;
}

export interface DeepScanContextValue {
  // Stream state
  isStreaming: boolean;
  events: AgentEvent[];
  error: string | null;
  decision: unknown | null;

  // Agent states (keyed by agent name from stream)
  agentStates: Record<string, ExpertState>;

  // Computed helpers
  activeAgent: string | null;
  completedExperts: string[];
  pendingExperts: string[];

  // Helper functions
  getExpertStatus: (expertName: string) => ExpertStatus;
  getExpertResult: (expertName: string) => unknown | null;

  // Actions
  startDeepScan: (leadId: string) => void;
  stopDeepScan: () => void;
}

// ============================================================================
// Expert Name Mapping
// ============================================================================

/**
 * Maps agent names from SSE stream to sidebar section names
 * Stream uses names like "Tech Expert", sidebar expects "technology"
 */
const EXPERT_TO_SECTION_MAP: Record<string, string> = {
  'Tech Expert': 'technology',
  'Website Expert': 'website-analysis',
  'Architecture Expert': 'cms-architecture',
  'Hosting Expert': 'hosting',
  'Integrations Expert': 'integrations',
  'Migration Expert': 'migration',
  'Project Expert': 'project-org',
  'Costs Expert': 'costs',
  'Decision Expert': 'decision',
  'Performance Expert': 'performance',
};

/**
 * Maps sidebar section names back to stream agent names
 */
const SECTION_TO_EXPERT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(EXPERT_TO_SECTION_MAP).map(([k, v]) => [v, k])
);

/**
 * All known experts in execution order
 */
const ALL_EXPERTS = [
  'Tech Expert',
  'Website Expert',
  'Architecture Expert',
  'Hosting Expert',
  'Integrations Expert',
  'Migration Expert',
  'Project Expert',
  'Costs Expert',
  'Decision Expert',
];

// ============================================================================
// Context
// ============================================================================

const DeepScanContext = createContext<DeepScanContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface DeepScanProviderProps {
  children: ReactNode;
}

export function DeepScanProvider({ children }: DeepScanProviderProps) {
  const stream = useAgentStream();

  // Start deep scan for the lead
  const startDeepScan = useCallback(
    (scanLeadId: string) => {
      const url = `/api/leads/${scanLeadId}/deep-scan/stream`;
      stream.start(url);
    },
    [stream]
  );

  // Stop the scan
  const stopDeepScan = useCallback(() => {
    stream.abort();
  }, [stream]);

  // Compute active agent (last one with 'running' status)
  const activeAgent = useMemo(() => {
    for (const [name, state] of Object.entries(stream.agentStates)) {
      if (state.status === 'running') {
        return name;
      }
    }
    return null;
  }, [stream.agentStates]);

  // Compute completed experts list
  const completedExperts = useMemo(() => {
    return Object.entries(stream.agentStates)
      .filter(([, state]) => state.status === 'complete')
      .map(([name]) => name);
  }, [stream.agentStates]);

  // Compute pending experts (not started yet)
  const pendingExperts = useMemo(() => {
    const started = new Set(Object.keys(stream.agentStates));
    return ALL_EXPERTS.filter(name => !started.has(name));
  }, [stream.agentStates]);

  // Get expert status by name (accepts both stream name and section name)
  const getExpertStatus = useCallback(
    (expertName: string): ExpertStatus => {
      // Try direct match first (stream name)
      let state = stream.agentStates[expertName];

      // Try section name mapping
      if (!state) {
        const streamName = SECTION_TO_EXPERT_MAP[expertName];
        if (streamName) {
          state = stream.agentStates[streamName];
        }
      }

      if (!state) {
        // Not in stream yet - check if streaming
        if (stream.isStreaming) {
          return 'pending';
        }
        return 'pending';
      }

      return state.status as ExpertStatus;
    },
    [stream.agentStates, stream.isStreaming]
  );

  // Get expert result by name
  const getExpertResult = useCallback(
    (expertName: string): unknown | null => {
      // Try direct match first
      let state = stream.agentStates[expertName];

      // Try section name mapping
      if (!state) {
        const streamName = SECTION_TO_EXPERT_MAP[expertName];
        if (streamName) {
          state = stream.agentStates[streamName];
        }
      }

      return state?.result ?? null;
    },
    [stream.agentStates]
  );

  // Memoize context value
  const value = useMemo<DeepScanContextValue>(
    () => ({
      isStreaming: stream.isStreaming,
      events: stream.events,
      error: stream.error,
      decision: stream.decision,
      agentStates: stream.agentStates as Record<string, ExpertState>,
      activeAgent,
      completedExperts,
      pendingExperts,
      getExpertStatus,
      getExpertResult,
      startDeepScan,
      stopDeepScan,
    }),
    [
      stream.isStreaming,
      stream.events,
      stream.error,
      stream.decision,
      stream.agentStates,
      activeAgent,
      completedExperts,
      pendingExperts,
      getExpertStatus,
      getExpertResult,
      startDeepScan,
      stopDeepScan,
    ]
  );

  return <DeepScanContext.Provider value={value}>{children}</DeepScanContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useDeepScan() {
  const context = useContext(DeepScanContext);
  if (!context) {
    throw new Error('useDeepScan must be used within a DeepScanProvider');
  }
  return context;
}

// ============================================================================
// Utilities (exported for use in sidebar)
// ============================================================================

export { EXPERT_TO_SECTION_MAP, SECTION_TO_EXPERT_MAP, ALL_EXPERTS };
