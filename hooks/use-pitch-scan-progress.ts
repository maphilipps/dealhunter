'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

import type { ProgressEvent, SnapshotEvent } from '@/lib/pitch/types';
import type { PitchScanSectionId } from '@/lib/pitch-scan/section-ids';
import { PHASE_DEFINITIONS } from '@/lib/pitch-scan/constants';

// ====== Phase Definitions ======

export type PitchScanPhaseId = PitchScanSectionId;
export type PhaseStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface PhaseAgent {
  name: string;
  label: string;
  confidence?: number;
  status: PhaseStatus;
}

export interface PitchScanPhase {
  id: PitchScanPhaseId;
  label: string;
  status: PhaseStatus;
  agents: PhaseAgent[];
}

export interface PitchScanProgressState {
  status: 'idle' | 'connecting' | 'running' | 'completed' | 'error';
  progress: number;
  phases: PitchScanPhase[];
  currentMessage: string | null;
  error: string | null;
  isConnected: boolean;
  startedAt: string | null;
}

interface UsePitchScanProgressOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const PHASE_DEFS: ReadonlyArray<{
  id: PitchScanPhaseId;
  label: string;
  agents: ReadonlyArray<{ name: string; label: string }>;
}> = PHASE_DEFINITIONS.map(def => ({
  id: def.id as PitchScanPhaseId,
  label: def.label,
  agents: [{ name: def.id, label: def.label }],
}));

const PHASE_ORDER: PitchScanPhaseId[] = PHASE_DEFS.map(p => p.id);

function createDefaultPhases(): PitchScanPhase[] {
  return PHASE_DEFS.map(def => ({
    id: def.id,
    label: def.label,
    status: 'pending' as PhaseStatus,
    agents: def.agents.map(a => ({
      name: a.name,
      label: a.label,
      status: 'pending' as PhaseStatus,
    })),
  }));
}

/**
 * Derive phase structure from a DB snapshot. Pure function.
 */
function applySnapshot(snapshot: SnapshotEvent): PitchScanPhase[] {
  const phases = createDefaultPhases();
  const { completedAgents, failedAgents, agentConfidences, currentPhase } = snapshot;

  const currentPhaseIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase as PitchScanPhaseId) : -1;

  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi];

    // Set individual agent statuses
    for (const agent of phase.agents) {
      if (completedAgents.includes(agent.name)) {
        agent.status = 'completed';
        agent.confidence = agentConfidences[agent.name];
      } else if (failedAgents.includes(agent.name)) {
        agent.status = 'failed';
      } else if (pi === currentPhaseIdx) {
        agent.status = 'active';
      }
    }

    // Derive phase-level status
    const allCompleted = phase.agents.every(a => a.status === 'completed');
    const anyFailed = phase.agents.some(a => a.status === 'failed');
    const anyActive = phase.agents.some(a => a.status === 'active');

    if (allCompleted) {
      phase.status = 'completed';
    } else if (anyFailed) {
      phase.status = 'failed';
    } else if (anyActive || pi === currentPhaseIdx) {
      phase.status = 'active';
    } else if (pi < currentPhaseIdx) {
      // Phases before the current one that aren't fully complete yet
      phase.status = 'completed';
    }
    // else: stays 'pending'
  }

  return phases;
}

export function usePitchScanProgress(
  pitchId: string | null,
  options: UsePitchScanProgressOptions = {}
): PitchScanProgressState {
  const { onComplete, onError } = options;

  const [state, setState] = useState<PitchScanProgressState>(() => ({
    status: 'idle',
    progress: 0,
    phases: createDefaultPhases(),
    currentMessage: null,
    error: null,
    isConnected: false,
    startedAt: null,
  }));

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
    if (!pitchId) return;

    setState(prev => ({ ...prev, status: 'connecting' }));

    const eventSource = new EventSource(`/api/pitches/${pitchId}/progress`);
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

      if (raw.type === 'connected') {
        return;
      }

      // Handle snapshot events (DB hydration)
      if (raw.type === 'snapshot') {
        const snapshot = raw as unknown as SnapshotEvent;
        const phases = applySnapshot(snapshot);
        const isTerminal = ['completed', 'failed'].includes(snapshot.status);

        setState(prev => ({
          ...prev,
          progress: snapshot.progress,
          phases,
          startedAt: snapshot.startedAt,
          currentMessage: snapshot.currentStep,
          ...(isTerminal && {
            status: snapshot.status === 'completed' ? 'completed' : 'error',
            isConnected: false,
            ...(snapshot.status === 'failed' && { error: snapshot.currentStep }),
          }),
        }));

        if (snapshot.status === 'completed') {
          disconnect();
          onCompleteRef.current?.();
        } else if (snapshot.status === 'failed') {
          disconnect();
          onErrorRef.current?.(snapshot.currentStep ?? 'Pipeline fehlgeschlagen');
        }
        return;
      }

      const event = raw as unknown as ProgressEvent;

      switch (event.type) {
        case 'phase_start':
        case 'agent_start':
          setState(prev => ({
            ...prev,
            progress: event.progress ?? prev.progress,
            currentMessage: event.message,
            phases: prev.phases.map(p => {
              if (p.id !== event.phase) {
                // Phases before the active one should be completed
                const phaseIdx = PHASE_ORDER.indexOf(p.id);
                const activeIdx = PHASE_ORDER.indexOf(event.phase as PitchScanPhaseId);
                if (activeIdx >= 0 && phaseIdx < activeIdx && p.status !== 'completed') {
                  return {
                    ...p,
                    status: 'completed' as PhaseStatus,
                    agents: p.agents.map(a =>
                      a.status === 'pending' || a.status === 'active'
                        ? { ...a, status: 'completed' as PhaseStatus }
                        : a
                    ),
                  };
                }
                return p;
              }
              // Mark the matching phase + agent as active
              return {
                ...p,
                status: 'active' as PhaseStatus,
                agents: p.agents.map(a =>
                  event.agent && a.name === event.agent
                    ? { ...a, status: 'active' as PhaseStatus }
                    : a
                ),
              };
            }),
          }));
          break;

        case 'complete':
          setState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            phases: prev.phases.map(p => ({
              ...p,
              status: 'completed',
              agents: p.agents.map(a => ({ ...a, status: 'completed' as PhaseStatus })),
            })),
            currentMessage: null,
            isConnected: false,
          }));
          disconnect();
          onCompleteRef.current?.();
          return;

        case 'error':
          setState(prev => ({
            ...prev,
            status: 'error',
            error: event.message,
            currentMessage: null,
            isConnected: false,
          }));
          disconnect();
          onErrorRef.current?.(event.message);
          return;

        default:
          // Other events (question, answer_received, etc.) — update progress if present
          setState(prev => ({
            ...prev,
            progress: event.progress ?? prev.progress,
          }));
          break;
      }
    };

    eventSource.onerror = () => {
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);

        setState(prev => ({ ...prev, isConnected: false }));

        reconnectTimeoutRef.current = setTimeout(() => {
          disconnect();
          const es = new EventSource(`/api/pitches/${pitchId}/progress`);
          eventSourceRef.current = es;
          es.onopen = eventSource.onopen;
          es.onmessage = eventSource.onmessage;
          es.onerror = eventSource.onerror;
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

    return () => {
      disconnect();
    };
  }, [pitchId, disconnect]);

  return state;
}
