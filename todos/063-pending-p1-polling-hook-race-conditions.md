---
id: '063'
title: React Polling Hook Race Conditions
status: pending
priority: p1
created: 2026-01-25
assignee: null
tags:
  - performance
  - react
  - frontend
  - race-conditions
---

# React Polling Hook Race Conditions

## Summary

The `use-background-job-status` hook has multiple race conditions caused by overlapping effects triggering the same fetch, stale closures, and missing cleanup on unmount. This causes UI flicker and inconsistent state.

## Location

- **File:** `hooks/use-background-job-status.ts`

## Problem

### Race Condition Types

1. **Overlapping Effects**
   - Multiple `useEffect` hooks trigger fetches on the same dependencies
   - No deduplication of in-flight requests

2. **Stale Closures**
   - Callbacks reference outdated state values
   - Updates applied out of order

3. **Unmount Races**
   - Component unmounts while fetch is in-flight
   - State update attempted on unmounted component
   - Memory leaks from abandoned intervals

4. **Double Fetches**
   - Strict mode in development causes double execution
   - No request deduplication

### Symptoms

- UI flicker between states
- Progress bar jumping backwards
- Console warnings about state updates on unmounted components
- Inconsistent job status display

## Proposed Solution

### 1. Add AbortController for Cleanup

```typescript
useEffect(() => {
  const controller = new AbortController();

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setError(error);
      }
    }
  };

  fetchStatus();
  const interval = setInterval(fetchStatus, pollInterval);

  return () => {
    controller.abort();
    clearInterval(interval);
  };
}, [jobId, pollInterval]);
```

### 2. Use Ref for Latest Callback

```typescript
const fetchRef = useRef(fetchStatus);
fetchRef.current = fetchStatus;

useEffect(() => {
  const interval = setInterval(() => fetchRef.current(), pollInterval);
  return () => clearInterval(interval);
}, [pollInterval]);
```

### 3. Add Request Deduplication

```typescript
const inFlightRef = useRef<Promise<void> | null>(null);

const fetchStatus = async () => {
  if (inFlightRef.current) return inFlightRef.current;

  inFlightRef.current = (async () => {
    try {
      // fetch logic
    } finally {
      inFlightRef.current = null;
    }
  })();

  return inFlightRef.current;
};
```

### 4. Consider SWR or React Query

Replace manual polling with a battle-tested library:

```typescript
import useSWR from 'swr';

export function useBackgroundJobStatus(jobId: string) {
  const { data, error, isLoading } = useSWR(jobId ? `/api/jobs/${jobId}/status` : null, fetcher, {
    refreshInterval: 2000,
    revalidateOnFocus: false,
  });

  return { status: data, error, isLoading };
}
```

## Acceptance Criteria

- [ ] No console warnings about unmounted component updates
- [ ] Progress bar updates smoothly without jumping backwards
- [ ] No duplicate network requests visible in DevTools
- [ ] Component cleanup properly aborts in-flight requests
- [ ] UI remains stable during rapid navigation

## Testing

```typescript
// Test unmount race condition
it('should not update state after unmount', async () => {
  const { unmount } = renderHook(() => useBackgroundJobStatus('job-1'));
  unmount();
  // Verify no state update warnings
});

// Test request deduplication
it('should not make duplicate requests', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch');
  const { rerender } = renderHook(() => useBackgroundJobStatus('job-1'));
  rerender();
  rerender();
  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
```

## Related Issues

- None
