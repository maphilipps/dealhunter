---
status: pending
priority: p3
issue_id: "034"
tags: [code-review, data, maintenance]
dependencies: []
---

# Hardcoded Business Units Should Query Database

## Problem Statement

`lib/routing/actions.ts:199-212` returns a hardcoded array of business units instead of querying the database. The comment acknowledges this is temporary.

**Impact:** Mismatch between UI options and actual valid BUs in database.

## Findings

**From architecture-strategist agent:**

**Hardcoded values (lines 199-212):**
```typescript
export async function getAvailableBusinessUnits(): Promise<string[]> {
  // These are the business lines known to the Quick Scan agent
  // In a production system, these would come from the database
  return [
    'Banking & Insurance',
    'Automotive',
    'Energy & Utilities',
    // ...
  ];
}
```

## Proposed Solutions

### Solution A: Query database (Recommended)
**Pros:** Always up-to-date
**Cons:** One more DB query
**Effort:** Small (15 min)
**Risk:** Low

```typescript
export async function getAvailableBusinessUnits(): Promise<string[]> {
  const units = await db.select({ name: businessUnits.name })
    .from(businessUnits)
    .orderBy(businessUnits.name);

  return units.map(u => u.name);
}
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/routing/actions.ts` (lines 199-212)

## Acceptance Criteria

- [ ] Replace hardcoded array with database query
- [ ] Results ordered alphabetically
- [ ] Works when businessUnits table is empty

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | Don't hardcode data that exists in DB |

## Resources

- None
