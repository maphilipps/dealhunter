---
status: pending
priority: p2
issue_id: DEA-138
tags: [code-review, performance, database, dry]
dependencies: []
---

# Duplicate Database Query in compareCMSOptions

## Problem Statement

In `lib/leads/cms-selection-service.ts`, the `compareCMSOptions` function queries the lead again even though the caller likely already has this data. This causes N+1 query patterns.

## Findings

- **Source:** performance-oracle, kieran-typescript-reviewer
- **File:** `lib/leads/cms-selection-service.ts:compareCMSOptions()`
- **Severity:** P2 - Performance issue
- **Impact:** Unnecessary database round-trips

**Current pattern:**

```typescript
export async function compareCMSOptions(leadId: string) {
  const leadData = await db.select().from(leads)...  // Duplicate query
  // ...
}
```

## Proposed Solutions

### Solution 1: Accept Lead Data as Parameter (Recommended)

Refactor to accept pre-fetched lead data.

```typescript
export async function compareCMSOptions(
  leadId: string,
  leadData?: typeof leads.$inferSelect
) {
  const lead = leadData ?? await db.select().from(leads)...;
  // ...
}
```

**Pros:** Flexible, no breaking change, eliminates duplicate
**Cons:** Optional param complexity
**Effort:** Small (15 min)
**Risk:** Low

### Solution 2: Merge with getCMSOptionsForLead

Combine the two functions as they share logic.

**Pros:** DRY
**Cons:** Larger refactor
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Solution 1 - Accept lead data as optional parameter

## Technical Details

**Affected Files:**

- `lib/leads/cms-selection-service.ts`

## Acceptance Criteria

- [ ] No duplicate lead query when data already available
- [ ] Function still works standalone
- [ ] Callers updated to pass data when available

## Work Log

| Date       | Action                   | Learnings                                 |
| ---------- | ------------------------ | ----------------------------------------- |
| 2026-01-22 | Created from code review | Avoid re-fetching data caller already has |

## Resources

- PR: DEA-138 subtasks
