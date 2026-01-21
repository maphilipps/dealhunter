---
status: pending
priority: p2
issue_id: DATA-004
tags: [code-review, database, foreign-keys, data-integrity]
dependencies: []
---

# IMPORTANT: Missing Foreign Key for deepMigrationAnalysisId in Bids Table

## Problem Statement

The `bidOpportunities` schema includes a `deepMigrationAnalysisId` column (line 83) that references `deepMigrationAnalyses.id`, but has NO foreign key constraint defined. This allows invalid references to be stored and makes it impossible to enforce referential integrity.

**Impact**: Orphaned references, data inconsistencies, broken UI when trying to load analysis
**Likelihood**: High (manual edits, data corruption, race conditions)

## Findings

**Data Integrity Guardian Report:**

- Column exists: `deepMigrationAnalysisId: text('deep_migration_analysis_id')`
- No foreign key constraint defined
- No validation that referenced analysis exists
- Can store random string → breaks UI when loading analysis
- No CASCADE behavior on delete

**Evidence:**

```typescript
// lib/db/schema.ts (lines 82-83)
export const bidOpportunities = sqliteTable('bid_opportunities', {
  // ... other columns
  quickScanId: text('quick_scan_id'), // ❌ Also no FK
  deepMigrationAnalysisId: text('deep_migration_analysis_id'), // ❌ No FK constraint
});
```

**Expected Schema:**

```typescript
deepMigrationAnalysisId: text('deep_migration_analysis_id')
  .references(() => deepMigrationAnalyses.id, {
    onDelete: 'set null', // ✅ When analysis deleted, clear reference
  }),
```

**Risk Scenarios:**

1. Analysis deleted → bid still has deepMigrationAnalysisId → UI breaks trying to load
2. Manual DB edit sets invalid ID → UI shows "Analysis not found" error
3. Race condition: bid references analysis before it's created → constraint would prevent

## Proposed Solutions

### Solution 1: Add Foreign Key with ON DELETE SET NULL (Recommended)

**Pros:**

- Enforces referential integrity
- Auto-clears reference when analysis deleted
- Prevents invalid IDs from being stored
- Standard pattern for optional references

**Cons:**

- Need schema migration
- Existing invalid references must be cleaned up first

**Effort**: Small (30 minutes)
**Risk**: Low

**Implementation:**

```typescript
// lib/db/schema.ts
export const bidOpportunities = sqliteTable('bid_opportunities', {
  // ... other columns
  deepMigrationAnalysisId: text('deep_migration_analysis_id').references(
    () => deepMigrationAnalyses.id,
    {
      onDelete: 'set null', // ✅ Clear reference when analysis deleted
    }
  ),
  quickScanId: text('quick_scan_id').references(() => quickScans.id, {
    onDelete: 'set null', // ✅ Also fix this while we're at it
  }),
});
```

**Migration:**

```sql
-- SQLite doesn't support ALTER COLUMN, need to recreate table:

-- 1. Create new table with foreign keys
CREATE TABLE `bid_opportunities_new` (
  -- ... all columns same as before ...
  `deep_migration_analysis_id` text,
  `quick_scan_id` text,
  FOREIGN KEY (`deep_migration_analysis_id`)
    REFERENCES `deep_migration_analyses`(`id`)
    ON DELETE SET NULL,
  FOREIGN KEY (`quick_scan_id`)
    REFERENCES `quick_scans`(`id`)
    ON DELETE SET NULL
);

-- 2. Clean up invalid references
UPDATE `bid_opportunities`
  SET `deep_migration_analysis_id` = NULL
  WHERE `deep_migration_analysis_id` NOT IN (
    SELECT id FROM `deep_migration_analyses`
  );

UPDATE `bid_opportunities`
  SET `quick_scan_id` = NULL
  WHERE `quick_scan_id` NOT IN (
    SELECT id FROM `quick_scans`
  );

-- 3. Copy data
INSERT INTO `bid_opportunities_new`
  SELECT * FROM `bid_opportunities`;

-- 4. Drop old table
DROP TABLE `bid_opportunities`;

-- 5. Rename new table
ALTER TABLE `bid_opportunities_new`
  RENAME TO `bid_opportunities`;
```

### Solution 2: Application-Level Validation

**Pros:**

- No schema migration
- More flexible validation logic

**Cons:**

- Not enforced by database
- Easy to bypass/forget
- Doesn't auto-clear on delete

**Effort**: Small (1 hour)
**Risk**: High (fragile, can be forgotten)

### Solution 3: Remove Column Entirely

**Pros:**

- Simplifies schema
- Use quickScans.deepMigrationAnalysisId instead

**Cons:**

- Requires refactoring existing code
- Loses direct link from bid to analysis

**Effort**: Medium (2-3 hours)
**Risk**: Medium (code changes)

## Recommended Action

**Use Solution 1: Add Foreign Key with ON DELETE SET NULL**

This is the standard pattern for optional references and prevents data integrity issues. We should also fix `quickScanId` at the same time.

## Technical Details

**Affected Files:**

- `lib/db/schema.ts` - Add FK constraints to both columns
- `drizzle/migrations/XXXX_add_analysis_fks.sql` - NEW migration

**Database Changes:** Recreates bid_opportunities table with foreign keys

**Breaking Changes:** Invalid references will be cleared (correct behavior)

**Verification:**

```typescript
// After migration, verify FK constraints active:
const [fks] = await db.all("PRAGMA foreign_key_list('bid_opportunities')");
console.log(fks);
// Should show:
// - deep_migration_analysis_id → deep_migration_analyses(id)
// - quick_scan_id → quick_scans(id)
```

## Acceptance Criteria

- [ ] Foreign key added for deepMigrationAnalysisId
- [ ] Foreign key added for quickScanId (while we're at it)
- [ ] ON DELETE SET NULL behavior configured
- [ ] Invalid references cleaned up before migration
- [ ] Migration tested on dev database
- [ ] PRAGMA foreign_key_check returns no errors
- [ ] UI handles NULL analysis IDs gracefully
- [ ] Documentation updated with referential integrity rules

## Work Log

**2026-01-17**: Issue identified by data-integrity-guardian agent during Epic 7 Phase 1 review

## Resources

- [SQLite Foreign Key Constraints](https://www.sqlite.org/foreignkeys.html)
- [Drizzle ORM Foreign Keys](https://orm.drizzle.team/docs/sql-schema-declaration#foreign-keys)
- Related: DATA-001 (CASCADE DELETE for deepMigrationAnalyses.bidOpportunityId)
- Schema file: `lib/db/schema.ts:82-83`
