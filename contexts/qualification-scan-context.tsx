'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type QualificationScanStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';
/** @deprecated Use QualificationScanStatus */
export type LeadScanStatus = QualificationScanStatus;
/** @deprecated Use QualificationScanStatus */
export type QuickScanStatus = QualificationScanStatus;

export interface QualificationScanJob {
  id: string;
  status: QualificationScanStatus;
  progress: number | null;
  currentStep: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}
/** @deprecated Use QualificationScanJob */
export type LeadScanJob = QualificationScanJob;
/** @deprecated Use QualificationScanJob */
export type QuickScanJob = QualificationScanJob;

interface QualificationScanContextValue {
  status: QualificationScanStatus;
  job: QualificationScanJob | null;
  isInProgress: boolean;
  progress: number;
  currentStep: string | null;
  error: Error | null;
  startQualificationScan: () => Promise<void>;
  refetch: () => Promise<void>;
}

const QualificationScanContext = createContext<QualificationScanContextValue | null>(null);

export interface QualificationScanProviderProps {
  qualificationId: string;
  initialJob: QualificationScanJob | null;
  children: React.ReactNode;
}
/** @deprecated Use QualificationScanProviderProps */
export type LeadScanProviderProps = QualificationScanProviderProps;
/** @deprecated Use QualificationScanProviderProps */
export type QuickScanProviderProps = QualificationScanProviderProps;

export function QualificationScanProvider({
  qualificationId,
  initialJob,
  children,
}: QualificationScanProviderProps) {
  const [job, setJob] = useState<QualificationScanJob | null>(initialJob);
  const [error, setError] = useState<Error | null>(null);

  const status: QualificationScanStatus = job?.status || 'idle';
  const isInProgress = status === 'pending' || status === 'running';
  const progress = job?.progress || 0;
  const currentStep = job?.currentStep || null;

  // Poll for job status when in progress
  useEffect(() => {
    if (!isInProgress) return;

    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/qualifications/${qualificationId}/background-job`);
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
          console.error('[QualificationScan Context] Poll error:', err);
          setError(err instanceof Error ? err : new Error('Failed to poll job status'));
          clearInterval(pollInterval);
        }
      })();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [qualificationId, isInProgress]);

  async function refetch() {
    try {
      const response = await fetch(`/api/qualifications/${qualificationId}/background-job`);
      if (!response.ok) throw new Error('Failed to fetch job status');

      const data = await response.json();
      setJob(data.job || null);
      setError(null);
    } catch (err) {
      console.error('[QualificationScan Context] Refetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to refetch job'));
    }
  }

  async function startQualificationScan() {
    const err = new Error('Scan startet automatisch. Manuelles Starten ist deaktiviert.');
    setError(err);
    throw err;
  }

  return (
    <QualificationScanContext.Provider
      value={{
        status,
        job,
        isInProgress,
        progress,
        currentStep,
        error,
        startQualificationScan,
        refetch,
      }}
    >
      {children}
    </QualificationScanContext.Provider>
  );
}

/** @deprecated Use QualificationScanProvider */
export const LeadScanProvider = QualificationScanProvider;
/** @deprecated Use QualificationScanProvider */
export const QuickScanProvider = QualificationScanProvider;

export function useQualificationScan() {
  const context = useContext(QualificationScanContext);
  if (!context) {
    throw new Error('useQualificationScan must be used within QualificationScanProvider');
  }
  return context;
}

/** @deprecated Use useQualificationScan */
export const useLeadScan = useQualificationScan;
/** @deprecated Use useQualificationScan */
export const useQuickScan = useQualificationScan;
