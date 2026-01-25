---
status: pending
priority: p2
issue_id:
tags: [code-review, react, state-management, hooks, sync-issues]
dependencies: []
---

# Dual State Tracking in Polling Hook

## Problem Statement

The `use-background-job-status.ts` hook at lines 80-81 maintains both a ref (`isPollingRef`) and a state (`isPolling`) to track the same boolean value. This dual tracking pattern can cause synchronization issues where the ref and state values diverge, leading to inconsistent behavior.

## Findings

- **Source:** code-review
- **Files:**
  - `hooks/use-background-job-status.ts:80-81`
- **Severity:** P2 - Potential sync issues, code smell
- **Impact:** Race conditions between ref and state updates, confusing code

**Current code:**

```typescript
// Line 80-81
const isPollingRef = useRef(false);
const [isPolling, setIsPolling] = useState(false);

// Later in the code, both need to be updated together
isPollingRef.current = true;
setIsPolling(true);

// Risk: If one update is missed, they become out of sync
```

**The Problem:**

1. Refs update synchronously, state updates asynchronously
2. If logic branches before state update completes, ref and state can diverge
3. Components reading `isPolling` state may see stale value
4. Code that checks `isPollingRef.current` may see different value than rendered state

## Proposed Solutions

### Solution 1: Use Only Ref with Force Update (Recommended)

If the value is primarily used for internal logic (not rendering), use only the ref.

```typescript
const isPollingRef = useRef(false);
const [, forceUpdate] = useReducer(x => x + 1, 0);

const startPolling = useCallback(() => {
  if (isPollingRef.current) return;
  isPollingRef.current = true;
  forceUpdate(); // Only if UI needs to reflect the change
  // ... polling logic
}, []);

const stopPolling = useCallback(() => {
  isPollingRef.current = false;
  forceUpdate();
}, []);
```

**Pros:** Single source of truth, no sync issues
**Cons:** Less idiomatic React, manual force updates
**Effort:** Small (30 min)
**Risk:** Low

### Solution 2: Use Only State with Ref for Callbacks

Keep state as source of truth, use ref only to access current value in callbacks.

```typescript
const [isPolling, setIsPolling] = useState(false);
const isPollingRef = useRef(isPolling);

// Sync ref whenever state changes
useEffect(() => {
  isPollingRef.current = isPolling;
}, [isPolling]);

const startPolling = useCallback(() => {
  // Use ref for checks in async callbacks
  if (isPollingRef.current) return;
  setIsPolling(true);
  // ... polling logic
}, []);
```

**Pros:** State is source of truth, ref always in sync
**Cons:** Extra useEffect, slight complexity
**Effort:** Small (20 min)
**Risk:** Low

### Solution 3: Custom Hook Pattern

Create a custom hook that manages synchronized ref and state.

```typescript
function useSyncedState<T>(initialValue: T) {
  const [state, setState] = useState(initialValue);
  const ref = useRef(initialValue);

  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    const newValue = typeof value === 'function' ? (value as (prev: T) => T)(ref.current) : value;
    ref.current = newValue;
    setState(newValue);
  }, []);

  return [state, ref, setSyncedState] as const;
}

// Usage
const [isPolling, isPollingRef, setIsPolling] = useSyncedState(false);
```

**Pros:** Reusable, guarantees sync, clean API
**Cons:** New abstraction to maintain
**Effort:** Medium (45 min)
**Risk:** Low

### Solution 4: Analyze and Simplify

Review the actual usage to determine if both are needed.

- If only used in callbacks: use ref only
- If only used for rendering: use state only
- If both: use Solution 2 or 3

**Pros:** Might simplify significantly
**Cons:** Requires deeper analysis
**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

Solution 2 - Use state as source of truth with useEffect to sync ref. This is the most idiomatic React pattern and ensures the ref always reflects the current state.

## Technical Details

**Affected Files:**

- `hooks/use-background-job-status.ts`

**Investigation Questions:**

1. Is `isPolling` used for rendering? (needs state)
2. Is `isPollingRef.current` checked in async callbacks? (needs ref)
3. Are there race conditions currently? (check for bugs)

**Search Pattern:**

```bash
# Find all usages of both variables
grep -n "isPolling\|isPollingRef" hooks/use-background-job-status.ts
```

## Acceptance Criteria

- [ ] Single source of truth for polling state
- [ ] Ref and state always synchronized
- [ ] No race conditions between ref and state
- [ ] Polling behavior unchanged
- [ ] Clean, understandable code

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-25 | Created from code review | Dual ref/state tracking causes sync issues |

## Resources

- React useRef: https://react.dev/reference/react/useRef
- When to use refs vs state: https://react.dev/learn/referencing-values-with-refs
- React state batching: https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching
