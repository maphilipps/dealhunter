---
status: pending
priority: p3
issue_id: '008'
tags: [code-review, performance, ui, optimization]
dependencies: []
---

# Scroll Thrashing in Auto-Scroll

## Problem Statement

ActivityStream calls `scrollIntoView({ behavior: 'smooth' })` on EVERY event addition. For high-frequency events (10+ per second during parallel agent execution), this causes excessive layout recalculations and janky scrolling. Performance Oracle identified this as a micro-performance issue.

**Why it matters:**

- Janky scroll animation during rapid events
- Excessive layout recalculations (performance overhead)
- CPU spikes on event-heavy streams
- Poor UX on slower devices
- Battery drain on mobile

## Findings

**Location:** `components/ai-elements/activity-stream.tsx:44-47`

**Evidence:**

```typescript
// Auto-scroll to bottom when new events arrive
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [events]); // Triggers on EVERY event

// With 10 events/sec = 10 layout recalcs/sec = janky
```

**Source:** Performance Oracle review agent

## Proposed Solutions

### Solution 1: Debounce Scroll Updates (Recommended)

Debounce scroll to trigger max once per 100ms.

**Pros:**

- Significantly reduces layout recalcs
- Simple implementation
- Preserves smooth scroll UX
- No visual difference to user

**Cons:**

- Tiny delay (100ms) before scroll
- Need to add lodash.debounce or custom implementation

**Effort:** Small (1 hour)
**Risk:** Low

**Implementation:**

```typescript
import { useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';

export function ActivityStream({ ... }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Debounced scroll function
  const scrollToBottom = useCallback(
    debounce(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100),
    []
  );

  // Call debounced version
  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  return (
    // ... component JSX
  );
}
```

### Solution 2: requestAnimationFrame Batching

Batch scroll updates with rAF.

**Pros:**

- Syncs with browser paint cycles
- No dependency needed
- Maximum performance

**Cons:**

- More complex implementation
- Requires cleanup logic

**Effort:** Small (1-2 hours)
**Risk:** Low

**Implementation:**

```typescript
const scrollToBottom = useCallback(() => {
  if (rafRef.current) {
    cancelAnimationFrame(rafRef.current);
  }

  rafRef.current = requestAnimationFrame(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  });
}, []);

useEffect(() => {
  scrollToBottom();

  return () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  };
}, [events, scrollToBottom]);
```

### Solution 3: Intersection Observer

Only scroll if user is near bottom.

**Pros:**

- Respects user's scroll position
- No scroll if user is reading old events

**Cons:**

- More complex
- Adds state management

**Effort:** Medium (2-3 hours)
**Risk:** Low

**Over-engineered** for current need.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `components/ai-elements/activity-stream.tsx`

**Performance Impact:**

- Before: 10 scroll calls/sec = 10 layout recalcs/sec
- After: 1 scroll call per 100ms = ~10x reduction

**User Experience:**

- No visible change (100ms debounce is imperceptible)
- Smoother scroll on slower devices
- Reduced battery drain

## Acceptance Criteria

- [ ] Scroll updates debounced to max 1 per 100ms
- [ ] No janky scroll during rapid events
- [ ] Smooth scroll still works
- [ ] Performance profiling shows reduced layout recalcs
- [ ] Works on mobile devices
- [ ] Tests for debounced behavior
- [ ] Cleanup on unmount

## Work Log

**2026-01-16**: Todo created from Performance Oracle review findings

## Resources

- Performance Oracle review report
- Lodash debounce: https://lodash.com/docs/#debounce
- React performance: https://react.dev/learn/render-and-commit
- requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
