'use client';

import { useReducer, useRef, useCallback, useEffect } from 'react';

import type {
  QualificationProcessingEvent,
  QualificationPhaseId,
} from '@/lib/streaming/redis/qualification-events';
import {
  QualificationEventType,
  QUALIFICATION_PHASES,
  isTerminalEvent,
} from '@/lib/streaming/redis/qualification-events';

// ============================================================================
// Constants
// ============================================================================

const MAX_EVENTS = 200;
const BATCH_INTERVAL_MS = 100;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;

// ============================================================================
// Types
// ============================================================================

export type PhaseStatus = 'pending' | 'active' | 'completed' | 'error';

export interface PhaseState {
  id: QualificationPhaseId;
  label: string;
  description: string;
  status: PhaseStatus;
  progress?: number;
  message?: string;
}

export interface QualificationStreamState {
  events: QualificationProcessingEvent[];
  phases: PhaseState[];
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  progress: number;
  currentPhase: QualificationPhaseId | null;
}

// ============================================================================
// Reducer
// ============================================================================

type Action =
  | { type: 'ADD_EVENTS_BATCH'; events: QualificationProcessingEvent[] }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

function buildInitialPhases(): PhaseState[] {
  return QUALIFICATION_PHASES.map(phase => ({
    id: phase.id,
    label: phase.label,
    description: phase.description,
    status: 'pending' as PhaseStatus,
  }));
}

function processEvents(
  state: QualificationStreamState,
  newEvents: QualificationProcessingEvent[]
): QualificationStreamState {
  const allEvents = [...state.events, ...newEvents];
  const events =
    allEvents.length > MAX_EVENTS ? allEvents.slice(allEvents.length - MAX_EVENTS) : allEvents;

  let phases = state.phases.map(p => ({ ...p }));
  let isComplete = state.isComplete;
  let error = state.error;
  let isStreaming = state.isStreaming;
  let progress = state.progress;
  let currentPhase = state.currentPhase;

  for (const event of newEvents) {
    switch (event.type) {
      case QualificationEventType.PHASE_START: {
        if (event.phase) {
          currentPhase = event.phase;
          phases = phases.map(p =>
            p.id === event.phase
              ? { ...p, status: 'active' as PhaseStatus, message: event.data?.message }
              : p
          );
        }
        if (event.progress !== undefined) progress = event.progress;
        break;
      }

      case QualificationEventType.PHASE_COMPLETE: {
        if (event.phase) {
          phases = phases.map(p =>
            p.id === event.phase ? { ...p, status: 'completed' as PhaseStatus } : p
          );
        }
        if (event.progress !== undefined) progress = event.progress;
        break;
      }

      case QualificationEventType.PHASE_ERROR: {
        if (event.phase) {
          phases = phases.map(p =>
            p.id === event.phase
              ? { ...p, status: 'error' as PhaseStatus, message: event.data?.error }
              : p
          );
        }
        break;
      }

      case QualificationEventType.AGENT_PROGRESS: {
        if (event.phase) {
          phases = phases.map(p =>
            p.id === event.phase ? { ...p, message: event.data?.message } : p
          );
        }
        if (event.progress !== undefined) progress = event.progress;
        break;
      }

      case QualificationEventType.SECTION_COMPLETE: {
        if (event.data?.completedSections && event.data?.totalSections) {
          const sectionProgress = Math.round(
            (event.data.completedSections / event.data.totalSections) * 100
          );
          // Update section orchestration phase progress
          phases = phases.map(p =>
            p.id === 'section_orchestration'
              ? {
                  ...p,
                  progress: sectionProgress,
                  message: `${event.data?.completedSections}/${event.data?.totalSections} Sektionen`,
                }
              : p
          );
        }
        if (event.progress !== undefined) progress = event.progress;
        break;
      }

      case QualificationEventType.COMPLETE: {
        isComplete = true;
        isStreaming = false;
        progress = 100;
        phases = phases.map(p =>
          p.status !== 'completed' && p.status !== 'error'
            ? { ...p, status: 'completed' as PhaseStatus }
            : p
        );
        break;
      }

      case QualificationEventType.ERROR: {
        error = event.data?.error || event.data?.message || 'Unbekannter Fehler';
        isStreaming = false;
        break;
      }

      default: {
        if (event.progress !== undefined) progress = event.progress;
        break;
      }
    }
  }

  return { events, phases, isStreaming, isComplete, error, progress, currentPhase };
}

function streamReducer(state: QualificationStreamState, action: Action): QualificationStreamState {
  switch (action.type) {
    case 'ADD_EVENTS_BATCH': {
      if (action.events.length === 0) return state;
      return processEvents(state, action.events);
    }

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.isStreaming };

    case 'SET_ERROR':
      return { ...state, error: action.error, isStreaming: false };

    case 'RESET':
      return {
        events: [],
        phases: buildInitialPhases(),
        isStreaming: false,
        isComplete: false,
        error: null,
        progress: 0,
        currentPhase: null,
      };

    default:
      return state;
  }
}

const initialState: QualificationStreamState = {
  events: [],
  phases: buildInitialPhases(),
  isStreaming: false,
  isComplete: false,
  error: null,
  progress: 0,
  currentPhase: null,
};

// ============================================================================
// Hook
// ============================================================================

export function useQualificationStream(qualificationId: string) {
  const [state, dispatch] = useReducer(streamReducer, initialState);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventBufferRef = useRef<QualificationProcessingEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamCompletedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushEvents = useCallback(() => {
    if (eventBufferRef.current.length > 0) {
      dispatch({ type: 'ADD_EVENTS_BATCH', events: eventBufferRef.current });
      eventBufferRef.current = [];
    }
    flushTimeoutRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    flushEvents();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [flushEvents]);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    eventBufferRef.current = [];
    streamCompletedRef.current = false;

    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_STREAMING', isStreaming: true });

    const url = `/api/qualifications/${qualificationId}/processing-stream`;
    const eventSource = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data as string) as QualificationProcessingEvent;

        // Reset reconnect counter on successful message
        reconnectAttemptsRef.current = 0;

        if (isTerminalEvent(parsed)) {
          streamCompletedRef.current = true;
        }

        // Buffer event and schedule flush
        eventBufferRef.current.push(parsed);
        if (!flushTimeoutRef.current) {
          flushTimeoutRef.current = setTimeout(() => {
            if (eventBufferRef.current.length > 0) {
              dispatch({ type: 'ADD_EVENTS_BATCH', events: eventBufferRef.current });
              eventBufferRef.current = [];
            }
            flushTimeoutRef.current = null;
          }, BATCH_INTERVAL_MS);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      // Flush pending events
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      if (eventBufferRef.current.length > 0) {
        const hasComplete = eventBufferRef.current.some(e => isTerminalEvent(e));
        if (hasComplete) streamCompletedRef.current = true;
        dispatch({ type: 'ADD_EVENTS_BATCH', events: eventBufferRef.current });
        eventBufferRef.current = [];
      }

      // Normal close after COMPLETE
      if (streamCompletedRef.current) {
        eventSource.close();
        eventSourceRef.current = null;
        return;
      }

      // Reconnect with exponential backoff
      eventSource.close();
      eventSourceRef.current = null;

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        dispatch({
          type: 'SET_ERROR',
          error: 'Verbindung wurde unerwartet geschlossen. Bitte Seite neu laden.',
        });
      }
    };
  }, [qualificationId]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const retry = useCallback(async () => {
    try {
      const response = await fetch(`/api/qualifications/${qualificationId}/retry`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        dispatch({ type: 'SET_ERROR', error: data.error || 'Retry fehlgeschlagen' });
        return;
      }
      // Reconnect for the new job
      reconnectAttemptsRef.current = 0;
      connect();
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'Retry konnte nicht gestartet werden' });
    }
  }, [qualificationId, connect]);

  return {
    ...state,
    retry,
  };
}
