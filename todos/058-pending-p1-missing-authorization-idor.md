---
status: pending
priority: p1
issue_id: '058'
tags: [code-review, security, authorization, idor, owasp-a01]
dependencies: []
---

# Missing Authorization Checks (IDOR) in Qualification API Endpoints

## Problem Statement

All qualification API endpoints verify authentication but do NOT verify authorization. Any authenticated user can access, modify, or delete any qualification by simply manipulating the ID in the URL. This is a classic Insecure Direct Object Reference (IDOR) vulnerability.

**Why it matters:**

- Any authenticated user can access confidential qualification data from other users/organizations
- Sensitive business intelligence, customer data, and pricing information exposed
- OWASP A01:2021 - Broken Access Control (top vulnerability category)
- Potential data breach and compliance violations (GDPR, SOC2)
- Attackers can enumerate IDs to harvest all qualification data

## Findings

**Location:** `app/api/qualifications/[id]/*.ts` (all route handlers)

**Evidence:**

```typescript
// Current pattern - only checks authentication, not authorization
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await context.params;

  // VULNERABILITY: No check if user owns/has access to this qualification
  const [qualification] = await db.select().from(qualifications).where(eq(qualifications.id, id));

  // Returns data without verifying ownership
  return NextResponse.json(qualification);
}
```

**Source:** Code review - Security findings

**Risk Level:** P1 Critical - OWASP A01:2021 Broken Access Control

## Proposed Solutions

### Solution 1: Add Organization/User Ownership Check (Recommended)

Add authorization check to verify user belongs to organization that owns the qualification.

**Pros:**

- Simple to implement with existing data model
- Works with current organization/user relationship
- Clear ownership semantics

**Cons:**

- Requires organization-based access model
- May need schema updates if ownership not clearly defined

**Effort:** Medium (4-6 hours)
**Risk:** Low

**Implementation:**

```typescript
import { auth } from '@/lib/auth/session';
import { and, eq } from 'drizzle-orm';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await context.params;

  // Authorization check: verify user has access to this qualification
  const [qualification] = await db
    .select()
    .from(qualifications)
    .innerJoin(
      userOrganizations,
      eq(qualifications.organizationId, userOrganizations.organizationId)
    )
    .where(and(eq(qualifications.id, id), eq(userOrganizations.userId, session.user.id)));

  if (!qualification) {
    // Return 404 to prevent ID enumeration
    return new Response('Not found', { status: 404 });
  }

  return NextResponse.json(qualification);
}
```

### Solution 2: Create Authorization Middleware

Create reusable middleware that handles authorization for all qualification routes.

**Pros:**

- DRY principle - single source of truth
- Consistent authorization across all endpoints
- Easier to audit and maintain

**Cons:**

- More upfront design work
- Need to handle different permission levels

**Effort:** Medium-Large (6-8 hours)
**Risk:** Low

### Solution 3: Role-Based Access Control (RBAC)

Implement full RBAC system with roles and permissions.

**Pros:**

- Flexible permission model
- Supports complex access patterns
- Industry standard approach

**Cons:**

- Significant implementation effort
- May be over-engineering for current needs
- Requires database schema changes

**Effort:** Large (2-3 days)
**Risk:** Medium

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `app/api/qualifications/[id]/route.ts`
- `app/api/qualifications/[id]/audit/route.ts`
- `app/api/qualifications/[id]/background-job/route.ts`
- `app/api/qualifications/[id]/deep-scan/*/route.ts`
- All other `app/api/qualifications/[id]/*.ts` files

**Affected Components:**

- Qualification API layer
- Deep scan endpoints
- Audit endpoints
- Background job endpoints

**Database Changes:**
May need to ensure organizationId or userId foreign key exists on qualifications table.

**Dependencies:**

- User-Organization relationship table
- Session/auth middleware

## Acceptance Criteria

- [ ] All qualification endpoints verify user has access to the requested qualification
- [ ] 404 returned for qualifications user cannot access (prevents enumeration)
- [ ] Authorization check happens before any data retrieval
- [ ] Tests added for authorization failure scenarios
- [ ] No information leakage about existence of inaccessible qualifications
- [ ] Authorization logic extracted to reusable helper/middleware
- [ ] Audit logging for authorization failures

## Work Log

**2026-01-25**: Todo created from code review security findings

## Resources

- OWASP A01:2021 Broken Access Control: https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- IDOR Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html
