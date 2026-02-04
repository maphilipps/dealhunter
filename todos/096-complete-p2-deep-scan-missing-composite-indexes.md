---
status: complete
priority: p2
issue_id: '096'
tags: [code-review, performance, deep-scan-v2, database]
dependencies: []
---

# Missing Composite Indexes for Common Query Patterns

## Problem Statement

The List tool filters by both `userId` AND `status` simultaneously, but there is no composite index for this common query pattern. At scale, this will cause full table scans.

## Findings

**Agent:** performance-oracle

**File:** `lib/db/schema.ts`
**Lines:** 2280-2287

Current indexes:

- `pre_qualification_idx` on `preQualificationId`
- `user_idx` on `userId`
- `status_idx` on `status`
- `created_at_idx` on `createdAt`

Missing composite indexes for query patterns:

- `(userId, status)` - used in list for non-admin users
- `(preQualificationId, status)` - used in filtering by parent + status

**Impact:**

- Full table scans when non-admin users list their runs with status filters
- At 100K runs, query could take 500ms+ instead of <5ms

## Proposed Solutions

### Option A: Add composite indexes

**Pros:** 20x faster queries at scale
**Cons:** Slightly larger DB storage
**Effort:** Small (migration)
**Risk:** Low

```sql
-- Add to migration
CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_user_status_idx"
ON "deep_scan_v2_runs" ("user_id", "status");

CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_prequal_status_idx"
ON "deep_scan_v2_runs" ("pre_qualification_id", "status");

CREATE INDEX IF NOT EXISTS "deep_scan_v2_runs_bullmq_job_idx"
ON "deep_scan_v2_runs" ("bullmq_job_id")
WHERE "bullmq_job_id" IS NOT NULL;
```

## Recommended Action

Create a new migration to add composite indexes.

## Technical Details

**Affected Files:**

- `drizzle/0007_add_deep_scan_indexes.sql` (new)
- `lib/db/schema.ts` (add index definitions)

## Acceptance Criteria

- [ ] Composite index on `(user_id, status)` exists
- [ ] Composite index on `(pre_qualification_id, status)` exists
- [ ] Partial index on `bullmq_job_id` exists
- [ ] Migration is reversible
- [ ] EXPLAIN ANALYZE shows index usage

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-04 | Created | From performance-oracle review |

## Resources

- PR: feat/deep-scan-v2-agent-native
