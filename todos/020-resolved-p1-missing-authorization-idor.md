---
status: pending
priority: p1
issue_id: '020'
tags: [code-review, security, idor, server-actions]
dependencies: []
---

# 020 - HIGH: Missing Authorization Check (IDOR Vulnerability)

## Problem Statement

All new server actions lack authorization checks. While authentication is verified (`auth()`), there is no check to ensure the authenticated user has permission to access/modify the specific bid. Any authenticated user can access ANY bid.

## Findings

**Source:** security-sentinel agent

**Severity:** HIGH - Exploitability: Easy, Impact: High

**Affected Functions:**

- `triggerBaselineComparison` - `lib/baseline-comparison/actions.ts`
- `getBaselineComparisonResult` - `lib/baseline-comparison/actions.ts`
- `triggerProjectPlanning` - `lib/project-planning/actions.ts`
- `getProjectPlan` - `lib/project-planning/actions.ts`
- `updateProjectPhase` - `lib/project-planning/actions.ts`
- `sendTeamNotifications` - `lib/notifications/actions.ts`
- `getNotificationStatus` - `lib/notifications/actions.ts`

**Evidence:**

```typescript
// Current code - only checks authentication, not authorization
const session = await auth();
if (!session?.user?.id) {
  return { success: false, error: 'Nicht authentifiziert' };
}

const [bid] = await db.select()...where(eq(bidOpportunities.id, bidId));
// MISSING: Check if session.user.id has permission to access this bid
```

**Reference:** Existing code in `lib/bit-evaluation/actions.ts` (lines 33-35) DOES check ownership:

```typescript
if (bid.userId !== session.user.id) {
  return { success: false, error: 'Keine Berechtigung' };
}
```

## Proposed Solutions

### Solution 1: Add ownership check to each action (Recommended)

- Add `bid.userId !== session.user.id` check after bid fetch
- Matches existing pattern in bit-evaluation/actions.ts
- **Effort:** Small
- **Risk:** Low
- **Pros:** Consistent with existing code, simple
- **Cons:** Duplicated code in each action

### Solution 2: Create shared helper function

- Create `requireAuthAndBid(bidId)` helper that combines auth + bid fetch + ownership check
- **Effort:** Medium
- **Risk:** Low
- **Pros:** DRY, centralized authorization logic
- **Cons:** More refactoring needed

## Recommended Action

**Solution 1** - Add ownership check to each action (quick fix), then consider Solution 2 in follow-up

## Technical Details

**Affected Files:**

- `lib/baseline-comparison/actions.ts`
- `lib/project-planning/actions.ts`
- `lib/notifications/actions.ts`

**Required Changes:**
Add after bid fetch in each action:

```typescript
if (bid.userId !== session.user.id) {
  return { success: false, error: 'Keine Berechtigung' };
}
```

## Acceptance Criteria

- [ ] All 7 server actions include ownership check
- [ ] User A cannot access User B's bids
- [ ] Tests confirm authorization is enforced
- [ ] No regression in normal bid access

## Work Log

| Date       | Action                           | Learning                        |
| ---------- | -------------------------------- | ------------------------------- |
| 2026-01-18 | Discovered via security-sentinel | Authentication != Authorization |

## Resources

- OWASP IDOR: https://owasp.org/www-project-web-security-testing-guide/
- Reference code: `lib/bit-evaluation/actions.ts:33-35`
