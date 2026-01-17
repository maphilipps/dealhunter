---
status: pending
priority: p2
issue_id: PERF-001
tags: [code-review, performance, database, indexes]
dependencies: []
---

# IMPORTANT: Missing Database Indexes on Deep Analysis Table

## Problem Statement

The `deep_migration_analyses` table has no indexes on frequently queried columns (`bidOpportunityId`, `status`, `jobId`), causing O(n) table scans instead of O(log n) index lookups. At scale (1000+ analyses), queries will be 100-1000x slower.

**Impact**: Slow queries, poor UX, database performance degradation at scale
**Current**: 4 bids total (not noticeable yet)
**Future**: 1000+ bids → 100-1000ms query times instead of 1-10ms

## Findings

**Performance Oracle Report:**
- Common query pattern: "Find latest analysis for bid X" → needs bidOpportunityId index
- Status filtering: "Show all running analyses" → needs status index
- Job lookup: "Find analysis by Inngest jobId" → needs jobId index
- Without indexes: Full table scan for every query
- With indexes: Binary search, 100-1000x faster

**Evidence:**
```typescript
// Common queries (NO INDEXES):
// 1. Find analysis by bid (O(n) scan)
await db.select()
  .from(deepMigrationAnalyses)
  .where(eq(deepMigrationAnalyses.bidOpportunityId, bidId)); // ❌ No index

// 2. Find running analyses (O(n) scan)
await db.select()
  .from(deepMigrationAnalyses)
  .where(eq(deepMigrationAnalyses.status, 'running')); // ❌ No index

// 3. Find analysis by jobId (O(n) scan)
await db.select()
  .from(deepMigrationAnalyses)
  .where(eq(deepMigrationAnalyses.jobId, inngestRunId)); // ❌ No index
```

**Performance Impact (projected):**
| Records | Without Index | With Index | Speedup |
|---------|--------------|------------|---------|
| 10      | 1ms          | 1ms        | 1x      |
| 100     | 10ms         | 2ms        | 5x      |
| 1,000   | 100ms        | 3ms        | 33x     |
| 10,000  | 1,000ms      | 4ms        | 250x    |

## Proposed Solutions

### Solution 1: Add Composite Index on (bidOpportunityId, status) (Recommended)
**Pros:**
- Covers most common query pattern
- Single index handles multiple query types
- Minimal storage overhead

**Cons:**
- Need separate index for jobId

**Effort**: Small (30 minutes)
**Risk**: Very Low

**Implementation:**
```sql
-- New migration file
CREATE INDEX `idx_deep_migration_analyses_bid_status`
  ON `deep_migration_analyses` (`bid_opportunity_id`, `status`);

CREATE INDEX `idx_deep_migration_analyses_job_id`
  ON `deep_migration_analyses` (`job_id`);

-- Optional: Index for userId (if HIGH-003 implemented)
CREATE INDEX `idx_deep_migration_analyses_user_id`
  ON `deep_migration_analyses` (`user_id`);
```

### Solution 2: Add Individual Indexes
**Pros:**
- Flexible for query optimizer
- Each column individually indexed

**Cons:**
- More storage space
- More index maintenance overhead
- Composite index is more efficient

**Effort**: Small (30 minutes)
**Risk**: Very Low

### Solution 3: Defer Until Performance Issue Observed
**Pros:**
- Less work now
- Can optimize later if needed

**Cons:**
- Users will experience slowness first
- Reactive instead of proactive
- Migration more disruptive with existing data

**Effort**: N/A
**Risk**: High (poor UX at scale)

## Recommended Action

**Use Solution 1: Add Composite Index NOW**

Indexes should be added during schema design, not after performance issues arise. This is a best practice for any production database.

## Technical Details

**Affected Files:**
- `drizzle/migrations/XXXX_add_deep_analysis_indexes.sql` - NEW migration

**Schema Change (in code):**
```typescript
// lib/db/schema.ts
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  // ... existing columns
}, (table) => ({
  // ✅ Add indexes
  bidStatusIdx: index('idx_deep_migration_analyses_bid_status')
    .on(table.bidOpportunityId, table.status),
  jobIdIdx: index('idx_deep_migration_analyses_job_id')
    .on(table.jobId),
}));
```

**Database Changes:** Adds 2 indexes

**Breaking Changes:** None (additive only, improves performance)

**Query Improvement Example:**
```typescript
// BEFORE: O(n) table scan
const [analysis] = await db.select()
  .from(deepMigrationAnalyses)
  .where(and(
    eq(deepMigrationAnalyses.bidOpportunityId, bidId),
    eq(deepMigrationAnalyses.status, 'completed')
  ))
  .orderBy(desc(deepMigrationAnalyses.createdAt))
  .limit(1);
// Query time: 100ms (at 1000 records)

// AFTER: O(log n) index lookup
// Same code, but uses composite index
// Query time: 3ms (at 1000 records) ✅ 33x faster
```

## Acceptance Criteria

- [ ] Composite index created on (bidOpportunityId, status)
- [ ] Index created on jobId
- [ ] Migration tested on dev database
- [ ] Query performance verified with EXPLAIN QUERY PLAN
- [ ] Index usage logged in SQLite query planner output
- [ ] No degradation in write performance
- [ ] Documentation updated with index strategy

## Work Log

**2026-01-17**: Issue identified by performance-oracle agent during Epic 7 Phase 1 review

## Resources

- [SQLite Index Documentation](https://www.sqlite.org/lang_createindex.html)
- [Drizzle ORM Indexes](https://orm.drizzle.team/docs/indexes-constraints)
- [Database Indexing Best Practices](https://use-the-index-luke.com/)
