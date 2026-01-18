---
status: pending
priority: p2
issue_id: "038"
tags: [performance, react, gemini-analysis]
dependencies: []
---

# JSON Parsing Should Use Lazy Initialization

## Problem Statement

`BidDetailClient` performs synchronous `JSON.parse` operations during every render cycle instead of using lazy initialization. This causes unnecessary CPU work on each re-render.

**Impact:** Render blocking, degraded UI responsiveness, especially with large JSON payloads.

## Findings

**From Gemini CLI large codebase analysis:**

**File:** `components/bids/bid-detail-client.tsx`

**Line 36 - useState without lazy init:**
```typescript
// CURRENT (executes JSON.parse on EVERY render):
useState(bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null)

// SHOULD BE (lazy initialization - only runs once):
useState(() => bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null)
```

**Lines 318, 321, 324 - Parsing in render without memoization:**
```typescript
// These parse on every render:
baselineComparisonResult = JSON.parse(...)
projectPlanningResult = JSON.parse(...)
teamNotifications = JSON.parse(...)
```

**Line 349 - Inline parsing in JSX:**
```typescript
// Parsing inside JSX return:
JSON.parse(bid.assignedTeam)
```

## Proposed Solutions

### Solution A: Lazy initialization + useMemo (Recommended)
**Pros:** Prevents unnecessary parsing, React best practice
**Cons:** Minor refactor
**Effort:** Small (20 min)
**Risk:** Low

```typescript
// 1. Fix useState with lazy initialization
const [extractedData, setExtractedData] = useState(() =>
  bid.extractedRequirements ? JSON.parse(bid.extractedRequirements) : null
);

// 2. Memoize parsed values
const baselineComparisonResult = useMemo(() =>
  bid.baselineComparisonResult ? JSON.parse(bid.baselineComparisonResult) : null,
  [bid.baselineComparisonResult]
);

const projectPlanningResult = useMemo(() =>
  bid.projectPlanningResult ? JSON.parse(bid.projectPlanningResult) : null,
  [bid.projectPlanningResult]
);

const teamNotifications = useMemo(() =>
  bid.teamNotifications ? JSON.parse(bid.teamNotifications) : null,
  [bid.teamNotifications]
);

const assignedTeam = useMemo(() =>
  bid.assignedTeam ? JSON.parse(bid.assignedTeam) : null,
  [bid.assignedTeam]
);
```

### Solution B: Parse on server side
**Pros:** No client-side parsing at all
**Cons:** Larger refactor, changes component props
**Effort:** Medium (1 hour)
**Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `components/bids/bid-detail-client.tsx` (lines 36, 318, 321, 324, 349)

## Acceptance Criteria

- [ ] `useState` uses lazy initialization `useState(() => ...)`
- [ ] All `JSON.parse` calls wrapped in `useMemo`
- [ ] No `JSON.parse` calls inside JSX return statements
- [ ] Component renders without performance degradation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from Gemini CLI analysis | Always use lazy init for expensive useState computations |

## Resources

- [React useState lazy initialization](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state)
- [useMemo for expensive calculations](https://react.dev/reference/react/useMemo)
