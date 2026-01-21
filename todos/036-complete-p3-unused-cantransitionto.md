---
status: pending
priority: p3
issue_id: '036'
tags: [code-review, architecture, dead-code]
dependencies: []
---

# Unused canTransitionTo Function - Integrate or Remove

## Problem Statement

`lib/workflow/bl-review-status.ts` exports `canTransitionTo()` function but it's never used. Server actions duplicate inline status checks instead of using this workflow helper.

**Impact:** Dead code, two sources of truth for transition validation.

## Findings

**From architecture-strategist agent:**

**Unused function (lines 32-75):**

```typescript
export function canTransitionTo(
  bid: Pick<BidOpportunity, ...>,
  nextPhase: BLReviewPhase
): TransitionResult { ... }
```

**Only these are imported (page.tsx:7):**

```typescript
import { getEnabledTabs, getWorkflowProgress } from '@/lib/workflow/bl-review-status';
// canTransitionTo NOT imported
```

**Duplicated inline checks in actions:**

- `lib/team/actions.ts:49` - `if (bid.status !== 'routed')`
- `lib/team/actions.ts:128` - `if (bid.status !== 'routed')`

## Proposed Solutions

### Solution A: Integrate canTransitionTo into actions (Recommended)

**Pros:** Single source of truth, better consistency
**Cons:** Minor refactor
**Effort:** Medium (30 min)
**Risk:** Low

```typescript
// In team/actions.ts:
const transition = canTransitionTo(bid, 'team_assignment');
if (!transition.allowed) {
  return { success: false, error: transition.reason };
}
```

### Solution B: Remove if truly unnecessary

**Pros:** Less code to maintain
**Cons:** Lose workflow abstraction
**Effort:** Tiny (5 min)
**Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**

- `lib/workflow/bl-review-status.ts` (export canTransitionTo)
- `lib/team/actions.ts` (use canTransitionTo instead of inline checks)
- `lib/routing/actions.ts` (use canTransitionTo instead of inline checks)

## Acceptance Criteria

- [ ] Either integrate `canTransitionTo` into all Server Actions
- [ ] OR remove the function if deemed unnecessary
- [ ] No unused exports in bl-review-status.ts

## Work Log

| Date       | Action                   | Learnings                        |
| ---------- | ------------------------ | -------------------------------- |
| 2026-01-18 | Created from code review | Keep workflow logic in one place |

## Resources

- None
