'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

import { AgentEventType } from '@/lib/streaming/event-types';
import type {
  QualificationScanPhase,
  StepCompleteData,
  StepStartData,
  WorkflowProgressData,
} from '@/lib/streaming/event-types';

// ====== Types ======

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface StepState {
  stepId: string;
  stepName: string;
  phase: QualificationScanPhase;
  status: StepStatus;
  duration?: number;
  error?: string;
  result?: unknown;
}

export interface QualificationScanProgressState {
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error';
  progress: number;
  steps: Map<string, StepState>;
  completedSteps: string[];
  currentSteps: string[];
  totalSteps: number;
  currentMessage: string | null;
  error: string | null;
  isConnected: boolean;
}

interface UseQualificationScanProgressOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
  onStepComplete?: (stepId: string, result: unknown) => void;
}

/**
 * SSE hook for tracking Qualification Scan progress.
 * Connects to the stream endpoint and provides real-time step-level updates.
 *
 * Based on the pitch-scan progress hook pattern but adapted for
 * the workflow engine's STEP_START/STEP_COMPLETE/WORKFLOW_PROGRESS events.
 */
export function useQualificationScanProgress(
  qualificationId: string | null,
  options: UseQualificationScanProgressOptions = {}
): QualificationScanProgressState {
  const { onComplete, onError, onStepComplete } = options;

  const [state, setState] = useState<QualificationScanProgressState>(() => ({
    status: 'idle',
    progress: 0,
    steps: new Map(),
    completedSteps: [],
    currentSteps: [],
    totalSteps: 0,
    currentMessage: null,
    error: null,
    isConnected: false,
  }));

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Stable refs for callbacks
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onStepCompleteRef = useRef(onStepComplete);
  onStepCompleteRef.current = onStepComplete;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!qualificationId) return;

    setState(prev => ({ ...prev, status: 'connecting' }));

    const connect = () => {
      const eventSource = new EventSource(
        `/api/qualifications/${qualificationId}/quick-scan/stream`
      );
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true, status: 'running' }));
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (e: MessageEvent) => {
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(e.data);
        } catch {
          return;
        }

        const type = raw.type;
        const data = raw.data as Record<string, unknown> | undefined;

        if (type === AgentEventType.STEP_START) {
          const stepData = data as unknown as StepStartData;
          setState(prev => {
            const steps = new Map(prev.steps);
            steps.set(stepData.stepId, {
              stepId: stepData.stepId,
              stepName: stepData.stepName,
              phase: stepData.phase,
              status: 'running',
            });
            return {
              ...prev,
              steps,
              currentSteps: [...prev.currentSteps, stepData.stepId],
              currentMessage: `${stepData.stepName} wird ausgefuehrt...`,
            };
          });
          return;
        }

        if (type === AgentEventType.STEP_COMPLETE) {
          const stepData = data as unknown as StepCompleteData;
          setState(prev => {
            const steps = new Map(prev.steps);
            steps.set(stepData.stepId, {
              stepId: stepData.stepId,
              stepName: stepData.stepName,
              phase: stepData.phase,
              status: stepData.success ? 'completed' : 'failed',
              duration: stepData.duration,
              error: stepData.error,
              result: stepData.result,
            });
            const completedSteps = stepData.success
              ? [...prev.completedSteps, stepData.stepId]
              : prev.completedSteps;
            return {
              ...prev,
              steps,
              completedSteps,
              currentSteps: prev.currentSteps.filter(s => s !== stepData.stepId),
              currentMessage: stepData.success
                ? `${stepData.stepName} abgeschlossen`
                : `${stepData.stepName} fehlgeschlagen`,
            };
          });

          if (stepData.success) {
            onStepCompleteRef.current?.(stepData.stepId, stepData.result);
          }
          return;
        }

        if (type === AgentEventType.WORKFLOW_PROGRESS) {
          const progressData = data as unknown as WorkflowProgressData;
          setState(prev => ({
            ...prev,
            progress: progressData.percentage,
            totalSteps: progressData.totalSteps,
            currentSteps: progressData.currentSteps,
          }));
          return;
        }

        if (type === AgentEventType.COMPLETE || type === 'complete') {
          setState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            currentMessage: null,
            isConnected: false,
          }));
          disconnect();
          onCompleteRef.current?.();
          return;
        }

        if (type === AgentEventType.ERROR || type === 'error') {
          const message =
            (data as { message?: string })?.message ?? 'Qualification Scan fehlgeschlagen';
          setState(prev => ({
            ...prev,
            status: 'error',
            error: message,
            currentMessage: null,
            isConnected: false,
          }));
          disconnect();
          onErrorRef.current?.(message);
          return;
        }

        // Also handle agent-complete for backwards compatibility with polling SSE
        if (type === AgentEventType.AGENT_COMPLETE || type === 'agent-complete') {
          setState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            currentMessage: null,
            isConnected: false,
          }));
          disconnect();
          onCompleteRef.current?.();
        }
      };

      eventSource.onerror = () => {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);

          setState(prev => ({ ...prev, isConnected: false }));

          reconnectTimeoutRef.current = setTimeout(() => {
            disconnect();
            connect();
          }, delay);
        } else {
          setState(prev => ({
            ...prev,
            status: 'error',
            error: 'Verbindung verloren. Bitte Seite neu laden.',
            isConnected: false,
          }));
          disconnect();
        }
      };
    };

    connect();

    return () => {
      disconnect();
    };
  }, [qualificationId, disconnect]);

  return state;
}
