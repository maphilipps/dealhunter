---
status: pending
priority: p2
issue_id: '022'
tags: [code-review, performance, database, n-plus-one]
dependencies: []
---

# 022 - MEDIUM: N+1 Query Pattern in Notifications

## Problem Statement

The `sendTeamNotifications` function queries the database N times for N team members instead of using a single batch query. This will degrade performance significantly under load.

## Findings

**Source:** performance-oracle agent

**Location:** `/Users/marc.philipps/Sites/dealhunter/lib/notifications/actions.ts:64-84`

**Current Implementation:**

```typescript
for (const member of teamData.members) {
  if (member.employeeId === 'new_hire') {
    continue;
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, member.employeeId))
    .limit(1);
  // ...
}
```

**Impact:**

- For team of 10 members: 10 DB queries instead of 1
- ~10-20ms per query \* N members = 100-400ms for typical teams
- At scale: Database connection pool exhaustion likely

## Proposed Solutions

### Solution 1: Batch query with IN clause (Recommended)

```typescript
const employeeIds = teamData.members
  .filter(m => m.employeeId !== 'new_hire')
  .map(m => m.employeeId);

const employeeRecords = await db.select().from(employees).where(inArray(employees.id, employeeIds));

const employeeMap = new Map(employeeRecords.map(e => [e.id, e]));
```

- **Effort:** Small
- **Risk:** Low
- **Pros:** Single query, O(1) lookups via Map
- **Cons:** None

## Recommended Action

**Solution 1** - Use batch query with IN clause

## Technical Details

**Affected Files:**

- `lib/notifications/actions.ts`

**Required Changes:**

1. Import `inArray` from drizzle-orm
2. Collect all employee IDs first
3. Single batch query
4. Build Map for O(1) lookups
5. Iterate Map instead of querying in loop

## Acceptance Criteria

- [ ] Only 1 database query for all team members
- [ ] Same functionality maintained
- [ ] Performance test shows improvement

## Work Log

| Date       | Action                            | Learning                 |
| ---------- | --------------------------------- | ------------------------ |
| 2026-01-18 | Discovered via performance-oracle | N+1 queries scale poorly |

## Resources

- Drizzle inArray: https://orm.drizzle.team/docs/operators#inarray
