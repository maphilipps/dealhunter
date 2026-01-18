---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, performance, database, n-plus-1]
dependencies: []
---

# N+1 Query Pattern in BL Review Detail Page

## Problem Statement

The BL Review detail page (`app/(dashboard)/bl-review/[id]/page.tsx`) makes 4 sequential database queries that could be combined into a single JOIN query.

**Impact:** 250-400ms per page load. At scale: 2-5 second page loads.

## Findings

**From performance-oracle agent:**

**Sequential queries (lines 71-111):**
```typescript
// Query 1: Get bid (line 71-75)
const [bid] = await db.select().from(bidOpportunities)...

// Query 2: Get user (line 82-86)
const [user] = await db.select().from(users)...

// Query 3: Get business unit (line 96-102)
const businessUnit = bid.assignedBusinessUnitId ? await db.select()...

// Query 4: Get quick scan (line 105-111)
const [quickScan] = bid.quickScanId ? await db.select()...
```

## Proposed Solutions

### Solution A: Use single JOIN query (Recommended)
**Pros:** 70-80% query time reduction
**Cons:** Slightly more complex query
**Effort:** Medium (30 min)
**Risk:** Low

```typescript
const result = await db
  .select({
    bid: bidOpportunities,
    user: users,
    businessUnit: businessUnits,
    quickScan: quickScans,
  })
  .from(bidOpportunities)
  .leftJoin(users, eq(users.id, session.user.id))
  .leftJoin(businessUnits, eq(businessUnits.id, bidOpportunities.assignedBusinessUnitId))
  .leftJoin(quickScans, eq(quickScans.id, bidOpportunities.quickScanId))
  .where(eq(bidOpportunities.id, id))
  .limit(1);
```

### Solution B: Use Promise.all for parallel queries
**Pros:** Simpler than JOIN
**Cons:** Still 4 queries, just parallel
**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `app/(dashboard)/bl-review/[id]/page.tsx` (lines 71-111)

## Acceptance Criteria

- [ ] Reduce 4 sequential queries to 1 JOIN or parallel queries
- [ ] Page load time reduced by at least 50%
- [ ] All data still correctly fetched

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from performance review | N+1 is a common Server Component issue |

## Resources

- Drizzle JOIN docs: https://orm.drizzle.team/docs/joins
