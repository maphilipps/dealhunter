'use client';

import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  useBackgroundJobStatus,
  isJobInProgress,
  type BackgroundJob,
} from '@/hooks/use-background-job-status';
import {
  SECTION_TO_EXPERT,
  ALL_EXPERTS,
  EXPERT_DISPLAY_NAMES,
} from '@/lib/deep-scan/section-expert-mapping';

// ============================================================================
// Types
// ============================================================================

export type DeepScanStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';
export type ExpertStatus = 'pending' | 'running' | 'complete' | 'error';

export interface DeepScanContextValue {
  // Job state from polling
  job: BackgroundJob | null;
  isLoading: boolean;
  error: Error | null;

  // Computed status
  status: DeepScanStatus;
  isInProgress: boolean;
  currentPhase: 'scraping' | 'phase2' | 'phase3' | 'completed' | null;
  currentExpert: string | null;
  progress: number;

  // Expert tracking
  completedExperts: string[];
  pendingExperts: string[];
  sectionConfidences: Record<string, number>;

  // Helper functions
  getExpertStatus: (expertName: string) => ExpertStatus;
  getSectionConfidence: (sectionId: string) => number | null;

  // Actions
  startDeepScan: (
    forceReset?: boolean,
    selectedExperts?: string[]
  ) => Promise<{ success: boolean; error?: string }>;
  startSelectiveScan: (sectionIds: string[]) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const DeepScanContext = createContext<DeepScanContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface DeepScanProviderProps {
  children: ReactNode;
  leadId: string;
}

export function DeepScanProvider({ children, leadId }: DeepScanProviderProps) {
  const [startError, setStartError] = useState<string | null>(null);

  // Poll for job status
  const { job, isLoading, error, refetch, reset } = useBackgroundJobStatus({
    leadId,
    jobType: 'deep-scan',
    pollingInterval: 10000, // 10 seconds
    enabled: true,
  });

  // Compute status from job
  const status = useMemo<DeepScanStatus>(() => {
    if (!job) return 'idle';
    switch (job.status) {
      case 'pending':
        return 'pending';
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'cancelled':
        return 'failed';
      default:
        return 'idle';
    }
  }, [job]);

  const isInProgress = useMemo(() => isJobInProgress(job), [job]);

  // Get expert status by name (accepts both internal name and section ID)
  const getExpertStatus = useCallback(
    (expertName: string): ExpertStatus => {
      if (!job) return 'pending';

      // Map section ID to expert name if needed
      const internalName = SECTION_TO_EXPERT[expertName] || expertName;

      // Check if completed
      if (job.completedExperts.includes(internalName)) {
        return 'complete';
      }

      // Check if currently running
      if (job.currentExpert === internalName) {
        return 'running';
      }

      // Check if in pending list
      if (job.pendingExperts.includes(internalName)) {
        return 'pending';
      }

      // Default to pending if job is still running
      if (isInProgress) {
        return 'pending';
      }

      // Job is done but expert wasn't completed - likely an error
      return 'error';
    },
    [job, isInProgress]
  );

  // Get confidence for a section
  const getSectionConfidence = useCallback(
    (sectionId: string): number | null => {
      if (!job?.sectionConfidences) return null;
      return job.sectionConfidences[sectionId] ?? null;
    },
    [job]
  );

  // Start a new deep scan
  const startDeepScan = useCallback(
    async (
      forceReset = false,
      selectedExperts?: string[]
    ): Promise<{ success: boolean; error?: string }> => {
      setStartError(null);

      try {
        const response = await fetch(`/api/qualifications/${leadId}/deep-scan/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceReset, selectedExperts }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || 'Failed to start deep scan';
          setStartError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Reset local state and start polling
        reset();
        void refetch();

        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setStartError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [leadId, reset, refetch]
  );

  // Start a selective re-scan
  const startSelectiveScan = useCallback(
    async (sectionIds: string[]): Promise<{ success: boolean; error?: string }> => {
      setStartError(null);

      try {
        const response = await fetch(`/api/qualifications/${leadId}/deep-scan/selective`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionIds }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = data.error || 'Failed to start selective scan';
          setStartError(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Reset local state and start polling
        reset();
        void refetch();

        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setStartError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [leadId, reset, refetch]
  );

  // Memoize context value
  const value = useMemo<DeepScanContextValue>(
    () => ({
      job,
      isLoading,
      error: error || (startError ? new Error(startError) : null),
      status,
      isInProgress,
      currentPhase: job?.currentPhase ?? null,
      currentExpert: job?.currentExpert ?? null,
      progress: job?.progress ?? 0,
      completedExperts: job?.completedExperts ?? [],
      pendingExperts: job?.pendingExperts ?? [],
      sectionConfidences: job?.sectionConfidences ?? {},
      getExpertStatus,
      getSectionConfidence,
      startDeepScan,
      startSelectiveScan,
      refetch,
    }),
    [
      job,
      isLoading,
      error,
      startError,
      status,
      isInProgress,
      getExpertStatus,
      getSectionConfidence,
      startDeepScan,
      startSelectiveScan,
      refetch,
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
// Utilities (exported for use in components)
// ============================================================================

// Re-export for consumers that import from this context
export { SECTION_TO_EXPERT, ALL_EXPERTS, EXPERT_DISPLAY_NAMES };
