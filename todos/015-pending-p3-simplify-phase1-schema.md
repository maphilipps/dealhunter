---
status: pending
priority: p3
issue_id: SIMP-001
tags: [code-review, simplicity, yagni, database]
dependencies: []
---

# NICE-TO-HAVE: Simplify Phase 1 Schema (17 Columns for Placeholder)

## Problem Statement

Phase 1 creates a `deepMigrationAnalyses` table with 17 columns, but the Inngest function is just a placeholder that returns `{ success: true }`. This violates YAGNI (You Aren't Gonna Need It) - we're designing for future requirements before implementing actual functionality.

**Impact**: Over-engineering, harder to change when actual requirements emerge, cognitive overhead
**Severity**: Design philosophy, not a functional bug

## Findings

**Code Simplicity Reviewer Report:**
- Phase 1 goal: "Foundation with database schema and Inngest placeholder"
- Actual Inngest function: 7 lines, just logs and returns success
- Database schema: 17 columns with complex JSON storage
- YAGNI violation: Creating infrastructure for features not yet implemented
- Risk: When Phase 2 agents are built, actual requirements may differ from schema

**Evidence:**
```typescript
// lib/inngest/functions/deep-analysis.ts (Phase 1)
export const deepAnalysisFunction = inngest.createFunction(
  { id: 'deep-analysis-run', name: 'Deep Migration Analysis', retries: 2 },
  { event: 'deep-analysis.run' },
  async ({ event }) => {
    const { bidId } = event.data;
    console.log('[Inngest] Deep analysis triggered for bid:', bidId);
    return { success: true, bidId, message: 'Deep analysis placeholder' }; // ❌ Placeholder
  }
);

// lib/db/schema.ts (Phase 1)
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bidOpportunityId: text('bid_opportunity_id').notNull()
    .references(() => bidOpportunities.id),
  jobId: text('job_id').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  errorMessage: text('error_message'),
  sourceCMS: text('source_cms'),
  targetCMS: text('target_cms'),
  websiteUrl: text('website_url').notNull(),
  contentArchitecture: text('content_architecture'),     // ❌ Not used yet
  migrationComplexity: text('migration_complexity'),     // ❌ Not used yet
  accessibilityAudit: text('accessibility_audit'),       // ❌ Not used yet
  ptEstimation: text('pt_estimation'),                   // ❌ Not used yet
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
// 17 columns total, only 6 actually needed for placeholder
```

**Simpler Phase 1 Schema (YAGNI):**
```typescript
export const deepMigrationAnalyses = sqliteTable('deep_migration_analyses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bidOpportunityId: text('bid_opportunity_id').notNull()
    .references(() => bidOpportunities.id),
  jobId: text('job_id').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
// 6 columns - add more in Phase 2 when actually needed ✅
```

## Proposed Solutions

### Solution 1: Defer Schema Complexity to Phase 2 (Recommended for Future)
**Pros:**
- YAGNI compliance
- Schema evolves with actual requirements
- Easier to change if needs differ
- Less cognitive overhead in Phase 1

**Cons:**
- Requires schema migration in Phase 2
- Can't show "complete" schema upfront

**Effort**: N/A (already implemented with full schema)
**Risk**: N/A

**Recommended for NEXT Epic:**
```
Phase 1: Minimal viable schema (6 columns)
Phase 2: Add contentArchitecture column when agent implemented
Phase 3: Add migrationComplexity column when agent implemented
... etc
```

### Solution 2: Keep Full Schema (Current Approach)
**Pros:**
- All columns ready for future phases
- No migration needed in Phase 2-5
- Clear long-term structure

**Cons:**
- Violates YAGNI
- May not match actual Phase 2 requirements
- Over-engineering

**Effort**: N/A (current state)
**Risk**: Low (just tech debt, not a bug)

### Solution 3: Rollback to Minimal Schema Now
**Pros:**
- Adheres to YAGNI
- Cleaner Phase 1 delivery

**Cons:**
- Wastes work already done
- Need to drop/recreate table
- Delay Phase 1 completion

**Effort**: Medium (1-2 hours)
**Risk**: Medium (rollback complexity)

## Recommended Action

**Accept current approach for Epic 7**

The full schema is already implemented and working. Rollback would waste work and delay progress.

**Learn for future epics**: Apply YAGNI - add schema columns as features are implemented, not upfront.

**Priority**: P3 (Design guidance, not a blocking issue)

## Technical Details

**Philosophy:**
- YAGNI: "You Aren't Gonna Need It" - don't build for future requirements
- Incremental design: Add complexity when needed, not before
- Evolutionary architecture: Let structure emerge from actual requirements

**Trade-off:**
- Upfront design: More migrations, but adheres to YAGNI
- Full design: No migrations, but risks over-engineering

**Next Epic Recommendation:**
```typescript
// Phase 1: Minimal
export const newFeatureTable = sqliteTable('new_feature', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  status: text('status').notNull(),
  createdAt: integer('created_at').$defaultFn(() => new Date()),
});
// ✅ Only 4 columns, add more later

// Phase 2: Add when needed
ALTER TABLE `new_feature` ADD `result_data` text;
// ✅ Incremental growth based on actual requirements
```

## Acceptance Criteria

(For future epics, not Epic 7)
- [ ] Phase 1 schema includes only columns used by Phase 1 code
- [ ] Each subsequent phase adds columns as features are implemented
- [ ] Schema evolution tracked in migrations with clear phase labels
- [ ] Documentation explains incremental schema design approach

## Work Log

**2026-01-17**: Issue identified by code-simplicity-reviewer during Epic 7 Phase 1 review. Marked as P3 (design guidance for future work, not a blocker).

## Resources

- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
- [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html)
- [Agile Database Techniques](https://www.agiledata.org/essays/databaseRefactoring.html)
