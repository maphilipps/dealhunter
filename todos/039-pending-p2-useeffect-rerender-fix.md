---
status: pending
priority: p2
issue_id: "039"
tags: [performance, react, gemini-analysis]
dependencies: ["038"]
---

# useEffect Dependency Causing Unnecessary Re-renders

## Problem Statement

The `useEffect` in `BidDetailClient` has `extractedData` in its dependency array. Since `extractedData` is an object derived from `JSON.parse`, its reference identity changes on every render, causing the Effect (and `getQuickScanResult` fetch) to fire repeatedly.

**Impact:** Unnecessary API calls, wasted bandwidth, potential infinite loops.

## Findings

**From Gemini CLI large codebase analysis:**

**File:** `components/bids/bid-detail-client.tsx`

**Line 189 - useEffect with object dependency:**
```typescript
useEffect(() => {
  // Fetches getQuickScanResult
  // ...
}, [extractedData]); // extractedData changes reference every render!
```

**Root cause chain:**
1. `extractedData` is set via `useState(JSON.parse(...))` without lazy init
2. Every render re-evaluates `JSON.parse`, creating new object reference
3. `useEffect` sees "changed" dependency and re-runs
4. This triggers state updates, causing another render
5. Cycle repeats

## Proposed Solutions

### Solution A: Fix upstream JSON parsing (Recommended)
**Pros:** Fixes root cause, see issue #038
**Cons:** Requires fixing #038 first
**Effort:** Part of #038
**Risk:** Low

Once #038 is fixed with `useMemo`, the object reference will be stable.

### Solution B: Use specific primitive dependencies
**Pros:** Quick fix, doesn't require #038
**Cons:** Workaround, not root cause fix
**Effort:** Small (10 min)
**Risk:** Low

```typescript
// Instead of depending on the object:
useEffect(() => {
  // ...
}, [bid.id, bid.extractedRequirements]); // Primitives are stable
```

### Solution C: Use JSON string comparison
**Pros:** Works with current structure
**Cons:** Still parses JSON, just compares strings
**Effort:** Small (10 min)
**Risk:** Low

```typescript
// Compare the raw string instead of parsed object
const extractedRequirementsJson = bid.extractedRequirements;

useEffect(() => {
  // ...
}, [extractedRequirementsJson]);
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `components/bids/bid-detail-client.tsx` (line 189)

**Dependencies:**
- Should be fixed after #038 (JSON parsing lazy init)

## Acceptance Criteria

- [ ] `useEffect` does not re-run on every render
- [ ] `getQuickScanResult` only called when bid actually changes
- [ ] No infinite render loops
- [ ] Network tab shows single fetch per bid load

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from Gemini CLI analysis | Never use parsed objects directly in useEffect deps |

## Resources

- [useEffect dependency best practices](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies)
