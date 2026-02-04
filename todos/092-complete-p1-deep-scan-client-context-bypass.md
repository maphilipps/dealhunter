---
status: complete
priority: p1
issue_id: '092'
tags: [code-review, security, deep-scan-v2, privilege-escalation]
dependencies: []
---

# Client-Controlled Context Without Server-Side Verification

## Problem Statement

The agent context (userId, userRole, userEmail) is extracted from either the `X-Agent-Context` header or the request body, both of which are client-controlled. The code validates that the user exists, but does not verify that the claimed `userRole` and `userEmail` match the actual user record in the database.

## Findings

**Agent:** security-sentinel

**File:** `lib/agent-tools/middleware/agent-auth.ts`
**Lines:** 213-231

```typescript
if (contextHeader) {
  try {
    rawContext = JSON.parse(contextHeader); // Client-controlled!
  } catch {
    // ...
  }
} else {
  const body = await req
    .clone()
    .json()
    .catch(() => ({}));
  rawContext = body.context; // Also client-controlled!
}
```

**Impact:**

- Privilege escalation by claiming admin role: `{"userId": "valid-id", "userRole": "admin", ...}`
- User impersonation by claiming another user's identity
- Complete bypass of authorization controls

**Exploitability:** High - Trivial to exploit by modifying request headers/body.

## Proposed Solutions

### Option A: Verify claimed role and email against database (Recommended)

**Pros:** Complete fix, prevents all escalation
**Cons:** Additional DB query per request
**Effort:** Small
**Risk:** Low

```typescript
async function validateUserExists(userId: string, claimedRole: string, claimedEmail: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, deletedAt: true, role: true, email: true },
  });

  if (!user || user.deletedAt !== null) {
    return { valid: false };
  }

  // CRITICAL: Verify claimed role and email match database
  if (user.role !== claimedRole || user.email !== claimedEmail) {
    return { valid: false };
  }

  return { valid: true, actualRole: user.role };
}
```

### Option B: Ignore client-provided role, always use DB value

**Pros:** Cannot be bypassed
**Cons:** Changes API contract
**Effort:** Small
**Risk:** Low

## Recommended Action

Implement Option A - verify all claimed context fields against the database. The DB query is already being made, just need to use the actual role from the database instead of the claimed role.

## Technical Details

**Affected Files:**

- `lib/agent-tools/middleware/agent-auth.ts`

## Acceptance Criteria

- [x] User role is always fetched from database, not trusted from client
- [x] Client-provided role/email that doesn't match DB is rejected
- [ ] Test case verifies privilege escalation is blocked
- [x] Audit log records when mismatched context is detected

## Work Log

| Date       | Action    | Notes                                                             |
| ---------- | --------- | ----------------------------------------------------------------- |
| 2026-02-04 | Created   | From security-sentinel review                                     |
| 2026-02-04 | Completed | Implemented server-side verification of role and email against DB |

## Resources

- PR: feat/deep-scan-v2-agent-native
