---
status: pending
priority: p2
issue_id: DATA-002
tags: [code-review, database, constraints, data-integrity]
dependencies: []
---

# IMPORTANT: Missing UNIQUE Constraint on (bidOpportunityId, version)

## Problem Statement

Multiple deep analysis jobs can run concurrently for the same bid with the same version number, creating duplicate "running" analyses and data inconsistencies. A UNIQUE constraint on `(bidOpportunityId, version)` would prevent this race condition.

**Impact**: Duplicate running jobs, wasted compute resources, inconsistent analysis results
**Likelihood**: Medium (user clicks "Analyze" multiple times, or multiple tabs trigger analysis)

## Findings

**Data Integrity Guardian Report:**
- No constraint prevents duplicate analyses for same bid + version
- Schema includes `version` column (default 1) but no uniqueness enforcement
- Race condition: Two requests → two Inngest jobs → two "running" analyses
- User confusion: Which analysis is the "real" one?

**Evidence:**
```typescript
// lib/db/schema.ts (current)
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  bidOpportunityId: text('bid_opportunity_id').notNull(),
  version: integer('version').notNull().default(1),
  // ❌ No UNIQUE constraint on (bidOpportunityId, version)
});
```

**Race Condition Scenario:**
1. User opens bid detail page
2. Clicks "Run Deep Analysis" button
3. Button doesn't disable immediately (network lag)
4. User clicks again (impatient) → 2 concurrent requests
5. Both requests create analysis records with version=1
6. Two Inngest jobs start processing the same bid
7. Database has 2 "running" analyses for same bid + version ❌

**Expected Behavior:**
- Second insert should fail with UNIQUE constraint violation
- Application shows error: "Analysis already running for this bid"
- User sees existing job progress, not duplicate

## Proposed Solutions

### Solution 1: Add UNIQUE Constraint + Handle Conflict (Recommended)
**Pros:**
- Database enforces uniqueness
- Prevents duplicate jobs at source
- Idempotent operations (safe to retry)
- Clear error handling

**Cons:**
- Need error handling for constraint violations
- Migration to add constraint

**Effort**: Small (1 hour)
**Risk**: Low

**Implementation:**
```typescript
// lib/db/schema.ts
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  bidOpportunityId: text('bid_opportunity_id').notNull(),
  version: integer('version').notNull().default(1),
  // ... other columns
}, (table) => ({
  uniqueBidVersion: uniqueIndex('unique_bid_version')
    .on(table.bidOpportunityId, table.version), // ✅ Add this
}));

// app/api/bids/[id]/deep-analysis/trigger/route.ts
try {
  const [existing] = await db.select()
    .from(deepMigrationAnalyses)
    .where(and(
      eq(deepMigrationAnalyses.bidOpportunityId, bidId),
      eq(deepMigrationAnalyses.version, 1),
      inArray(deepMigrationAnalyses.status, ['pending', 'running'])
    ));

  if (existing) {
    return Response.json({
      error: 'Analysis already running',
      jobId: existing.jobId,
      status: existing.status,
    }, { status: 409 }); // ✅ Conflict
  }

  // Create analysis + trigger job
  const analysisId = createId();
  await db.insert(deepMigrationAnalyses).values({
    id: analysisId,
    bidOpportunityId: bidId,
    userId: session.user.id,
    version: 1,
    status: 'pending',
    // ...
  });

  await inngest.send({
    name: 'deep-analysis.run',
    data: { bidId, analysisId, userId: session.user.id },
  });

  return Response.json({ jobId: analysisId, status: 'triggered' });
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    // Race condition: analysis was created between SELECT and INSERT
    const [existing] = await db.select()
      .from(deepMigrationAnalyses)
      .where(and(
        eq(deepMigrationAnalyses.bidOpportunityId, bidId),
        eq(deepMigrationAnalyses.version, 1)
      ));

    return Response.json({
      error: 'Analysis already running',
      jobId: existing!.jobId,
      status: existing!.status,
    }, { status: 409 });
  }
  throw error;
}
```

**Migration:**
```sql
-- New migration
CREATE UNIQUE INDEX `unique_bid_version`
  ON `deep_migration_analyses` (`bid_opportunity_id`, `version`);
```

### Solution 2: Application-Level Lock with SELECT FOR UPDATE
**Pros:**
- Prevents race at application level
- More control over lock timing

**Cons:**
- SQLite doesn't support SELECT FOR UPDATE
- Would need PostgreSQL or manual locking

**Effort**: N/A (not supported in SQLite)
**Risk**: N/A

### Solution 3: Idempotency Key Pattern
**Pros:**
- Standard distributed systems pattern
- Works across multiple servers

**Cons:**
- More complex implementation
- Requires separate idempotency key table
- Overkill for single-server SQLite app

**Effort**: Large (4-6 hours)
**Risk**: Medium (more complexity)

## Recommended Action

**Use Solution 1: Add UNIQUE Constraint + Handle Conflict**

This is the simplest and most robust solution for preventing duplicate analyses. The database enforces uniqueness, and we handle conflicts gracefully with 409 responses.

## Technical Details

**Affected Files:**
- `lib/db/schema.ts` - Add uniqueIndex
- `app/api/bids/[id]/deep-analysis/trigger/route.ts` - Add conflict handling
- `drizzle/migrations/XXXX_add_unique_bid_version.sql` - NEW migration

**Database Changes:** Adds UNIQUE index on (bidOpportunityId, version)

**Breaking Changes:** Duplicate analyses will be rejected (desired behavior)

**UI Improvements:**
- Disable "Run Analysis" button when analysis running
- Show existing job progress instead of allowing new trigger
- Clear error message if duplicate attempted

## Acceptance Criteria

- [ ] UNIQUE index created on (bidOpportunityId, version)
- [ ] Duplicate analysis attempts return 409 Conflict
- [ ] Error response includes existing jobId and status
- [ ] UI disables trigger button when analysis running
- [ ] Race condition test: concurrent requests only create 1 analysis
- [ ] Migration tested with existing data
- [ ] Documentation updated with versioning strategy

## Work Log

**2026-01-17**: Issue identified by data-integrity-guardian agent during Epic 7 Phase 1 review

## Resources

- [SQLite UNIQUE Constraints](https://www.sqlite.org/lang_createtable.html#unique_constraints)
- [Drizzle ORM Unique Indexes](https://orm.drizzle.team/docs/indexes-constraints#unique-index)
- [Idempotency Patterns](https://stripe.com/docs/api/idempotent_requests)
