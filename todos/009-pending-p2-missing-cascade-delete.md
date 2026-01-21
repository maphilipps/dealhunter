---
status: pending
priority: p2
issue_id: DATA-001
tags: [code-review, database, foreign-keys, data-integrity]
dependencies: []
---

# IMPORTANT: Missing CASCADE DELETE on Foreign Keys

## Problem Statement

The `deepMigrationAnalyses` table references `bidOpportunities` via foreign key, but has no CASCADE DELETE constraint. When a bid is deleted, orphaned analysis records will remain in the database, causing data inconsistencies and wasted storage.

**Impact**: Orphaned records, data bloat, referential integrity violations
**Likelihood**: High (users will delete test bids, failed uploads, etc.)

## Findings

**Data Integrity Guardian Report:**

- Foreign key: `bidOpportunityId` → `bidOpportunities.id`
- Current behavior: Delete bid → analysis records orphaned
- Expected behavior: Delete bid → cascade delete all associated analyses
- Risk: Orphaned records accumulate over time, queries return invalid data

**Evidence:**

```typescript
// lib/db/schema.ts (current)
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id), // ❌ No CASCADE DELETE
});
```

**Current Migration:**

```sql
-- drizzle/0013_brave_amphibian.sql
FOREIGN KEY (`bid_opportunity_id`)
  REFERENCES `bid_opportunities`(`id`)
  ON UPDATE no action
  ON DELETE no action  -- ❌ Should be CASCADE
```

**Scenario:**

1. User uploads bid → creates bid record (id: "bid_123")
2. Triggers deep analysis → creates analysis record (bidOpportunityId: "bid_123")
3. User deletes bid (mistake, duplicate, etc.) → bid_123 deleted
4. Analysis record still exists with bidOpportunityId: "bid_123" ❌ Orphaned
5. Query for analyses joins to bids → returns NULL (invalid state)

## Proposed Solutions

### Solution 1: Add CASCADE DELETE to Foreign Key (Recommended)

**Pros:**

- Database enforces referential integrity
- Automatic cleanup, no application logic needed
- Standard SQL pattern
- Prevents orphaned records

**Cons:**

- Deletes analysis data when bid deleted (expected behavior)
- Need migration to update existing FK

**Effort**: Small (30 minutes)
**Risk**: Very Low

**Implementation:**

```typescript
// lib/db/schema.ts
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id, { onDelete: 'cascade' }), // ✅ Add CASCADE
});
```

**Migration:**

```sql
-- SQLite doesn't support ALTER FOREIGN KEY, need to recreate table:

-- 1. Create new table with CASCADE
CREATE TABLE `deep_migration_analyses_new` (
  -- ... all columns same as before ...
  FOREIGN KEY (`bid_opportunity_id`)
    REFERENCES `bid_opportunities`(`id`)
    ON DELETE CASCADE  -- ✅ Add this
);

-- 2. Copy data
INSERT INTO `deep_migration_analyses_new`
  SELECT * FROM `deep_migration_analyses`;

-- 3. Drop old table
DROP TABLE `deep_migration_analyses`;

-- 4. Rename new table
ALTER TABLE `deep_migration_analyses_new`
  RENAME TO `deep_migration_analyses`;
```

### Solution 2: Application-Level Cascade Delete

**Pros:**

- No schema migration needed
- More control over deletion logic

**Cons:**

- Easy to forget in new delete code paths
- Not enforced by database
- More complex, error-prone

**Effort**: Small (1 hour)
**Risk**: Medium (can be bypassed/forgotten)

**Implementation:**

```typescript
// lib/bids/actions.ts
export async function deleteBid(bidId: string) {
  // ❌ Manual cascade (fragile)
  await db.delete(deepMigrationAnalyses).where(eq(deepMigrationAnalyses.bidOpportunityId, bidId));

  await db.delete(bidOpportunities).where(eq(bidOpportunities.id, bidId));
}
```

### Solution 3: Soft Delete Bids Instead

**Pros:**

- No data loss
- Audit trail preserved

**Cons:**

- More complex queries (must filter deleted)
- Storage not reclaimed
- Doesn't solve orphaned record problem

**Effort**: Medium (2-3 hours)
**Risk**: Medium (adds complexity)

## Recommended Action

**Use Solution 1: Add CASCADE DELETE to Foreign Key**

This is the standard database pattern for parent-child relationships. Analysis records are meaningless without their parent bid, so cascading delete is the correct behavior.

## Technical Details

**Affected Files:**

- `lib/db/schema.ts` - Add onDelete: 'cascade'
- `drizzle/migrations/XXXX_add_cascade_delete.sql` - NEW migration

**Database Changes:** Recreates deepMigrationAnalyses table with CASCADE foreign key

**Breaking Changes:** None (existing data preserved, just adds cleanup behavior)

**Other Tables to Review:**
Consider adding CASCADE to other foreign keys:

- `quickScans.bidOpportunityId` → should also CASCADE
- `deepMigrationAnalyses.userId` (if added per HIGH-003) → NO CASCADE (keep user if analysis deleted)

## Acceptance Criteria

- [ ] Foreign key updated with ON DELETE CASCADE
- [ ] Migration tested: deleting bid also deletes all associated analyses
- [ ] No orphaned records after bid deletion
- [ ] Existing analysis data preserved during migration
- [ ] Database integrity verified with PRAGMA foreign_key_check
- [ ] Documentation updated with referential integrity rules

## Work Log

**2026-01-17**: Issue identified by data-integrity-guardian agent during Epic 7 Phase 1 review

## Resources

- [SQLite Foreign Key Constraints](https://www.sqlite.org/foreignkeys.html)
- [Drizzle ORM Foreign Keys](https://orm.drizzle.team/docs/sql-schema-declaration#foreign-keys)
- Related: DATA-004 (missing FK for deepMigrationAnalysisId in bids table)
