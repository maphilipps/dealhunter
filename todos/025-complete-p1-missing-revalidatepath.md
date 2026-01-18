---
status: pending
priority: p1
issue_id: "025"
tags: [code-review, nextjs, server-actions, caching]
dependencies: []
---

# Missing revalidatePath in Server Actions

## Problem Statement

Server Actions in `lib/routing/actions.ts` and `lib/team/actions.ts` update the database but do NOT call `revalidatePath()`. This means the UI won't reflect changes until manual refresh.

**Impact:** Users see stale data after performing actions. Critical UX issue.

## Findings

**From nextjs-reviewer agent:**

1. `lib/routing/actions.ts:159` - After `assignBusinessUnit()` updates bid, no revalidation
2. `lib/team/actions.ts:165` - After `assignTeam()` updates bid, no revalidation

**Evidence:**
```typescript
// After successful update (line 159), there's no:
// revalidatePath(`/bl-review/${bidId}`);
// revalidatePath('/bl-review');
```

## Proposed Solutions

### Solution A: Add revalidatePath after mutations (Recommended)
**Pros:** Simple, follows Next.js best practices
**Cons:** None
**Effort:** Small (15 min)
**Risk:** Low

```typescript
import { revalidatePath } from 'next/cache';

// After successful update:
revalidatePath(`/bl-review/${bidId}`);
revalidatePath('/bl-review');
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/routing/actions.ts` (line 159, after update)
- `lib/team/actions.ts` (line 165, after update)

## Acceptance Criteria

- [ ] `assignBusinessUnit` calls `revalidatePath` after successful update
- [ ] `assignTeam` calls `revalidatePath` after successful update
- [ ] UI reflects changes immediately without manual refresh

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | Next.js Server Actions require explicit revalidation |

## Resources

- [Next.js revalidatePath docs](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
