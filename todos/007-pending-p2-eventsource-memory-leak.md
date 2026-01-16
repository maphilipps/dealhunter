---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, performance, memory-leak, cleanup]
dependencies: []
---

# EventSource Memory Leak on Component Unmount

## Problem Statement

The `useAgentStream` hook creates EventSource connections but doesn't properly clean them up when the component unmounts or when a new stream starts. This causes memory leaks, zombie connections, and continued processing of events from old streams.

**Why it matters:**
- Memory leaks on navigation (EventSource never closed)
- Server resources wasted on zombie connections
- Multiple concurrent streams if user navigates back/forth
- Browser shows "connection still active" warnings
- Violates React hooks cleanup pattern

## Findings

**Location:** `hooks/use-agent-stream.ts:67-85`

**Evidence:**
```typescript
const start = useCallback((url: string) => {
  // Creates new EventSource but doesn't close old one
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    const agentEvent: AgentEvent = JSON.parse(event.data);
    dispatch({ type: 'ADD_EVENT', event: agentEvent });
  };

  eventSourceRef.current = eventSource;
  dispatch({ type: 'START_STREAM' });
}, []);

// Missing cleanup in useEffect
// Should have:
// useEffect(() => {
//   return () => {
//     eventSourceRef.current?.close();
//   };
// }, []);
```

**Leak Scenarios:**
1. User navigates away → EventSource never closed → server keeps sending
2. User starts new evaluation → old EventSource still active → both running
3. Component re-renders → multiple listeners attached

**Source:** Performance Oracle review agent

## Proposed Solutions

### Solution 1: Proper useEffect Cleanup (Recommended)

Add cleanup function to close EventSource on unmount.

**Pros:**
- Follows React best practices
- Prevents all leak scenarios
- Simple fix
- No behavior changes

**Cons:**
- None

**Effort:** Small (30 minutes)
**Risk:** Low

**Implementation:**
```typescript
export function useAgentStream() {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup on unmount or when stream changes
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const start = useCallback((url: string) => {
    // Close existing connection before starting new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const agentEvent: AgentEvent = JSON.parse(event.data);
      dispatch({ type: 'ADD_EVENT', event: agentEvent });
    };

    eventSource.onerror = () => {
      eventSource.close();
      dispatch({ type: 'ERROR', error: 'Connection lost' });
    };

    eventSourceRef.current = eventSource;
    dispatch({ type: 'START_STREAM' });
  }, []);

  const abort = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      dispatch({ type: 'ABORT' });
    }
  }, []);

  return { ...state, start, abort };
}
```

### Solution 2: AbortController for Cleanup

Use AbortController to manage stream lifecycle.

**Pros:**
- More modern API
- Can abort server-side processing
- Better error handling

**Cons:**
- EventSource doesn't support AbortSignal natively
- Need polyfill or wrapper
- More complex

**Effort:** Medium (2-3 hours)
**Risk:** Low

**Not Recommended** - Solution 1 is simpler and sufficient.

### Solution 3: Manual Reference Counting

Track active streams in global state.

**Pros:**
- Can prevent multiple concurrent streams

**Cons:**
- Over-engineered
- Global state management overhead
- Doesn't fix root cleanup issue

**Effort:** Medium (3-4 hours)
**Risk:** Medium

**Not Recommended** - violates YAGNI.

## Recommended Action

*(To be filled during triage)*

## Technical Details

**Affected Files:**
- `hooks/use-agent-stream.ts` (primary fix)

**Memory Impact:**
- Before: EventSource connections never closed → infinite growth
- After: Connections closed on unmount → constant memory

**Browser Behavior:**
- Before: Browser shows "connection still active" on navigation
- After: Clean navigation with proper cleanup

## Acceptance Criteria

- [ ] EventSource closed when component unmounts
- [ ] EventSource closed when new stream starts
- [ ] No zombie connections after navigation
- [ ] Browser DevTools shows connection properly closed
- [ ] Memory profiling shows no EventSource leaks
- [ ] Tests for cleanup scenarios (unmount, start new stream, abort)
- [ ] No errors in console on unmount
- [ ] Server logs show connection closed properly

## Work Log

**2026-01-16**: Todo created from Performance Oracle review findings

## Resources

- Performance Oracle review report
- EventSource MDN: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- React cleanup patterns: https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
- Memory leak debugging: https://developer.chrome.com/docs/devtools/memory-problems/
