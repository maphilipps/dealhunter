---
status: pending
priority: p1
issue_id: '001'
tags: [code-review, security, authentication, sse]
dependencies: []
---

# SSE Endpoints Missing Authentication

## Problem Statement

The Server-Sent Events (SSE) endpoints for BIT evaluation and Quick Scan are publicly accessible without any authentication or authorization checks. This allows any user to stream agent execution data for any bid by simply knowing the bid ID, creating a critical security vulnerability.

**Why it matters:**

- Unauthorized access to sensitive business intelligence data
- Potential exposure of proprietary evaluation criteria and agent reasoning
- GDPR/privacy violations if bids contain personal data
- Can be exploited to DoS the system by opening many concurrent streams

## Findings

**Location:** `app/api/bids/[id]/evaluate/stream/route.ts:16-98`
**Location:** `app/api/bids/[id]/quick-scan/stream/route.ts:16-76`

**Evidence:**

```typescript
// No auth checks present
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // Directly fetches bid without checking user ownership
  const [bid] = await db.select().from(bidOpportunities)...
```

**Source:** Security Sentinel review agent

**Risk Level:** P0 Critical - Blocks merge, requires immediate fix

## Proposed Solutions

### Solution 1: Session-based Authentication (Recommended)

Add session middleware to verify authenticated user and check bid ownership.

**Pros:**

- Uses existing Next.js auth patterns
- Simple to implement with middleware
- Works with existing session infrastructure

**Cons:**

- Requires session management overhead
- May need CSRF protection

**Effort:** Small (2-3 hours)
**Risk:** Low

**Implementation:**

```typescript
import { auth } from '@/lib/auth/session';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1. Verify authentication
  const session = await auth(request);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await context.params;

  // 2. Verify bid ownership
  const [bid] = await db
    .select()
    .from(bidOpportunities)
    .where(and(eq(bidOpportunities.id, id), eq(bidOpportunities.userId, session.user.id)));

  if (!bid) {
    return new Response('Not found', { status: 404 });
  }

  // Continue with streaming...
}
```

### Solution 2: Token-based Authentication

Use short-lived tokens generated when user navigates to bid detail page.

**Pros:**

- Works well with SSE (can't set custom headers in EventSource)
- More granular control over stream access
- Can implement token expiry

**Cons:**

- More complex implementation
- Requires token storage and validation
- Need token refresh mechanism

**Effort:** Medium (4-6 hours)
**Risk:** Medium

### Solution 3: API Key Authentication

Use API keys for machine-to-machine access.

**Pros:**

- Simple for automated systems
- No session management

**Cons:**

- Not suitable for browser clients
- Key rotation complexity
- Not appropriate for user-facing SSE streams

**Effort:** Small (2-3 hours)
**Risk:** Low

**Not Recommended** for this use case.

## Recommended Action

_(To be filled during triage)_

## Technical Details

**Affected Files:**

- `app/api/bids/[id]/evaluate/stream/route.ts`
- `app/api/bids/[id]/quick-scan/stream/route.ts`

**Affected Components:**

- SSE streaming infrastructure
- BIT evaluation endpoint
- Quick Scan endpoint

**Database Changes:**
None required if using existing user/session tables.

**Dependencies:**

- Auth middleware implementation
- Session management library

## Acceptance Criteria

- [ ] Both SSE endpoints require valid authentication
- [ ] Endpoints verify user owns the bid being accessed
- [ ] 401 Unauthorized returned for unauthenticated requests
- [ ] 404 Not Found returned when bid doesn't exist or user lacks permission
- [ ] Auth checks happen before any database queries
- [ ] Tests added for auth failure scenarios
- [ ] No information leakage in error responses
- [ ] Works with existing frontend EventSource connections

## Work Log

**2026-01-16**: Todo created from Security Sentinel review findings

## Resources

- Security Sentinel review report
- Next.js authentication patterns: https://nextjs.org/docs/app/building-your-application/authentication
- EventSource authentication patterns: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
