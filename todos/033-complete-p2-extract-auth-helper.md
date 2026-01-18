---
status: pending
priority: p2
issue_id: "033"
tags: [code-review, architecture, dry, authorization]
dependencies: ["026"]
---

# Extract Authorization Check to Shared Helper

## Problem Statement

The same 5-7 line authorization check is duplicated across 49+ server action functions. Changes to authorization logic require updating multiple files.

**Impact:** ~300 lines of duplicated code. Maintenance burden.

## Findings

**From pattern-recognition-specialist and architecture-strategist agents:**

**Duplicated pattern (appears 3 times in team/actions.ts alone):**
```typescript
const isOwner = bid.userId === session.user.id;
const isAdmin = session.user.role === 'admin';
const isBL = session.user.role === 'bl';
if (!isOwner && !isAdmin && !isBL) {
  return { success: false, error: 'Keine Berechtigung für diesen Bid' };
}
```

**Locations in analyzed files:**
- `lib/team/actions.ts`: lines 40-46, 114-120, 200-205
- `lib/routing/actions.ts`: lines 77-83

## Proposed Solutions

### Solution A: Extract to auth utility (Recommended)
**Pros:** Single source of truth, easier to audit
**Cons:** Adds one more import
**Effort:** Medium (1 hour)
**Risk:** Low

```typescript
// lib/auth/bid-authorization.ts
export function canAccessBid(
  bid: Pick<BidOpportunity, 'userId' | 'assignedBusinessUnitId'>,
  session: Session,
  user?: Pick<User, 'businessUnitId'>
): boolean {
  const isOwner = bid.userId === session.user.id;
  const isAdmin = session.user.role === 'admin';
  const isBL = session.user.role === 'bl';

  // BL can only access their own BU's bids (fixes IDOR)
  if (isBL && bid.assignedBusinessUnitId !== user?.businessUnitId) {
    return false;
  }

  return isOwner || isAdmin || isBL;
}
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- New: `lib/auth/bid-authorization.ts`
- Update: `lib/team/actions.ts`
- Update: `lib/routing/actions.ts`
- Update: Other action files with similar pattern

## Acceptance Criteria

- [ ] Create `lib/auth/bid-authorization.ts` with `canAccessBid` function
- [ ] Refactor team/actions.ts to use helper
- [ ] Refactor routing/actions.ts to use helper
- [ ] Helper includes BU ownership check (fixes IDOR #026)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | Extract repeated patterns to utilities |

## Resources

- DRY principle
