---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, agent-native, api, architecture]
dependencies: []
---

# Quick Scan Not Accessible to AI Agents (Agent-Native Violation)

## Problem Statement

The Quick Scan feature is only accessible through UI components and server actions requiring user authentication. AI agents cannot:
1. Programmatically trigger Quick Scans
2. Access scan results via API
3. Discover Quick Scan capabilities
4. Integrate scans into autonomous workflows

**Impact:** MEDIUM - Feature is not agent-native, violating the principle that "anything a user can do, an agent can do."

**Location:** Entire Quick Scan implementation

## Findings

**From agent-native-reviewer agent:**

**Current State:**
- ❌ No REST API endpoints for Quick Scan
- ❌ No MCP tools for Quick Scan
- ❌ No integration with Workflow DevKit
- ❌ Server actions require user session authentication
- ✅ Data is structured (Zod schemas) - good foundation
- ✅ Business logic separated from UI - good architecture

**Agent Capability Score:** 2/5

**What Agents Cannot Do:**
1. Cannot trigger scan for a bid (no API, only UI button)
2. Cannot poll for scan completion (no webhook, only manual refresh)
3. Cannot access raw results (JSON in database not exposed)
4. Cannot batch scan multiple bids
5. Cannot integrate into autonomous decision workflows

## Proposed Solutions

### Solution 1: REST API Endpoints (Recommended for Phase 1)
**Effort:** Medium (1-2 hours)
**Risk:** Low
**Pros:** Standard approach, easy to consume, works with any agent
**Cons:** Requires separate authentication mechanism

Create API routes:

**File 1:** `/Users/marc.philipps/Sites/dealhunter/app/api/quick-scan/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { startQuickScan } from '@/lib/quick-scan/actions';

const schema = z.object({
  bidId: z.string().uuid(),
  apiKey: z.string(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const validation = schema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Validate API key for agent authentication
  if (validation.data.apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await startQuickScan(validation.data.bidId);
  return NextResponse.json(result);
}
```

**File 2:** `/Users/marc.philipps/Sites/dealhunter/app/api/quick-scan/[bidId]/route.ts`
```typescript
export async function GET(
  req: Request,
  { params }: { params: { bidId: string } }
) {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await getQuickScanResult(params.bidId);
  return NextResponse.json(result);
}
```

### Solution 2: Workflow DevKit Integration
**Effort:** Medium (1-2 hours)
**Risk:** Low
**Pros:** Integrates with existing workflow infrastructure, durable execution
**Cons:** Only works within Workflow DevKit context

Add Quick Scan to inbound lead workflow:

**File:** `/Users/marc.philipps/Sites/dealhunter/workflows/inbound/steps.ts`
```typescript
export const stepQuickScan = async (bidId: string, websiteUrl: string) => {
  'use step';

  const result = await runQuickScan({
    websiteUrl,
    extractedRequirements: null
  });

  return result;
};
```

Update workflow:
```typescript
// workflows/inbound/index.ts
const extraction = await stepExtract(data);
const quickScan = await stepQuickScan(data.bidId, extraction.websiteUrl);
const qualification = await stepQualify(data, research, quickScan);
```

### Solution 3: MCP Tools (Long-term)
**Effort:** Large (3-4 hours)
**Risk:** Medium
**Pros:** Best agent discoverability, follows MCP standards
**Cons:** Requires MCP server setup, more complex

Expose Quick Scan as MCP tools for AI agents to discover and call.

## Recommended Action

**Implement Solution 1 (REST API) immediately** as it unblocks agent access with minimal effort. Add Solution 2 (Workflow integration) in next sprint for fully automated pipelines.

## Technical Details

**New Files:**
- `/Users/marc.philipps/Sites/dealhunter/app/api/quick-scan/route.ts` (POST - start scan)
- `/Users/marc.philipps/Sites/dealhunter/app/api/quick-scan/[bidId]/route.ts` (GET - get results)
- Add `INTERNAL_API_KEY` to `.env` for agent authentication

**Updated Files:**
- `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/actions.ts` (add system-level bypass for auth)

**Breaking Changes:** None - additive only

## Acceptance Criteria

- [ ] POST `/api/quick-scan` accepts `{ bidId, apiKey }` and starts scan
- [ ] GET `/api/quick-scan/[bidId]` returns structured JSON results
- [ ] API key authentication prevents unauthorized access
- [ ] API returns same data structure as UI components consume
- [ ] API documented in `/lib/quick-scan/README.md` for agent developers
- [ ] Integration test simulates agent workflow: POST scan → poll GET until complete

## Work Log

<!-- Add dated entries as you work on this -->

## Resources

- Agent-Native Principles: "Anything a user can do, an agent can do"
- MCP Documentation: https://modelcontextprotocol.io/
- Workflow DevKit: `/workflows/inbound/`
- Agent-Native Reviewer: See agent output above
