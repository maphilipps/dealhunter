'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Background Job Status Hook
 *
 * Polls the background job API for status updates with:
 * - Configurable polling interval (default 10s for deep scan)
 * - Page Visibility API integration (pauses when tab is hidden)
 * - Automatic stop when job is terminal (completed/failed/cancelled)
 * - Support for job type filtering
 */

// ============================================================================
// Types
// ============================================================================

export interface BackgroundJob {
  id: string;
  jobType: 'deep-scan' | 'deep-analysis' | 'team-notification' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  // Deep scan specific fields
  currentExpert: string | null;
  currentPhase: 'scraping' | 'phase2' | 'phase3' | 'completed';
  completedExperts: string[];
  pendingExperts: string[];
  sectionConfidences: Record<string, number>;
  bullmqJobId: string | null;
}

export interface UseBackgroundJobStatusOptions {
  leadId: string;
  /** Polling interval in milliseconds (default: 10000 for deep scan) */
  pollingInterval?: number;
  /** Enable/disable polling */
  enabled?: boolean;
  /** Filter by job type */
  jobType?: 'deep-scan' | 'deep-analysis';
  /** Pause polling when tab is hidden (default: true) */
  pauseOnHidden?: boolean;
}

export interface UseBackgroundJobStatusResult {
  job: BackgroundJob | null;
  isLoading: boolean;
  error: Error | null;
  /** Whether polling is currently active */
  isPolling: boolean;
  /** Whether tab is currently visible */
  isVisible: boolean;
  /** Manually trigger a fetch */
  refetch: () => Promise<void>;
  /** Reset state (e.g., before starting new job) */
  reset: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useBackgroundJobStatus({
  leadId,
  pollingInterval = 10000, // Poll every 10 seconds
  enabled = true,
  jobType,
  pauseOnHidden = true,
}: UseBackgroundJobStatusOptions): UseBackgroundJobStatusResult {
  const [job, setJob] = useState<BackgroundJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  // Refs for preventing race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Build API URL with optional job type filter
  const apiUrl = jobType
    ? `/api/qualifications/${leadId}/background-job?type=${jobType}`
    : `/api/qualifications/${leadId}/background-job`;

  // Fetch with abort support and race condition prevention
  const fetchJobStatus = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl, {
        signal: abortControllerRef.current.signal,
      });

      // Check if still mounted before updating state
      if (!mountedRef.current) return;

      if (!response.ok) {
        if (response.status === 404) {
          setJob(null);
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch background job status: ${response.statusText}`);
      }

      const data = (await response.json()) as { job: BackgroundJob | null };

      // Final mounted check before state updates
      if (mountedRef.current) {
        setJob(data.job);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      if (mountedRef.current) {
        console.error('[useBackgroundJobStatus] Error fetching job status:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      isFetchingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiUrl]);

  // Reset state
  const reset = useCallback(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setJob(null);
    setIsLoading(true);
    setError(null);
  }, []);

  // Track component mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Page Visibility API
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pauseOnHidden]);

  // Consolidated polling effect (replaces initial fetch + polling + visibility refetch)
  useEffect(() => {
    if (!enabled) {
      setIsPolling(false);
      return;
    }

    // Determine if we should be polling
    const shouldPoll =
      !(pauseOnHidden && !isVisible) && // Not paused due to hidden tab
      !(job && ['completed', 'failed', 'cancelled'].includes(job.status)); // Not terminal

    setIsPolling(shouldPoll);

    if (!shouldPoll) return;

    // Initial fetch
    void fetchJobStatus();

    // Set up polling interval
    const interval = setInterval(() => {
      void fetchJobStatus();
    }, pollingInterval);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, job?.status, pollingInterval, fetchJobStatus, pauseOnHidden, isVisible]);

  return {
    job,
    isLoading,
    error,
    isPolling,
    isVisible,
    refetch: fetchJobStatus,
    reset,
  };
}

// ============================================================================
// Helper: Check if job is in progress
// ============================================================================

export function isJobInProgress(job: BackgroundJob | null): boolean {
  return job !== null && ['pending', 'running'].includes(job.status);
}

// ============================================================================
// Helper: Get quality badge for confidence score
// ============================================================================

export type QualityLevel = 'excellent' | 'good' | 'acceptable' | 'needs-improvement' | 'low';

export function getQualityLevel(confidence: number): QualityLevel {
  if (confidence >= 90) return 'excellent';
  if (confidence >= 80) return 'good';
  if (confidence >= 60) return 'acceptable';
  if (confidence >= 40) return 'needs-improvement';
  return 'low';
}
