'use client';

import { useReducer, useRef, useCallback, useEffect } from 'react';
import type { AgentEvent, StreamState, UrlSuggestionData } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

/**
 * Hook for consuming Server-Sent Events from agent streams
 * Best practice: Use reducer for complex state management (rerender-derived-state)
 * Memory optimization: Circular buffer with MAX_EVENTS=150 limit (perf-004)
 * Performance optimization: Event batching to reduce re-renders by ~90% (Phase 6)
 */

// Maximum number of events to keep in memory (circular buffer prevents unbounded growth)
const MAX_EVENTS = 150;

// Phase 6: Event batching interval in milliseconds
// Batches events together to reduce re-renders from per-event to every 100ms
const BATCH_INTERVAL_MS = 100;

type Action =
  | { type: 'ADD_EVENT'; event: AgentEvent }
  | { type: 'ADD_EVENTS_BATCH'; events: AgentEvent[] }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

// Helper function to process a single event and update agent states
function processEvent(
  event: AgentEvent,
  currentAgentStates: StreamState['agentStates']
): {
  agentStates: StreamState['agentStates'];
  decision?: any;
  error?: string;
  urlSuggestion?: UrlSuggestionData;
  shouldStopStreaming?: boolean;
} {
  const newAgentStates = { ...currentAgentStates };
  let decision: any = undefined;
  let error: string | undefined = undefined;
  let urlSuggestion: UrlSuggestionData | undefined = undefined;
  let shouldStopStreaming = false;

  if (event.type === AgentEventType.AGENT_PROGRESS && event.data) {
    const data = event.data as { agent: string; message: string };
    newAgentStates[data.agent] = {
      status: 'running',
      progress: data.message,
    };
  } else if (event.type === AgentEventType.AGENT_COMPLETE && event.data) {
    const data = event.data as {
      agent: string;
      result: unknown;
      confidence?: number;
    };
    newAgentStates[data.agent] = {
      status: 'complete',
      result: data.result,
      confidence: data.confidence,
    };
  } else if (event.type === AgentEventType.DECISION && event.data) {
    decision = event.data;
  } else if (event.type === AgentEventType.URL_SUGGESTION && event.data) {
    urlSuggestion = event.data as UrlSuggestionData;
  } else if (event.type === AgentEventType.ERROR && event.data) {
    const data = event.data as { message: string };
    error = data.message;
    shouldStopStreaming = true;
  } else if (event.type === AgentEventType.COMPLETE) {
    shouldStopStreaming = true;
  }

  return { agentStates: newAgentStates, decision, error, urlSuggestion, shouldStopStreaming };
}

// Best practice: Use reducer instead of multiple useState (rerender-dependencies)
function streamReducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    // Phase 6: Batch event processing - single re-render for multiple events
    case 'ADD_EVENTS_BATCH': {
      if (action.events.length === 0) return state;

      let allEvents = [...state.events];
      let currentAgentStates = { ...state.agentStates };
      let decision = state.decision;
      let error = state.error;
      let urlSuggestion = state.urlSuggestion;
      let isStreaming = state.isStreaming;

      // Calculate timestamp range from server timestamps
      const serverTimestamps = action.events.map(e => e.timestamp);
      const minTimestamp = Math.min(...serverTimestamps);
      const maxTimestamp = Math.max(...serverTimestamps);
      const serverRange = maxTimestamp - minTimestamp;

      // If server timestamps have meaningful range (> 500ms), keep them
      // Otherwise, spread events over a minimum visible duration
      const MIN_SPREAD_MS = 2000; // Minimum 2 seconds spread for visual effect
      const needsSpread = serverRange < 500; // If range is tiny, apply artificial spread

      // Process all events in the batch
      action.events.forEach((event, index) => {
        let finalTimestamp = event.timestamp;

        if (needsSpread && action.events.length > 1) {
          // Spread timestamps artificially to create visual streaming effect
          // Use minTimestamp as base and spread events evenly
          const spreadFactor = index / (action.events.length - 1);
          finalTimestamp = minTimestamp + Math.round(spreadFactor * MIN_SPREAD_MS);
        }

        const eventWithTime = { ...event, timestamp: finalTimestamp };
        allEvents.push(eventWithTime);
        const result = processEvent(eventWithTime, currentAgentStates);
        currentAgentStates = result.agentStates;
        if (result.decision) decision = result.decision;
        if (result.error) error = result.error;
        if (result.urlSuggestion) urlSuggestion = result.urlSuggestion;
        if (result.shouldStopStreaming) isStreaming = false;
      });

      // Apply circular buffer limit
      const newEvents =
        allEvents.length > MAX_EVENTS ? allEvents.slice(allEvents.length - MAX_EVENTS) : allEvents;

      return {
        ...state,
        events: newEvents,
        agentStates: currentAgentStates,
        decision,
        error,
        urlSuggestion,
        isStreaming,
      };
    }

    case 'ADD_EVENT': {
      const event = action.event;

      // Circular buffer: keep only last MAX_EVENTS events to prevent memory leaks
      const allEvents = [...state.events, event];
      const newEvents =
        allEvents.length > MAX_EVENTS ? allEvents.slice(allEvents.length - MAX_EVENTS) : allEvents;

      // Update agent states based on event type
      const newAgentStates = { ...state.agentStates };

      if (event.type === AgentEventType.AGENT_PROGRESS && event.data) {
        const data = event.data as { agent: string; message: string };
        newAgentStates[data.agent] = {
          status: 'running',
          progress: data.message,
        };
      } else if (event.type === AgentEventType.AGENT_COMPLETE && event.data) {
        const data = event.data as {
          agent: string;
          result: unknown;
          confidence?: number;
        };
        newAgentStates[data.agent] = {
          status: 'complete',
          result: data.result,
          confidence: data.confidence,
        };
      } else if (event.type === AgentEventType.DECISION && event.data) {
        return {
          ...state,
          events: newEvents,
          decision: event.data as any,
          agentStates: newAgentStates,
        };
      } else if (event.type === AgentEventType.URL_SUGGESTION && event.data) {
        return {
          ...state,
          events: newEvents,
          urlSuggestion: event.data as UrlSuggestionData,
          agentStates: newAgentStates,
        };
      } else if (event.type === AgentEventType.ERROR && event.data) {
        const data = event.data as { message: string };
        return {
          ...state,
          events: newEvents,
          error: data.message,
          isStreaming: false,
          agentStates: newAgentStates,
        };
      } else if (event.type === AgentEventType.COMPLETE) {
        return {
          ...state,
          events: newEvents,
          isStreaming: false,
          agentStates: newAgentStates,
        };
      }

      return {
        ...state,
        events: newEvents,
        agentStates: newAgentStates,
      };
    }

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.isStreaming };

    case 'SET_ERROR':
      return { ...state, error: action.error, isStreaming: false };

    case 'RESET':
      return {
        events: [],
        isStreaming: false,
        error: null,
        decision: null,
        urlSuggestion: null,
        agentStates: {},
      };

    default:
      return state;
  }
}

const initialState: StreamState = {
  events: [],
  isStreaming: false,
  error: null,
  decision: null,
  urlSuggestion: null,
  agentStates: {},
};

export function useAgentStream() {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Phase 6: Event batching refs for performance optimization
  const eventBufferRef = useRef<AgentEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if stream completed successfully (COMPLETE event received)
  // Used to distinguish between normal close and error
  const streamCompletedRef = useRef<boolean>(false);

  // Flush buffered events to state (single re-render for entire batch)
  const flushEvents = useCallback(() => {
    if (eventBufferRef.current.length > 0) {
      dispatch({ type: 'ADD_EVENTS_BATCH', events: eventBufferRef.current });
      eventBufferRef.current = [];
    }
    flushTimeoutRef.current = null;
  }, []);

  // Best practice: Stable abort function using useCallback (rerender-functional-setstate)
  const abort = useCallback(() => {
    // Clear any pending flush
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    // Flush any remaining events before closing
    flushEvents();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      dispatch({ type: 'SET_STREAMING', isStreaming: false });
    }
  }, [flushEvents]);

  // Best practice: Stable start function using useCallback
  const start = useCallback((url: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending batch
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    eventBufferRef.current = [];

    // Reset completion tracking
    streamCompletedRef.current = false;

    // Reset state
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_STREAMING', isStreaming: true });

    // Create new EventSource with credentials for auth cookies
    const eventSource = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      try {
        const agentEvent: AgentEvent = JSON.parse(event.data);

        // Keep server timestamp - don't override with client time
        // Server timestamps reflect actual processing order and timing
        // Client spreading in ADD_EVENTS_BATCH will create visual progression if needed

        // Track if COMPLETE event received (normal stream end)
        if (agentEvent.type === AgentEventType.COMPLETE) {
          streamCompletedRef.current = true;
        }

        // Phase 6: Buffer events and schedule batch flush
        eventBufferRef.current.push(agentEvent);

        // Schedule flush if not already scheduled
        if (!flushTimeoutRef.current) {
          flushTimeoutRef.current = setTimeout(() => {
            if (eventBufferRef.current.length > 0) {
              dispatch({ type: 'ADD_EVENTS_BATCH', events: eventBufferRef.current });
              eventBufferRef.current = [];
            }
            flushTimeoutRef.current = null;
          }, BATCH_INTERVAL_MS);
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = error => {
      // Flush any pending events before handling error/close
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      if (eventBufferRef.current.length > 0) {
        // Check if COMPLETE event is in buffer (not yet processed)
        const hasCompleteInBuffer = eventBufferRef.current.some(
          e => e.type === AgentEventType.COMPLETE
        );
        if (hasCompleteInBuffer) {
          streamCompletedRef.current = true;
        }
        dispatch({ type: 'ADD_EVENTS_BATCH', events: eventBufferRef.current });
        eventBufferRef.current = [];
      }

      // If stream completed successfully (COMPLETE event received), this is normal close
      // Don't treat it as an error
      if (streamCompletedRef.current) {
        // Normal stream end - just cleanup without error
        eventSource.close();
        eventSourceRef.current = null;
        return;
      }

      // Real error - log and set error state
      console.error('EventSource error:', error);
      const errorMessage =
        eventSource.readyState === EventSource.CLOSED
          ? 'Verbindung wurde unerwartet geschlossen - bitte Seite neu laden'
          : 'Stream-Verbindung fehlgeschlagen - bitte prüfen Sie Ihre Anmeldung';
      dispatch({ type: 'SET_ERROR', error: errorMessage });
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending flush
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    start,
    abort,
  };
}
