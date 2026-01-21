---
status: pending
priority: p2
issue_id: '029'
tags: [code-review, performance, database, indexes]
dependencies: []
---

# Missing Database Indexes for Performance

## Problem Statement

Several columns used in WHERE clauses lack database indexes, causing full table scans that degrade performance at scale.

**Impact:** Queries slow down O(n) as data grows. At 10,000 bids: 2-5 seconds per query.

## Findings

**From performance-oracle agent:**

**Missing indexes:**

1. `bidOpportunities.assignedBusinessUnitId` - Used in authorization checks and BL review lists
2. `bidOpportunities.status` - Used in workflow filtering
3. `employees.businessUnitId` - Used in team suggestions

**Current Impact:**

- At 10,000 bids: O(n) full table scan = 500-1000ms per query
- At 100,000 bids: 5-10 seconds per query

**With indexes:**

- O(log n) = 10-20ms per query

## Proposed Solutions

### Solution A: Add composite indexes to schema (Recommended)

**Pros:** 95%+ query time reduction
**Cons:** Slightly larger DB file
**Effort:** Small (15 min)
**Risk:** Low

```typescript
// lib/db/schema.ts - bidOpportunities table
export const bidOpportunities = sqliteTable(
  'bid_opportunities',
  {
    // ... existing columns
  },
  table => ({
    assignedBusinessUnitIdx: index('bid_opportunities_assigned_bu_idx').on(
      table.assignedBusinessUnitId
    ),
    statusIdx: index('bid_opportunities_status_idx').on(table.status),
    statusBusinessUnitIdx: index('bid_opportunities_status_bu_idx').on(
      table.status,
      table.assignedBusinessUnitId
    ),
    userIdIdx: index('bid_opportunities_user_id_idx').on(table.userId),
  })
);

// lib/db/schema.ts - employees table
export const employees = sqliteTable(
  'employees',
  {
    // ... existing columns
  },
  table => ({
    businessUnitIdx: index('employees_business_unit_idx').on(table.businessUnitId),
  })
);
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**

- `lib/db/schema.ts` (bidOpportunities and employees tables)

**Migration:**

```bash
npm run db:push  # Push schema changes
```

## Acceptance Criteria

- [ ] Add index on `bidOpportunities.assignedBusinessUnitId`
- [ ] Add index on `bidOpportunities.status`
- [ ] Add composite index on `(status, assignedBusinessUnitId)`
- [ ] Add index on `employees.businessUnitId`
- [ ] Run `npm run db:push` to apply changes

## Work Log

| Date       | Action                          | Learnings                  |
| ---------- | ------------------------------- | -------------------------- |
| 2026-01-18 | Created from performance review | Indexes critical for scale |

## Resources

- Drizzle index docs: https://orm.drizzle.team/docs/indexes-constraints
