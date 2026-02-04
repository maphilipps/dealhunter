---
status: not_applicable
priority: p3
issue_id: '074'
tags: [code-review, performance, react, memoization]
dependencies: []
resolution: File does not exist yet - contexts/deep-scan-context.tsx is not implemented
---

# Deep Scan Context Memoization Issues

## Problem Statement

The `DeepScanContext` in `contexts/deep-scan-context.tsx` recreates its context value every 10 seconds due to polling. This causes all consumers to re-render even if their specific data hasn't changed, leading to unnecessary render cycles and potential performance issues.

**Why it matters:**

- Unnecessary re-renders on every poll cycle
- Components re-render even when their data unchanged
- Performance degradation in complex UIs
- React DevTools shows constant updates
- Battery drain on mobile devices

## Findings

**Location:** `contexts/deep-scan-context.tsx`

**Evidence:**

```typescript
// Current implementation - context value recreated every poll
const DeepScanProvider = ({ children }) => {
  const [status, setStatus] = useState(null);

  // Polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus().then(setStatus);
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Value object recreated every render
  const value = {
    status,
    isScanning: status?.state === 'running',
    progress: status?.progress,
    results: status?.results,
    // ... more derived values
  };

  return (
    <DeepScanContext.Provider value={value}>
      {children}
    </DeepScanContext.Provider>
  );
};
```

**Problem:**

Every time `status` changes (every 10 seconds):

1. New `value` object created
2. All consumers re-render
3. Even if only `progress` changed, `results` consumers re-render

**Render Impact:**

| Consumer       | Uses       | Re-renders on |
| -------------- | ---------- | ------------- |
| StatusBanner   | isScanning | Every poll    |
| ProgressBar    | progress   | Every poll    |
| ResultsDisplay | results    | Every poll    |
| ActionButtons  | isScanning | Every poll    |

**Source:** Performance code review

## Proposed Solutions

### Solution 1: useMemo for Context Value (Quick Fix)

Memoize the context value to prevent reference changes.

**Pros:**

- Simple fix
- Immediate improvement
- No API changes

**Cons:**

- Still re-renders all consumers when any value changes
- Partial solution

**Effort:** Small (30 minutes)
**Risk:** Low

**Implementation:**

```typescript
const value = useMemo(
  () => ({
    status,
    isScanning: status?.state === 'running',
    progress: status?.progress,
    results: status?.results,
  }),
  [status]
);
```

### Solution 2: Split Contexts (Recommended)

Separate stable and dynamic contexts to minimize re-renders.

**Pros:**

- Components only re-render when their data changes
- Clear separation of concerns
- Better performance for complex UIs
- Follows React best practices

**Cons:**

- More contexts to manage
- Slight API change for consumers

**Effort:** Medium (2-3 hours)
**Risk:** Low

**Implementation:**

```typescript
// Stable context - rarely changes
const DeepScanActionsContext = createContext<{
  startScan: () => void;
  stopScan: () => void;
  selectiveRescan: (sections: string[]) => void;
} | null>(null);

// Dynamic context - changes frequently
const DeepScanStatusContext = createContext<{
  status: DeepScanStatus | null;
  isScanning: boolean;
} | null>(null);

// Progress context - changes most frequently
const DeepScanProgressContext = createContext<{
  progress: number;
  currentPhase: string;
} | null>(null);

// Results context - changes when results ready
const DeepScanResultsContext = createContext<{
  results: DeepScanResults | null;
} | null>(null);

// Provider composition
export const DeepScanProvider = ({ children }) => {
  // ... state management

  return (
    <DeepScanActionsContext.Provider value={actions}>
      <DeepScanStatusContext.Provider value={statusValue}>
        <DeepScanProgressContext.Provider value={progressValue}>
          <DeepScanResultsContext.Provider value={resultsValue}>
            {children}
          </DeepScanResultsContext.Provider>
        </DeepScanProgressContext.Provider>
      </DeepScanStatusContext.Provider>
    </DeepScanActionsContext.Provider>
  );
};

// Targeted hooks
export const useDeepScanActions = () => useContext(DeepScanActionsContext);
export const useDeepScanStatus = () => useContext(DeepScanStatusContext);
export const useDeepScanProgress = () => useContext(DeepScanProgressContext);
export const useDeepScanResults = () => useContext(DeepScanResultsContext);
```

### Solution 3: State Management Library

Use Zustand or Jotai for granular subscriptions.

**Pros:**

- Built-in selector optimization
- Automatic render optimization
- Powerful devtools

**Cons:**

- New dependency
- Different mental model
- Migration effort

**Effort:** Large (1-2 days)
**Risk:** Medium

**Consider for future** if context splitting insufficient.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `contexts/deep-scan-context.tsx` (primary)
- All components using `useDeepScan()` hook

**Consumer Analysis:**

```bash
# Find all context consumers
grep -r "useDeepScan" components/
```

**Render Profiling:**

Use React DevTools Profiler to measure:

1. Current render frequency
2. Render duration per component
3. Which components re-render on poll

## Acceptance Criteria

- [ ] Context value properly memoized
- [ ] Components only re-render when their data changes
- [ ] React DevTools shows reduced render frequency
- [ ] No regression in functionality
- [ ] Type safety maintained
- [ ] Documentation updated for new hooks (if split)
- [ ] Performance improvement measured and documented

## Work Log

**2026-01-25**: Todo created from performance code review findings
**2026-02-04**: Marked as not applicable - the file `contexts/deep-scan-context.tsx` does not exist in the codebase. Only `contexts/quick-scan-context.tsx` exists. The DeepScan v2 feature is being developed in `lib/deep-scan-v2/` but does not yet have a React context provider. When a deep-scan context is implemented in the future, the memoization pattern from this todo should be applied.

## Resources

- React Context optimization: https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions
- useMemo for context: https://react.dev/reference/react/useMemo
- Context splitting pattern: https://kentcdodds.com/blog/how-to-optimize-your-context-value
