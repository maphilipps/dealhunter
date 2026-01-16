'use client';

import { useReducer, useRef, useCallback, useEffect } from 'react';
import type { AgentEvent, StreamState } from '@/lib/streaming/event-types';
import { AgentEventType } from '@/lib/streaming/event-types';

/**
 * Hook for consuming Server-Sent Events from agent streams
 * Best practice: Use reducer for complex state management (rerender-derived-state)
 * Memory optimization: Circular buffer with MAX_EVENTS=150 limit (perf-004)
 */

// Maximum number of events to keep in memory (circular buffer prevents unbounded growth)
const MAX_EVENTS = 150;

type Action =
  | { type: 'ADD_EVENT'; event: AgentEvent }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

// Best practice: Use reducer instead of multiple useState (rerender-dependencies)
function streamReducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
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
  agentStates: {},
};

export function useAgentStream() {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Best practice: Stable abort function using useCallback (rerender-functional-setstate)
  const abort = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      dispatch({ type: 'SET_STREAMING', isStreaming: false });
    }
  }, []);

  // Best practice: Stable start function using useCallback
  const start = useCallback((url: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_STREAMING', isStreaming: true });

    // Create new EventSource
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const agentEvent: AgentEvent = JSON.parse(event.data);
        dispatch({ type: 'ADD_EVENT', event: agentEvent });
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      dispatch({ type: 'SET_ERROR', error: 'Stream connection failed' });
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
