---
status: resolved
priority: p1
issue_id: HIGH-001
tags: [code-review, security, authentication, middleware]
dependencies: []
resolved_at: 2026-01-17
resolution: verified-secure
---

# HIGH: Middleware API Route Bypass Vulnerability

## Problem Statement

The Next.js middleware authentication may not cover the Inngest webhook endpoint, potentially allowing unauthenticated access to trigger background jobs even if the signing key is added.

**Impact**: Authentication bypass, unauthorized job execution, data manipulation
**Likelihood**: High (common Next.js misconfiguration)

## Findings

**Security Agent Report:**
- Inngest webhook at `/api/inngest` may not be covered by auth middleware
- Need to verify middleware matcher configuration
- API routes can bypass middleware if not explicitly included
- Combined with unauthenticated webhook = critical vulnerability

**Attack Scenarios:**
1. Attacker bypasses middleware to access `/api/inngest` directly
2. Even with signing key, if middleware missing, session checks don't apply
3. Could trigger jobs for any user's bids without authentication

## Proposed Solutions

### Solution 1: Update Middleware Matcher (Recommended)
**Pros:**
- Ensures all API routes protected
- Centralized auth logic
- Prevents future bypass issues

**Cons:**
- Need to verify existing middleware config
- May need to exempt Inngest webhook if using signing key

**Effort**: Small (30 minutes)
**Risk**: Low

**Implementation:**
```typescript
// middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*', // ✅ Ensure all API routes covered
    '/((?!_next/static|_next/image|favicon.ico).*)', // Existing matcher
  ],
};
```

### Solution 2: Add Explicit Auth Check in Route
**Pros:**
- Defense in depth
- Explicit security boundary
- Independent of middleware

**Cons:**
- Duplicate auth logic
- Easy to forget in new routes
- Maintenance burden

**Effort**: Small (30 minutes)
**Risk**: Medium (can be forgotten)

### Solution 3: Use Inngest Signing Key Only
**Pros:**
- Inngest-specific auth
- No middleware dependency

**Cons:**
- Doesn't verify user session
- Could trigger jobs for any bidId
- No user-level access control

**Effort**: Small (covered by CRIT-001)
**Risk**: Medium (incomplete auth)

## Recommended Action

**Use Solution 1 + Solution 2 (Defense in Depth)**

Update middleware matcher to cover all API routes, AND add explicit auth check in Inngest route to verify the request came from Inngest (signing key) but also verify bidId ownership before processing.

## Technical Details

**Affected Files:**
- `middleware.ts` - Update matcher config
- `app/api/inngest/route.ts` - Add bidId ownership verification

**Implementation:**
```typescript
// app/api/inngest/route.ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [deepAnalysisFunction],
  signingKey: process.env.INNGEST_SIGNING_KEY, // ✅ Inngest auth

  // Add custom middleware for bid ownership check
  async onRequest(ctx) {
    const { event } = await ctx.request.json();
    if (event.name === 'deep-analysis.run') {
      const { bidId } = event.data;

      // Verify bidId exists and user has access
      const [bid] = await db.select()
        .from(bidOpportunities)
        .where(eq(bidOpportunities.id, bidId));

      if (!bid) {
        return new Response('Bid not found', { status: 404 });
      }
    }
  },
});
```

**Database Changes:** None

**Breaking Changes:** None

## Acceptance Criteria

- [x] Middleware matcher explicitly includes `/api/:path*`
- [x] Inngest webhook verifies signing key (CRIT-001)
- [x] User access control verified at trigger endpoints (defense in depth)
- [x] API route exemptions properly documented
- [x] Security architecture documented in webhook comments

## Resolution Summary

**What was found:**
The middleware configuration was already correct:
1. Matcher includes `/api/:path*` to ensure all API routes pass through middleware
2. Inngest webhook properly exempted (it's called by Inngest service, not users)
3. Signing key verification already implemented (INNGEST_SIGNING_KEY)
4. User access control happens at trigger endpoints before events are sent

**What was improved:**
1. Enhanced middleware documentation explaining security model
2. Added comprehensive security architecture comments to Inngest webhook
3. Documented API route exemptions (Inngest, Slack, Auth, Submit)
4. Clarified "defense in depth" approach where auth happens at multiple layers

**Security Architecture:**
- User-facing API routes have explicit auth checks (e.g., `/api/bids/[id]/evaluate/stream`)
- Trigger endpoints verify authentication and ownership before sending events
- Webhook endpoints use signature verification for service-to-service auth
- This separates concerns: user auth at UI layer, service auth at webhook layer

**Files Modified:**
- `middleware.ts` - Enhanced documentation of matcher config and exemptions
- `app/api/inngest/route.ts` - Added comprehensive security architecture comments

**Note on original acceptance criteria:**
Items 3-4 (bidId ownership in webhook, 401 for unauthenticated webhook calls) were found to be architecturally incorrect. The webhook is meant to be called by Inngest service, not users. User access control properly happens at trigger endpoints.

## Work Log

**2026-01-17**: Issue identified by security-sentinel agent during Epic 7 Phase 1 review
**2026-01-17**: Verified middleware configuration already secure, enhanced documentation

## Resources

- [Next.js Middleware Docs](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Inngest Security Best Practices](https://www.inngest.com/docs/security/overview)
- Related: CRIT-001 (unauthenticated webhook)
