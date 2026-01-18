---
status: pending
priority: p3
issue_id: "040"
tags: [architecture, performance, async, gemini-analysis]
dependencies: []
---

# Quick Scan Server Action Should Use Background Job

## Problem Statement

The Quick Scan server action blocks the HTTP response while waiting for a potentially long-running AI agent process. This risks timeouts (Vercel's 10-60s limit) and poor user experience.

**Impact:** Request timeouts, blocked UI, poor UX during AI processing.

## Findings

**From Gemini CLI large codebase analysis:**

**File:** `lib/quick-scan/actions.ts`

**Line 65 - Blocking await:**
```typescript
export async function startQuickScan(bidId: string) {
  // ... validation

  // THIS BLOCKS until AI agent completes (could be 30+ seconds)
  const scanResult = await runQuickScan({
    bidId,
    extractedRequirements,
    // ...
  });

  // Only returns after full completion
  return { success: true, result: scanResult };
}
```

**Current flow:**
```
User clicks "Start Scan"
  → Server Action starts
  → AI Agent runs (30-60 seconds)
  → Response returns
  → UI updates
```

**Problem:** User sees loading spinner for 30-60 seconds, risk of timeout.

## Proposed Solutions

### Solution A: Fire-and-forget with polling (Recommended)
**Pros:** Immediate response, no timeout risk, good UX
**Cons:** Requires polling logic on client
**Effort:** Medium (1-2 hours)
**Risk:** Low

```typescript
// Server Action - returns immediately
export async function startQuickScan(bidId: string) {
  // Validate and create pending record
  await db.insert(quickScans).values({
    bidOpportunityId: bidId,
    status: 'pending',
  });

  // Trigger background processing (fire-and-forget)
  runQuickScanBackground(bidId).catch(console.error);

  return { success: true, status: 'pending' };
}

// Background function (not awaited)
async function runQuickScanBackground(bidId: string) {
  const result = await runQuickScan({ bidId, ... });
  await db.update(quickScans).set({
    status: 'completed',
    result: JSON.stringify(result),
  }).where(eq(quickScans.bidOpportunityId, bidId));
}

// Client polls for completion
const { data } = useSWR(`/api/quick-scan/${bidId}/status`, fetcher, {
  refreshInterval: 2000,
});
```

### Solution B: Streaming with AI SDK
**Pros:** Real-time updates, best UX
**Cons:** More complex, requires streaming setup
**Effort:** Large (3-4 hours)
**Risk:** Medium

### Solution C: Inngest/background job service
**Pros:** Robust, retries, monitoring
**Cons:** Additional dependency, infrastructure
**Effort:** Large (4+ hours)
**Risk:** Medium

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/quick-scan/actions.ts` (refactor to async pattern)
- `components/bids/bid-detail-client.tsx` (add polling)
- Possibly new API route for status polling

## Acceptance Criteria

- [ ] `startQuickScan` returns immediately (< 1 second)
- [ ] Quick Scan runs in background
- [ ] Client shows progress/pending state
- [ ] Client polls or streams for completion
- [ ] No timeout errors on Vercel

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from Gemini CLI analysis | Long AI operations should never block HTTP responses |

## Resources

- [Vercel Serverless Function Timeout Limits](https://vercel.com/docs/functions/runtimes#max-duration)
- [SWR for polling](https://swr.vercel.app/docs/revalidation#revalidate-on-interval)
