---
status: pending
priority: p1
issue_id: '019'
tags: [code-review, critical, react, workflow-phases]
dependencies: []
---

# 019 - CRITICAL: Unreachable Code Block - Phase 6/7/9 Cards Never Render

## Problem Statement

The new Phase 6, 7, 9 cards (BaselineComparisonCard, ProjectPlanningCard, NotificationCard) are placed inside an unreachable code block in `bid-detail-client.tsx`. The cards will **NEVER render** due to duplicate status checks with early returns.

## Findings

**Source:** kieran-typescript-reviewer agent

**Location:** `/Users/marc.philipps/Sites/dealhunter/components/bids/bid-detail-client.tsx`

**Issue:**

- Line 346 checks: `['quick_scanning', 'evaluating', 'bit_decided', 'routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(bid.status)` and returns JSX
- Line 512 checks: `['routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(bid.status)` - this is UNREACHABLE because the first block already caught all these statuses

**Evidence:**

```typescript
// Line 346 - catches routed, full_scanning, bl_reviewing, team_assigned, notified, handed_off
if (
  [
    'quick_scanning',
    'evaluating',
    'bit_decided',
    'routed',
    'full_scanning',
    'bl_reviewing',
    'team_assigned',
    'notified',
    'handed_off',
  ].includes(bid.status)
) {
  // ... returns early
}

// Line 512 - NEVER REACHED - all these statuses already handled above
if (
  ['routed', 'full_scanning', 'bl_reviewing', 'team_assigned', 'notified', 'handed_off'].includes(
    bid.status
  )
) {
  // BaselineComparisonCard, ProjectPlanningCard, NotificationCard here - NEVER RENDERS
}
```

## Proposed Solutions

### Solution 1: Move cards into existing status block (Recommended)

- Move the Phase 6/7/9 cards into the first status check block (around line 346-508)
- Add them after the existing TeamBuilder component
- **Effort:** Small
- **Risk:** Low
- **Pros:** Minimal change, keeps existing structure
- **Cons:** None

### Solution 2: Restructure render logic with status-specific sections

- Create separate render functions for each status group
- Better organization but more refactoring
- **Effort:** Medium
- **Risk:** Medium
- **Pros:** Cleaner architecture long-term
- **Cons:** More changes, could introduce regressions

## Recommended Action

**Solution 1** - Move cards into existing block

## Technical Details

**Affected Files:**

- `components/bids/bid-detail-client.tsx`

**Required Changes:**

1. Move the Phase 6/7/9 cards (lines 518-555) into the first status block (inside lines 346-508)
2. Remove the duplicate unreachable status check at line 512

## Acceptance Criteria

- [ ] BaselineComparisonCard renders when bid status is 'routed' or later
- [ ] ProjectPlanningCard renders when bid status is 'routed' or later
- [ ] NotificationCard renders when bid status is 'team_assigned' or later
- [ ] Manual testing confirms cards are visible
- [ ] No TypeScript errors

## Work Log

| Date       | Action                                    | Learning                                       |
| ---------- | ----------------------------------------- | ---------------------------------------------- |
| 2026-01-18 | Discovered via kieran-typescript-reviewer | Duplicate status checks cause unreachable code |

## Resources

- PR: feat/workflow-phases-6-7-9
- Related: Phase 6, 7, 9 implementation
