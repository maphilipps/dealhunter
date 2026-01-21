---
status: pending
priority: p1
issue_id: '004'
tags: [code-review, performance, memory, sse]
dependencies: []
---

# Unbounded Memory Growth in Event Array

## Problem Statement

The `useAgentStream` hook stores all SSE events in an unbounded array (`events: AgentEvent[]`). For long-running evaluations (multi-agent BIT evaluation can emit 100+ events), this causes memory to grow indefinitely. On mobile devices or during long sessions, this leads to performance degradation and potential browser crashes.

**Why it matters:**

- Memory leaks on long-running streams
- Browser tab crashes on mobile devices
- Performance degradation as array grows
- Infinite memory growth for never-ending streams
- Violates performance best practices

## Findings

**Location:** `hooks/use-agent-stream.ts:44-49`

**Evidence:**

```typescript
const streamReducer = (state: StreamState, action: StreamAction): StreamState => {
  switch (action.type) {
    case 'ADD_EVENT':
      return {
        ...state,
        events: [...state.events, action.event], // UNBOUNDED GROWTH
      };
```

**Memory Profile:**

- Each AgentEvent: ~500 bytes (with reasoning text, tool calls)
- 100 events = 50KB
- 1000 events = 500KB
- Long session with multiple evaluations = megabytes

**Scroll Performance:**

- ScrollArea renders ALL events on every update
- Causes layout thrashing as array grows
- Auto-scroll triggers on EVERY event addition

**Source:** Performance Oracle review agent

## Proposed Solutions

### Solution 1: Circular Buffer with Fixed Size (Recommended)

Replace unbounded array with circular buffer (max 100-200 events).

**Pros:**

- Constant memory usage
- Simple implementation
- Preserves recent events (most important)
- Fixes memory leak completely

**Cons:**

- Loses old events (acceptable for streaming UI)
- Need to handle event ID indexing

**Effort:** Small (2-3 hours)
**Risk:** Low

**Implementation:**

```typescript
const MAX_EVENTS = 150; // Keep last 150 events

const streamReducer = (state: StreamState, action: StreamAction): StreamState => {
  switch (action.type) {
    case 'ADD_EVENT':
      const newEvents = [...state.events, action.event];

      // Circular buffer: keep only last MAX_EVENTS
      const boundedEvents = newEvents.length > MAX_EVENTS
        ? newEvents.slice(newEvents.length - MAX_EVENTS)
        : newEvents;

      return {
        ...state,
        events: boundedEvents,
      };
```

### Solution 2: Virtual Scrolling with react-window

Only render visible events, keep all in memory.

**Pros:**

- All events preserved
- Efficient rendering
- Handles thousands of events

**Cons:**

- Doesn't fix memory issue (still stores all)
- Adds dependency
- More complex implementation
- Over-engineered for typical use

**Effort:** Medium (4-6 hours)
**Risk:** Low

**Not Recommended** - doesn't solve root cause.

### Solution 3: Pagination with Server-Side Storage

Store events server-side, fetch pages on demand.

**Pros:**

- Unlimited event storage
- True solution for very long streams

**Cons:**

- Significant backend work
- Not needed for typical 30-second evaluations
- Over-engineered
- Against YAGNI

**Effort:** Large (8-12 hours)
**Risk:** Medium

**Not Recommended** - overkill for current need.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `hooks/use-agent-stream.ts` (primary fix)
- `components/ai-elements/activity-stream.tsx` (may need UI update for "showing last N events" message)

**Memory Impact:**

- Before: O(n) growth where n = total events
- After: O(1) constant memory (max 150 events)

**User Experience:**

- Users see last 150 events (more than enough for typical evaluation)
- Older events scroll out of view and are garbage collected
- Critical events (START, COMPLETE, DECISION) always visible if within last 150

## Acceptance Criteria

- [ ] Events array never exceeds MAX_EVENTS (150) size
- [ ] Memory usage remains constant during long streams
- [ ] Older events removed when buffer full
- [ ] No memory leaks in multi-hour sessions
- [ ] Performance tests show constant memory profile
- [ ] User sees "Showing last 150 events" message if buffer fills
- [ ] Critical events (START, COMPLETE, DECISION) retained even when buffer rotates
- [ ] Tests for circular buffer behavior
- [ ] Documentation updated with memory limits

## Work Log

**2026-01-16**: Todo created from Performance Oracle review findings

## Resources

- Performance Oracle review report
- Circular buffer pattern: https://en.wikipedia.org/wiki/Circular_buffer
- React performance best practices: https://react.dev/learn/render-and-commit
- Memory profiling in Chrome DevTools: https://developer.chrome.com/docs/devtools/memory-problems/
