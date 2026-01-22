---
status: pending
priority: p1
issue_id: DEA-138
tags: [code-review, database, data-integrity, schema]
dependencies: []
---

# Missing onDelete Cascade on selectedCmsId Foreign Key

## Problem Statement

In `lib/db/schema.ts`, the `selectedCmsId` foreign key on the leads table has no `onDelete` behavior defined. If a technology record is deleted, the FK reference becomes orphaned, potentially causing runtime errors.

**Current Code:**

```typescript
selectedCmsId: text('selected_cms_id').references(() => technologies.id),
```

**Missing:** `onDelete: 'set null'` or `onDelete: 'cascade'`

## Findings

- **Source:** data-integrity-guardian
- **File:** `lib/db/schema.ts`
- **Severity:** P1 - Data integrity violation
- **Impact:** Orphaned FK references, potential runtime crashes when accessing deleted CMS

## Proposed Solutions

### Solution 1: Set Null on Delete (Recommended)

Set the FK to null when the referenced technology is deleted.

```typescript
selectedCmsId: text('selected_cms_id').references(() => technologies.id, { onDelete: 'set null' }),
```

**Pros:** Safe, allows re-selection, no data loss
**Cons:** Need to handle null in UI
**Effort:** Small (migration needed)
**Risk:** Low

### Solution 2: Cascade Delete

Delete the lead when CMS is deleted.

**Pros:** Consistent data
**Cons:** DANGEROUS - could delete important leads
**Effort:** Small
**Risk:** HIGH - data loss

### Solution 3: Restrict Delete

Prevent technology deletion if referenced.

**Pros:** No orphans
**Cons:** May block legitimate admin actions
**Effort:** Small
**Risk:** Medium

## Recommended Action

Solution 1 - Set Null on Delete

## Technical Details

**Affected Files:**

- `lib/db/schema.ts`
- Migration file needed

**Migration:**

```sql
-- SQLite requires table recreation for FK changes
-- Use Drizzle migration to regenerate
```

## Acceptance Criteria

- [ ] FK has explicit onDelete behavior
- [ ] Migration created and tested
- [ ] UI handles null selectedCmsId gracefully
- [ ] No orphaned references after technology deletion

## Work Log

| Date       | Action                   | Learnings                         |
| ---------- | ------------------------ | --------------------------------- |
| 2026-01-22 | Created from code review | Always define FK cascade behavior |

## Resources

- PR: DEA-138 subtasks
- Drizzle FK docs
