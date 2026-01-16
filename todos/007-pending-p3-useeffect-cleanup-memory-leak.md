---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, react, nextjs, memory-leak]
dependencies: []
---

# useEffect Lacks Cleanup - Potential Memory Leak

## Problem Statement

The `useEffect` hook in `bid-detail-client.tsx` loads Quick Scan results without cleanup. If the component unmounts before the Promise resolves, state updates will attempt on an unmounted component, causing React warnings and potential memory leaks.

**Impact:** LOW - React will warn in dev mode, unlikely to cause production crashes, but violates React best practices.

**Location:** `/Users/marc.philipps/Sites/dealhunter/components/bids/bid-detail-client.tsx:82-92`

## Findings

**From nextjs-reviewer agent:**

**Current Code (VULNERABLE):**
```typescript
useEffect(() => {
  if (['quick_scanning', 'evaluating', 'bit_decided', 'routed', 'team_assigned'].includes(bid.status)) {
    setIsLoadingQuickScan(true);
    getQuickScanResult(bid.id).then(result => {
      if (result.success && result.quickScan) {
        setQuickScan(result.quickScan);
      }
      setIsLoadingQuickScan(false);
    });
  }
}, [bid.id, bid.status]);
```

**Problems:**
1. No cleanup function - component could unmount before Promise resolves
2. No error handling for rejected Promise
3. Using `.then()` instead of async/await (anti-pattern in React hooks)
4. State updates after unmount would trigger React warning

**Failure Scenario:**
1. User navigates to bid detail page
2. Quick Scan starts loading (`getQuickScanResult` called)
3. User navigates away before Promise resolves
4. Component unmounts
5. Promise resolves and tries to call `setQuickScan()` on unmounted component
6. React warning: "Can't perform a React state update on an unmounted component"

## Proposed Solutions

### Solution 1: Cleanup Flag (Recommended)
**Effort:** Small (5-10 minutes)
**Risk:** Low
**Pros:** Standard React pattern, prevents warnings
**Cons:** Slightly more code

```typescript
useEffect(() => {
  let isMounted = true; // ✅ Cleanup flag

  async function loadQuickScan() {
    if (!['quick_scanning', 'evaluating', 'bit_decided', 'routed', 'team_assigned'].includes(bid.status)) {
      return;
    }

    setIsLoadingQuickScan(true);

    try {
      const result = await getQuickScanResult(bid.id);

      // ✅ Only update state if still mounted
      if (isMounted) {
        if (result.success && result.quickScan) {
          setQuickScan(result.quickScan);
        }
        setIsLoadingQuickScan(false);
      }
    } catch (error) {
      // ✅ Error handling
      if (isMounted) {
        console.error('Failed to load quick scan:', error);
        setIsLoadingQuickScan(false);
      }
    }
  }

  loadQuickScan();

  // ✅ Cleanup function
  return () => {
    isMounted = false;
  };
}, [bid.id, bid.status]);
```

### Solution 2: AbortController (Advanced)
**Effort:** Medium (15 minutes)
**Risk:** Low
**Pros:** Actually cancels the fetch request, not just state updates
**Cons:** More complex, requires updating server action to accept abort signal

Use `AbortController` to cancel the in-flight request when component unmounts.

**Not recommended for now** - cleanup flag is simpler and sufficient.

## Recommended Action

**Implement Solution 1 (cleanup flag)** to follow React best practices and prevent warnings.

## Technical Details

**Affected Files:**
- `/Users/marc.philipps/Sites/dealhunter/components/bids/bid-detail-client.tsx:82-92`

**Additional Cleanup Needed:**
Check for similar patterns in:
- `bid-detail-client.tsx` (other useEffect instances)
- `extraction-preview.tsx` (if any async operations)
- Other client components with async state updates

**Breaking Changes:** None - behavior remains identical

## Acceptance Criteria

- [ ] `useEffect` has cleanup function that sets `isMounted = false`
- [ ] State updates guarded by `if (isMounted)` check
- [ ] Error handling added for rejected Promise
- [ ] Using async/await instead of `.then()`
- [ ] No React warnings in console when navigating away during load
- [ ] Existing functionality unchanged

## Work Log

<!-- Add dated entries as you work on this -->

## Resources

- React useEffect Cleanup: https://react.dev/reference/react/useEffect#cleanup
- React Strict Mode: Helps detect these issues
- Next.js Reviewer: See agent output above
