---
status: pending
priority: p3
issue_id: DEA-138
tags: [code-review, simplicity, architecture, yagni]
dependencies: []
---

# Hardcoded CMS_FEATURES Should Be In Database

## Problem Statement

In `lib/leads/cms-selection-service.ts`, CMS features are hardcoded as a constant. This duplicates what could be stored in the technologies table and makes updates require code changes.

## Findings

- **Source:** code-simplicity-reviewer
- **File:** `lib/leads/cms-selection-service.ts`
- **Severity:** P3 - Maintainability improvement
- **Impact:** Code duplication with DB, harder to update

**Current approach:**

```typescript
const CMS_FEATURES: Record<string, CMSFeature[]> = {
  'drupal': [...],
  'magnolia': [...],
  // etc.
};
```

## Proposed Solutions

### Solution 1: Keep As-Is (For Now)

The hardcoded approach is simpler for MVP and doesn't require schema changes.

**Pros:** No migration needed, simple
**Cons:** Duplication
**Effort:** None
**Risk:** None

### Solution 2: Move to Database

Add features JSON column to technologies table.

**Pros:** Single source of truth
**Cons:** Schema change, migration, more complex queries
**Effort:** Medium-Large
**Risk:** Medium

## Recommended Action

Keep as-is for MVP - this is a P3 enhancement for post-MVP

## Technical Details

**Affected Files:**

- `lib/leads/cms-selection-service.ts`
- `lib/db/schema.ts` (if migrating)

## Acceptance Criteria

- [ ] Decision documented
- [ ] Future enhancement ticket created if deferring

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2026-01-22 | Created from code review | YAGNI - defer if not needed now |

## Resources

- PR: DEA-138 subtasks
