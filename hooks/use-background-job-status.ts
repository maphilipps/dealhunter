'use client';

import { useEffect, useState, useCallback } from 'react';

import type { BackgroundJob } from '@/components/background-jobs/job-progress-card';

interface UseBackgroundJobStatusOptions {
  leadId: string;
  pollingInterval?: number; // milliseconds
  enabled?: boolean;
}

interface UseBackgroundJobStatusResult {
  job: BackgroundJob | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useBackgroundJobStatus({
  leadId,
  pollingInterval = 2000, // Poll every 2 seconds
  enabled = true,
}: UseBackgroundJobStatusOptions): UseBackgroundJobStatusResult {
  const [job, setJob] = useState<BackgroundJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/qualifications/${leadId}/background-job`);

      if (!response.ok) {
        if (response.status === 404) {
          // No job found - this is expected for some leads
          setJob(null);
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch background job status: ${response.statusText}`);
      }

      const data = (await response.json()) as { job: BackgroundJob | null };
      setJob(data.job);
      setError(null);
    } catch (err) {
      console.error('[useBackgroundJobStatus] Error fetching job status:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;
    void fetchJobStatus();
  }, [enabled, fetchJobStatus]);

  // Polling
  useEffect(() => {
    if (!enabled) return;

    // Don't poll if job is completed, failed, or cancelled
    if (job && ['completed', 'failed', 'cancelled'].includes(job.status)) {
      return;
    }

    const interval = setInterval(() => {
      void fetchJobStatus();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [enabled, job, pollingInterval, fetchJobStatus]);

  return {
    job,
    isLoading,
    error,
    refetch: () => {
      void fetchJobStatus();
    },
  };
}
