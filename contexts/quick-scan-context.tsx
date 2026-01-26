'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type QuickScanStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';

export interface QuickScanJob {
  id: string;
  status: QuickScanStatus;
  progress: number | null;
  currentStep: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}

interface QuickScanContextValue {
  status: QuickScanStatus;
  job: QuickScanJob | null;
  isInProgress: boolean;
  progress: number;
  currentStep: string | null;
  error: Error | null;
  startQuickScan: () => Promise<void>;
  refetch: () => Promise<void>;
}

const QuickScanContext = createContext<QuickScanContextValue | null>(null);

export interface QuickScanProviderProps {
  preQualificationId: string;
  initialJob: QuickScanJob | null;
  children: React.ReactNode;
}

export function QuickScanProvider({
  preQualificationId,
  initialJob,
  children,
}: QuickScanProviderProps) {
  const [job, setJob] = useState<QuickScanJob | null>(initialJob);
  const [error, setError] = useState<Error | null>(null);

  const status: QuickScanStatus = job?.status || 'idle';
  const isInProgress = status === 'pending' || status === 'running';
  const progress = job?.progress || 0;
  const currentStep = job?.currentStep || null;

  // Poll for job status when in progress
  useEffect(() => {
    if (!isInProgress) return;

    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/pre-qualifications/${preQualificationId}/background-job`
          );
          if (!response.ok) throw new Error('Failed to fetch job status');

          const data = await response.json();
          if (data.job) {
            setJob(data.job);

            // Stop polling when completed or failed
            if (data.job.status === 'completed' || data.job.status === 'failed') {
              clearInterval(pollInterval);
            }
          }
        } catch (err) {
          console.error('[QuickScan Context] Poll error:', err);
          setError(err instanceof Error ? err : new Error('Failed to poll job status'));
          clearInterval(pollInterval);
        }
      })();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [preQualificationId, isInProgress]);

  async function refetch() {
    try {
      const response = await fetch(`/api/pre-qualifications/${preQualificationId}/background-job`);
      if (!response.ok) throw new Error('Failed to fetch job status');

      const data = await response.json();
      setJob(data.job || null);
      setError(null);
    } catch (err) {
      console.error('[QuickScan Context] Refetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to refetch job'));
    }
  }

  async function startQuickScan() {
    try {
      setError(null);

      const response = await fetch(`/api/pre-qualifications/${preQualificationId}/quick-scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start quick scan');
      }

      const data = await response.json();

      // Start polling for the new job
      await refetch();
    } catch (err) {
      console.error('[QuickScan Context] Start error:', err);
      setError(err instanceof Error ? err : new Error('Failed to start quick scan'));
      throw err;
    }
  }

  return (
    <QuickScanContext.Provider
      value={{
        status,
        job,
        isInProgress,
        progress,
        currentStep,
        error,
        startQuickScan,
        refetch,
      }}
    >
      {children}
    </QuickScanContext.Provider>
  );
}

export function useQuickScan() {
  const context = useContext(QuickScanContext);
  if (!context) {
    throw new Error('useQuickScan must be used within QuickScanProvider');
  }
  return context;
}
