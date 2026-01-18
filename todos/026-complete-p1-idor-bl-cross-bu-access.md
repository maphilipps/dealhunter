---
status: pending
priority: p1
issue_id: "026"
tags: [code-review, security, authorization, idor]
dependencies: []
---

# IDOR Vulnerability - BL Role Cross-Business-Unit Access

## Problem Statement

The authorization logic in `lib/team/actions.ts` allows ANY user with BL role to access/modify any bid, regardless of which Business Unit they belong to. This creates an IDOR (Insecure Direct Object Reference) vulnerability.

**Impact:** A BL leader from "Banking & Insurance" can access and modify bids assigned to "Automotive". Critical security issue.

## Findings

**From security-sentinel agent:**

**Vulnerable Code (lines 40-46, 114-120, 200-205):**
```typescript
const isOwner = bid.userId === session.user.id;
const isAdmin = session.user.role === 'admin';
const isBL = session.user.role === 'bl';  // ANY BL can access ANY bid
if (!isOwner && !isAdmin && !isBL) {
  return { success: false, error: 'Keine Berechtigung' };
}
```

**Correct Implementation (page.tsx:88-93):**
```typescript
if (session.user.role !== 'admin') {
  if (bid.assignedBusinessUnitId !== user?.businessUnitId) {
    redirect('/bl-review');  // Checks BU ownership
  }
}
```

## Proposed Solutions

### Solution A: Add Business Unit ownership check (Recommended)
**Pros:** Fixes vulnerability, matches page authorization
**Cons:** Requires additional DB query for user's BU
**Effort:** Small (30 min)
**Risk:** Low

```typescript
const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

if (isBL && bid.assignedBusinessUnitId !== user?.businessUnitId) {
  return { success: false, error: 'Keine Berechtigung für diesen Bid' };
}
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/team/actions.ts` (lines 40-46, 114-120, 200-205)

**Comparison:**
- Page authorization (page.tsx:88-93) - CORRECT
- Action authorization (team/actions.ts) - VULNERABLE

## Acceptance Criteria

- [ ] `suggestTeamForBid` validates BL user's business unit matches bid's assigned BU
- [ ] `assignTeam` validates BL user's business unit matches bid's assigned BU
- [ ] `getTeamAssignment` validates BL user's business unit matches bid's assigned BU
- [ ] Test: BL user from different BU cannot access bid

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from security review | Authorization must check resource ownership, not just role |

## Resources

- OWASP IDOR: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References
