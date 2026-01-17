---
status: resolved
priority: p1
issue_id: ARCH-001
tags: [code-review, agent-native, architecture, api]
dependencies: [HIGH-003]
resolved_date: 2026-01-17
---

# CRITICAL: No API Routes for Agent Access (Violates Agent-Native Principles)

## Problem Statement

Epic 7 implements deep migration analysis as a UI-only feature with no API routes for programmatic access. This violates the core agent-native architecture principle that "anything a user can do, an agent can do."

**Impact**: Agents cannot trigger or access deep analysis, limiting automation and AI-driven workflows
**Severity**: Architectural violation, technical debt

## Findings

**Agent-Native Reviewer Report:**
- Deep analysis can only be triggered via UI button clicks
- No API route to programmatically start analysis
- No API route to check analysis status
- No API route to retrieve analysis results
- Agents cannot integrate with deep analysis workflow

**Current State:**
- ✅ Database schema exists
- ✅ Inngest background job exists
- ❌ NO `/api/bids/[id]/deep-analysis/trigger` route
- ❌ NO `/api/bids/[id]/deep-analysis/status` route
- ❌ NO `/api/bids/[id]/deep-analysis/results` route

**Violations:**
1. **Action Parity**: User can trigger analysis (UI button), agent cannot (no API)
2. **Context Parity**: User sees results (UI page), agent cannot retrieve (no API)
3. **Workflow Integration**: Deep analysis isolated from AI agent workflows

**Example Agent Use Cases (Currently Impossible):**
- AI agent auto-triggers deep analysis when BIT decision = "yes"
- Slack bot checks analysis status and notifies when complete
- Automated quality check retrieves results and validates data
- External system integrates deep analysis into approval workflow

## Proposed Solutions

### Solution 1: Add RESTful API Routes (Recommended)
**Pros:**
- Standard HTTP endpoints
- Easy to integrate with any client
- Supports both humans and agents
- Consistent with existing `/api/bids/[id]/evaluate/stream` pattern

**Cons:**
- Need to implement 3 routes
- Access control required (see HIGH-003)

**Effort**: Medium (3-4 hours)
**Risk**: Low

**Implementation:**
```typescript
// app/api/bids/[id]/deep-analysis/trigger/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const [bid] = await db.select()
    .from(bidOpportunities)
    .where(and(
      eq(bidOpportunities.id, params.id),
      eq(bidOpportunities.userId, session.user.id)
    ));

  if (!bid) return new Response('Not found', { status: 404 });

  // Trigger Inngest job
  const { ids } = await inngest.send({
    name: 'deep-analysis.run',
    data: { bidId: params.id, userId: session.user.id },
  });

  return Response.json({ jobId: ids[0], status: 'triggered' });
}

// app/api/bids/[id]/deep-analysis/status/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const [analysis] = await db.select()
    .from(deepMigrationAnalyses)
    .where(and(
      eq(deepMigrationAnalyses.bidOpportunityId, params.id),
      eq(deepMigrationAnalyses.userId, session.user.id) // Requires HIGH-003 fix
    ))
    .orderBy(desc(deepMigrationAnalyses.createdAt))
    .limit(1);

  if (!analysis) return Response.json({ status: 'not_started' });

  return Response.json({
    status: analysis.status,
    startedAt: analysis.startedAt,
    completedAt: analysis.completedAt,
    errorMessage: analysis.errorMessage,
  });
}

// app/api/bids/[id]/deep-analysis/results/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const [analysis] = await db.select()
    .from(deepMigrationAnalyses)
    .where(and(
      eq(deepMigrationAnalyses.bidOpportunityId, params.id),
      eq(deepMigrationAnalyses.userId, session.user.id),
      eq(deepMigrationAnalyses.status, 'completed')
    ))
    .orderBy(desc(deepMigrationAnalyses.createdAt))
    .limit(1);

  if (!analysis) return new Response('Not found', { status: 404 });

  return Response.json({
    contentArchitecture: JSON.parse(analysis.contentArchitecture!),
    migrationComplexity: JSON.parse(analysis.migrationComplexity!),
    accessibilityAudit: JSON.parse(analysis.accessibilityAudit!),
    ptEstimation: JSON.parse(analysis.ptEstimation!),
  });
}
```

### Solution 2: Add MCP Server for Deep Analysis
**Pros:**
- Native agent integration
- Type-safe tool definitions
- Follows agent-native best practices

**Cons:**
- More complex than HTTP routes
- Requires MCP infrastructure
- Higher learning curve

**Effort**: Large (6-8 hours)
**Risk**: Medium (new pattern for team)

### Solution 3: Defer to Phase 3 (Not Recommended)
**Pros:**
- Less work now
- Can focus on UI first

**Cons:**
- Violates agent-native principles
- Creates technical debt
- Limits automation potential
- Inconsistent architecture

**Effort**: N/A
**Risk**: High (accumulates tech debt)

## Recommended Action

**Use Solution 1: Add RESTful API Routes NOW (Phase 1.5)**

Agent-native architecture is a core principle, not a nice-to-have. These routes should be implemented before Phase 2 to ensure the feature is properly designed from the start.

## Technical Details

**Affected Files:**
- `app/api/bids/[id]/deep-analysis/trigger/route.ts` - NEW
- `app/api/bids/[id]/deep-analysis/status/route.ts` - NEW
- `app/api/bids/[id]/deep-analysis/results/route.ts` - NEW
- `lib/db/schema.ts` - Add userId (see HIGH-003)

**Dependencies:**
- HIGH-003: Must add userId to deepMigrationAnalyses for access control

**Database Changes:** None (uses existing schema + HIGH-003 changes)

**Breaking Changes:** None (additive only)

## Acceptance Criteria

- [ ] POST /api/bids/[id]/deep-analysis/trigger triggers Inngest job
- [ ] GET /api/bids/[id]/deep-analysis/status returns current status
- [ ] GET /api/bids/[id]/deep-analysis/results returns completed analysis
- [ ] All routes verify user owns the bid (access control)
- [ ] All routes return proper HTTP status codes (401, 404, 200)
- [ ] API documented in OpenAPI/Swagger spec
- [ ] Example curl commands in documentation
- [ ] Agent integration test verifies programmatic access

## Work Log

**2026-01-17**: Issue identified by agent-native-reviewer during Epic 7 Phase 1 review

**2026-01-17**: Issue resolved - Implemented all three API routes:
- `app/api/bids/[id]/deep-analysis/trigger/route.ts` (POST) - Already existed, enhanced with validation
- `app/api/bids/[id]/deep-analysis/status/route.ts` (GET) - New route created
- `app/api/bids/[id]/deep-analysis/results/route.ts` (GET) - New route created

All routes implement:
- Authentication via NextAuth session validation
- Ownership verification by joining through bidOpportunities table
- Proper HTTP status codes (401, 404, 200, 500)
- Error handling with descriptive messages

Note: Access control currently uses Solution 2 (join through bids table) as userId column has not been added to deepMigrationAnalyses table yet. See HIGH-003 for migration to direct userId-based access control.

## Resources

- [Agent-Native Architecture Principles](https://agent-native.com/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- Similar pattern: `app/api/bids/[id]/evaluate/stream/route.ts` (Epic 5a)
- Related: HIGH-003 (access control), ARCH-002 (API-first architecture)
