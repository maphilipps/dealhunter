/**
 * Sprint 4.2: React Hook for Job Progress
 *
 * Consumes SSE stream and provides real-time job progress updates.
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

import type { JobProgressEvent } from '@/lib/realtime/event-stream';

export interface JobProgressState {
  progress: number; // 0-100
  phase: string | null; // 'scraping' | 'phase2' | 'phase3' | null
  currentStep: string | null;
  completedSteps: string[];
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error';
  error: string | null;
  result: unknown;
  isConnected: boolean;
}

export interface UseJobProgressOptions {
  /**
   * Whether to auto-connect on mount
   * @default true
   */
  autoConnect?: boolean;

  /**
   * Callback when job completes
   */
  onComplete?: (result: unknown) => void;

  /**
   * Callback when job errors
   */
  onError?: (error: string) => void;

  /**
   * Callback on each progress update
   */
  onProgress?: (progress: number) => void;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Hook for consuming SSE job progress updates
 *
 * @example
 * ```tsx
 * const { progress, currentStep, status, error } = useJobProgress(jobId, {
 *   onComplete: (result) => {
 *     console.log('Job completed:', result);
 *     router.refresh();
 *   },
 *   onError: (error) => toast.error(error),
 * });
 *
 * return (
 *   <div>
 *     {status === 'running' && (
 *       <>
 *         <Progress value={progress} />
 *         <p>{currentStep}</p>
 *       </>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useJobProgress(
  jobId: string | null,
  options: UseJobProgressOptions = {}
): JobProgressState & {
  connect: () => void;
  disconnect: () => void;
  reset: () => void;
} {
  const { autoConnect = true, onComplete, onError, onProgress, debug = false } = options;

  const [state, setState] = useState<JobProgressState>({
    progress: 0,
    phase: null,
    currentStep: null,
    completedSteps: [],
    status: 'idle',
    error: null,
    result: null,
    isConnected: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[useJobProgress]', ...args);
      }
    },
    [debug]
  );

  const disconnect = useCallback(() => {
    log('Disconnecting from SSE');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false }));
  }, [log]);

  const connect = useCallback(() => {
    if (!jobId) {
      log('No jobId provided, skipping connection');
      return;
    }

    if (eventSourceRef.current) {
      log('Already connected, skipping');
      return;
    }

    log('Connecting to SSE:', jobId);
    setState(prev => ({ ...prev, status: 'connecting' }));

    const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.onopen = () => {
      log('SSE connection opened');
      setState(prev => ({ ...prev, isConnected: true, status: 'running' }));
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
    };

    // Heartbeat event
    eventSource.addEventListener('heartbeat', () => {
      log('Received heartbeat');
      // Keep connection alive
    });

    // Progress event
    eventSource.addEventListener('progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as JobProgressEvent['data'];
      log('Progress update:', data);

      setState(prev => ({
        ...prev,
        progress: data.progress ?? prev.progress,
        currentStep: data.currentStep ?? prev.currentStep,
      }));

      if (data.progress !== undefined && onProgress) {
        onProgress(data.progress);
      }
    });

    // Phase event
    eventSource.addEventListener('phase', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as JobProgressEvent['data'];
      log('Phase change:', data);

      setState(prev => ({
        ...prev,
        phase: data.phase ?? prev.phase,
        completedSteps: data.completedSteps ?? prev.completedSteps,
      }));
    });

    // Step event
    eventSource.addEventListener('step', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as JobProgressEvent['data'];
      log('Step update:', data);

      setState(prev => ({
        ...prev,
        currentStep: data.currentStep ?? prev.currentStep,
        progress: data.progress ?? prev.progress,
      }));
    });

    // Complete event
    eventSource.addEventListener('complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as JobProgressEvent['data'];
      log('Job completed:', data);

      setState(prev => ({
        ...prev,
        progress: 100,
        status: 'completed',
        result: data.result ?? null,
        isConnected: false,
      }));

      if (onComplete) {
        onComplete(data.result);
      }

      disconnect();
    });

    // Error event
    eventSource.addEventListener('error', (e: MessageEvent) => {
      const data = e.data ? (JSON.parse(e.data) as JobProgressEvent['data']) : {};
      const errorMessage = data.error || 'Connection error';
      log('Job error:', errorMessage);

      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        isConnected: false,
      }));

      if (onError) {
        onError(errorMessage);
      }

      disconnect();
    });

    // Connection error (network issue, server restart, etc.)
    eventSource.onerror = error => {
      log('SSE connection error:', error);

      // Auto-reconnect with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000); // Max 30s
        log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          disconnect();
          connect();
        }, delay);
      } else {
        log('Max reconnect attempts reached');
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Connection lost. Please refresh the page.',
          isConnected: false,
        }));
        disconnect();
      }
    };
  }, [jobId, log, onComplete, onError, onProgress, disconnect]);

  const reset = useCallback(() => {
    log('Resetting state');
    disconnect();
    setState({
      progress: 0,
      phase: null,
      currentStep: null,
      completedSteps: [],
      status: 'idle',
      error: null,
      result: null,
      isConnected: false,
    });
  }, [disconnect, log]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && jobId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [jobId, autoConnect, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    reset,
  };
}

/**
 * Hook for monitoring multiple jobs simultaneously
 *
 * @example
 * ```tsx
 * const jobs = useMultiJobProgress([jobId1, jobId2, jobId3]);
 *
 * return (
 *   <div>
 *     {jobs.map((job) => (
 *       <JobCard key={job.jobId} {...job} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useMultiJobProgress(
  jobIds: string[],
  options: Omit<UseJobProgressOptions, 'onComplete' | 'onError'> & {
    onJobComplete?: (jobId: string, result: unknown) => void;
    onJobError?: (jobId: string, error: string) => void;
  } = {}
): Map<string, JobProgressState> {
  const { onJobComplete, onJobError, debug = false } = options;

  const [jobStates, setJobStates] = useState<Map<string, JobProgressState>>(
    new Map(
      jobIds.map(id => [
        id,
        {
          progress: 0,
          phase: null,
          currentStep: null,
          completedSteps: [],
          status: 'idle',
          error: null,
          result: null,
          isConnected: false,
        },
      ])
    )
  );

  const eventSourceRef = useRef<EventSource | null>(null);

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[useMultiJobProgress]', ...args);
      }
    },
    [debug]
  );

  useEffect(() => {
    if (jobIds.length === 0) return;

    log('Connecting to multi-job SSE:', jobIds);
    const eventSource = new EventSource(`/api/jobs/stream?ids=${jobIds.join(',')}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      const event = JSON.parse(e.data) as { jobId: string } & JobProgressEvent['data'];
      log('Progress update for', event.jobId);

      setJobStates(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(event.jobId);
        if (current) {
          newMap.set(event.jobId, {
            ...current,
            progress: event.progress ?? current.progress,
            currentStep: event.currentStep ?? current.currentStep,
            status: 'running',
            isConnected: true,
          });
        }
        return newMap;
      });
    });

    eventSource.addEventListener('complete', (e: MessageEvent) => {
      const event = JSON.parse(e.data) as { jobId: string } & JobProgressEvent['data'];
      log('Job completed:', event.jobId);

      setJobStates(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(event.jobId);
        if (current) {
          newMap.set(event.jobId, {
            ...current,
            progress: 100,
            status: 'completed',
            result: event.result ?? null,
          });
        }
        return newMap;
      });

      if (onJobComplete) {
        onJobComplete(event.jobId, event.result);
      }
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
      const event = JSON.parse(e.data) as { jobId: string } & JobProgressEvent['data'];
      log('Job error:', event.jobId, event.error);

      setJobStates(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(event.jobId);
        if (current) {
          newMap.set(event.jobId, {
            ...current,
            status: 'error',
            error: event.error || 'Unknown error',
          });
        }
        return newMap;
      });

      if (onJobError && event.error) {
        onJobError(event.jobId, event.error);
      }
    });

    return () => {
      log('Disconnecting multi-job SSE');
      eventSource.close();
    };
  }, [jobIds, log, onJobComplete, onJobError]);

  return jobStates;
}
