---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, simplicity, yagni, database]
dependencies: []
---

# Database Schema Stores Duplicate Data (YAGNI Violation)

## Problem Statement

The `quickScans` table stores the same data in **two formats**: individual fields (`cms`, `framework`, `hosting`) AND full JSON (`techStack`, `contentVolume`). This creates maintenance burden, potential data inconsistency, and wastes storage.

**Impact:** MEDIUM - Violates YAGNI and DRY principles, increases complexity, no user benefit.

**Location:** `/Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts:289-331`

## Findings

**From code-simplicity-reviewer agent:**

**Current Schema:** 16 fields
```typescript
export const quickScans = sqliteTable('quick_scans', {
  // ... IDs and metadata

  // Individual fields (duplicates data in JSON)
  cms: text('cms'),                    // ❌ Also in techStack JSON
  framework: text('framework'),        // ❌ Also in techStack JSON
  hosting: text('hosting'),            // ❌ Also in techStack JSON
  pageCount: integer('page_count'),    // ❌ Also in contentVolume JSON
  integrations: text('integrations'),  // ❌ Never used anywhere

  // Full JSON fields (source of truth)
  techStack: text('tech_stack'),         // ✅ Complete tech data
  contentVolume: text('content_volume'), // ✅ Complete content data
  features: text('features'),            // ✅ Complete features data

  // More metadata
  recommendedBusinessLine: text('recommended_business_line').notNull(),
  confidence: integer('confidence'),
  reasoning: text('reasoning'),
  activityLog: text('activity_log'),     // ❌ Not useful (see separate todo)
  startedAt: integer('started_at'),      // ❌ Not meaningful to users
  // ...
});
```

**Problems:**
1. **Data Duplication:** `cms`, `framework`, `hosting` are extracted from `techStack` JSON and stored separately
2. **Unused Field:** `integrations` is defined but never populated or queried
3. **Unnecessary Field:** `startedAt` adds no value (only `completedAt` matters)
4. **Noise Field:** `activityLog` clutters database without user benefit

**Why It's Wrong:**
- Storing data twice violates DRY (Don't Repeat Yourself)
- Creates risk of inconsistency (individual fields could drift from JSON)
- No query optimization benefit (SQLite doesn't use these indexes effectively)
- Adds ~40 lines of unnecessary schema + migration code

## Proposed Solutions

### Solution 1: Minimal Schema (Recommended)
**Effort:** Medium (30-45 minutes)
**Risk:** Low (schema migration required)
**Pros:** Single source of truth, cleaner code, easier maintenance
**Cons:** Requires migration, slightly harder SQL queries

**Proposed Schema:** 7 essential fields
```typescript
export const quickScans = sqliteTable('quick_scans', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bidOpportunityId: text('bid_opportunity_id')
    .notNull()
    .references(() => bidOpportunities.id),
  websiteUrl: text('website_url').notNull(),
  status: text('status', {
    enum: ['running', 'completed', 'failed']
  }).notNull().default('running'),

  // Single JSON field for all results
  result: text('result'), // JSON: { techStack, contentVolume, features, blRecommendation }

  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
});
```

**Migration Strategy:**
1. Create new `result` JSON column
2. Migrate data: combine `techStack`, `contentVolume`, `features`, `blRecommendation` into `result`
3. Drop old columns in separate migration (for safety)

### Solution 2: Keep Individual Fields for Queries (Not Recommended)
**Effort:** Small (keep as-is)
**Risk:** Low
**Pros:** Easier SQL queries like "all Drupal scans"
**Cons:** Maintains duplication, violates YAGNI

Only remove unused fields (`integrations`, `activityLog`, `startedAt`), keep `cms`/`framework`/`hosting`.

**Why not recommended:** No evidence that individual field queries are needed. All current code uses JSON parsing.

## Recommended Action

**Implement Solution 1 (minimal schema).** The duplication adds complexity without proven benefit.

## Technical Details

**Affected Files:**
- `/Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts` (update schema)
- Create new migration in `/drizzle/` directory
- `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/actions.ts` (update to use single `result` field)

**Migration Steps:**
```typescript
// Migration: 0012_consolidate_quick_scan_results.sql
ALTER TABLE quick_scans ADD COLUMN result TEXT;

-- Migrate existing data
UPDATE quick_scans SET result = json_object(
  'techStack', tech_stack,
  'contentVolume', content_volume,
  'features', features,
  'blRecommendation', json_object(
    'recommendedBusinessLine', recommended_business_line,
    'confidence', confidence,
    'reasoning', reasoning
  )
);

-- Later migration (after verifying data):
-- ALTER TABLE quick_scans DROP COLUMN cms;
-- ALTER TABLE quick_scans DROP COLUMN framework;
-- ...
```

**Breaking Changes:**
- UI components need to access `result.techStack.cms` instead of `quickScan.cms`
- Server actions need to parse `result` JSON instead of accessing individual fields

## Acceptance Criteria

- [ ] New `result` TEXT column contains all scan data as JSON
- [ ] Migration successfully combines existing data into `result`
- [ ] All UI components updated to parse `result` JSON
- [ ] All server actions updated to write to `result` field
- [ ] Existing functionality unchanged (users see same data)
- [ ] Old columns can be safely dropped (verify with data check)
- [ ] Schema reduced from 16 fields to 7 fields

## Work Log

<!-- Add dated entries as you work on this -->

## Resources

- DRY Principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- YAGNI: "You Aren't Gonna Need It"
- Code Simplicity Reviewer: See agent output above
- Related: Todo #006 (remove activity log)
