---
status: pending
priority: p3
issue_id: '024'
tags: [code-review, yagni, dead-code, simplicity]
dependencies: []
---

# 024 - LOW: Unused Server Actions (YAGNI Violation)

## Problem Statement

Several "getter" server actions were pre-built for future use cases that don't exist. The UI components use `initialResult`/`initialPlan` props passed from the parent page instead of fetching independently.

## Findings

**Source:** code-simplicity-reviewer agent

**Unused Functions (171 lines of dead code):**

- `getBaselineComparisonResult()` - `lib/baseline-comparison/actions.ts:118-156` (38 lines)
- `getProjectPlan()` - `lib/project-planning/actions.ts:125-163` (38 lines)
- `updateProjectPhase()` - `lib/project-planning/actions.ts:168-225` (57 lines)
- `getNotificationStatus()` - `lib/notifications/actions.ts:163-201` (38 lines)

**Why unused:** UI components receive data via props from parent page, not via independent fetching.

## Proposed Solutions

### Solution 1: Remove unused functions (Recommended)

- Delete all 4 unused functions
- **Effort:** Small
- **Risk:** Low
- **Pros:** Less code to maintain, cleaner codebase
- **Cons:** Would need to recreate if ever needed (unlikely)

### Solution 2: Keep but document as "for future use"

- Add comments explaining they're intentionally unused
- **Effort:** Small
- **Risk:** Low
- **Pros:** Ready if needed
- **Cons:** Dead code, maintenance burden

## Recommended Action

**Solution 1** - Remove unused functions (YAGNI principle)

## Technical Details

**Affected Files:**

- `lib/baseline-comparison/actions.ts`
- `lib/project-planning/actions.ts`
- `lib/notifications/actions.ts`

**Lines to remove:** ~171 total

## Acceptance Criteria

- [ ] All 4 unused functions removed
- [ ] TypeScript build passes
- [ ] Existing functionality unchanged

## Work Log

| Date       | Action                                  | Learning                                                        |
| ---------- | --------------------------------------- | --------------------------------------------------------------- |
| 2026-01-18 | Discovered via code-simplicity-reviewer | Pre-building for hypothetical use cases adds maintenance burden |
