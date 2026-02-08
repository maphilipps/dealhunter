'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

import type { ProgressEvent, SnapshotEvent } from '@/lib/pitch/types';
import { PHASE_DEFINITIONS } from '@/lib/pitch-scan/constants';
import type { PitchScanSectionId } from '@/lib/pitch-scan/section-ids';
import type { PitchScanNormalizedEvent } from '@/lib/streaming/in-process/pitch-scan-events';
import {
  normalizePitchScanEvent,
  isVisiblePitchScanEvent,
  PitchScanEventType,
} from '@/lib/streaming/in-process/pitch-scan-events';

// ====== Phase Definitions ======

export type PitchScanPhaseId = string;
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
  /** Ordered stream of visible events (bounded). */
  events: PitchScanNormalizedEvent[];
  runId: string | null;
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
  id: PitchScanSectionId;
  label: string;
  agents: ReadonlyArray<{ name: string; label: string }>;
}> = PHASE_DEFINITIONS.map(def => ({
  id: def.id,
  label: def.label,
  agents: [{ name: def.id, label: def.label }],
}));

function createLegacyDefaultPhases(): PitchScanPhase[] {
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

function createPhasesFromPlanPayload(enabledPhases: unknown): PitchScanPhase[] | null {
  if (!Array.isArray(enabledPhases) || enabledPhases.length === 0) return null;

  const phases: PitchScanPhase[] = [];
  for (const p of enabledPhases) {
    if (!p || typeof p !== 'object') continue;
    const obj = p as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : null;
    const label = typeof obj.label === 'string' ? obj.label : id;
    if (!id || !label) continue;
    phases.push({
      id,
      label,
      status: 'pending',
      agents: [{ name: id, label, status: 'pending' }],
    });
  }

  return phases.length > 0 ? phases : null;
}

/**
 * Derive phase structure from a DB snapshot. Pure function.
 */
function applySnapshot(phases: PitchScanPhase[], snapshot: SnapshotEvent): PitchScanPhase[] {
  const { completedAgents, failedAgents, agentConfidences, currentPhase } = snapshot;

  const byId = new Map(phases.map(p => [p.id, p]));

  for (const phase of phases) {
    for (const agent of phase.agents) {
      if (completedAgents.includes(agent.name)) {
        agent.status = 'completed';
        agent.confidence = agentConfidences[agent.name];
      } else if (failedAgents.includes(agent.name)) {
        agent.status = 'failed';
      } else {
        agent.status = 'pending';
        agent.confidence = undefined;
      }
    }

    const allCompleted = phase.agents.every(a => a.status === 'completed');
    const anyFailed = phase.agents.some(a => a.status === 'failed');
    if (allCompleted) phase.status = 'completed';
    else if (anyFailed) phase.status = 'failed';
    else phase.status = 'pending';
  }

  // Mark active phase from snapshot if present.
  if (currentPhase && byId.has(currentPhase)) {
    const active = byId.get(currentPhase)!;
    active.status = 'active';
    active.agents = active.agents.map(a => ({ ...a, status: 'active' }));
  } else if (snapshot.status === 'running') {
    // Otherwise, best-effort: first pending phase is active.
    const firstPending = phases.find(p => p.status === 'pending');
    if (firstPending) {
      firstPending.status = 'active';
      firstPending.agents = firstPending.agents.map(a => ({ ...a, status: 'active' }));
    }
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
    phases: createLegacyDefaultPhases(),
    events: [],
    runId: null,
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
      if (typeof e.data !== 'string') return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(e.data) as unknown;
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== 'object') return;
      const raw = parsed as Record<string, unknown>;
      const rawType = typeof raw.type === 'string' ? raw.type : null;

      // Plan event: update phase list to match enabled phases.
      if (rawType === PitchScanEventType.PLAN_CREATED) {
        const nextPhases = createPhasesFromPlanPayload(raw.enabledPhases);
        if (nextPhases) {
          setState(prev => {
            // Preserve any known statuses/confidence by id.
            const prevById = new Map(prev.phases.map(p => [p.id, p]));
            const merged = nextPhases.map(p => {
              const existing = prevById.get(p.id);
              if (!existing) return p;
              const agent = existing.agents[0];
              return {
                ...p,
                status: existing.status,
                agents: [
                  {
                    ...p.agents[0],
                    status: agent?.status ?? p.agents[0].status,
                    confidence: agent?.confidence,
                  },
                ],
              };
            });
            return { ...prev, phases: merged };
          });
        }
      }

      // Normalize and store visible events for chat rendering.
      // Snapshot events are handled separately below.
      if (rawType !== 'snapshot') {
        const normalized = normalizePitchScanEvent(raw);
        if (normalized) {
          if (normalized.type === PitchScanEventType.CONNECTED) {
            const runId = typeof normalized.raw.runId === 'string' ? normalized.raw.runId : null;
            setState(prev => ({ ...prev, runId }));
            return;
          }

          if (isVisiblePitchScanEvent(normalized)) {
            setState(prev => {
              const next = [...prev.events, normalized];
              // Bound in-memory event list to avoid unbounded growth.
              const maxEvents = 200;
              const bounded = next.length > maxEvents ? next.slice(next.length - maxEvents) : next;
              return { ...prev, events: bounded };
            });
          }
        }
      }

      // Handle snapshot events (DB hydration)
      if (rawType === 'snapshot') {
        const snapshot = raw as unknown as SnapshotEvent;
        const isTerminal = ['completed', 'failed'].includes(snapshot.status);

        setState(prev => {
          const phases = applySnapshot(
            prev.phases.map(p => ({ ...p, agents: p.agents.map(a => ({ ...a })) })),
            snapshot
          );

          return {
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
          };
        });

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
                const phaseIdx = prev.phases.findIndex(x => x.id === p.id);
                const activeIdx = prev.phases.findIndex(x => x.id === (event.phase as string));
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
