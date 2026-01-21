---
status: pending
priority: p3
issue_id: '041'
tags: [performance, caching, gemini-analysis]
dependencies: []
---

# BU Matching Results Should Be Cached

## Problem Statement

The BU Matching component fetches `/api/bids/${bidId}/bu-matching` on every mount without caching. If BU matching is computationally expensive (comparing against all business units), this wastes resources on repeated calculations.

**Impact:** Unnecessary computation, slower page loads, wasted API calls.

## Findings

**From Gemini CLI large codebase analysis:**

**File:** `components/bids/bu-matching-tab.tsx`

**Line 27 - Fetch without caching:**

```typescript
// Fetches on every component mount
useEffect(() => {
  fetch(`/api/bids/${bidId}/bu-matching`)
    .then(res => res.json())
    .then(data => setBuMatching(data));
}, [bidId]);
```

**Issues:**

1. No client-side caching (SWR/React Query)
2. No server-side caching (unstable_cache)
3. BU matching result computed every time
4. Result doesn't change unless bid requirements change

## Proposed Solutions

### Solution A: Store result in database (Recommended)

**Pros:** Single computation, persistent, fast subsequent loads
**Cons:** Schema change, need to invalidate on bid update
**Effort:** Medium (1 hour)
**Risk:** Low

```typescript
// Store BU matching result like Quick Scan
// In bidOpportunities table:
buMatchingResult: text('bu_matching_result'),
buMatchingCompletedAt: integer('bu_matching_completed_at', { mode: 'timestamp' }),

// Compute once and store
if (!bid.buMatchingResult) {
  const result = await computeBuMatching(bid);
  await db.update(bidOpportunities).set({
    buMatchingResult: JSON.stringify(result),
    buMatchingCompletedAt: new Date(),
  });
}
```

### Solution B: Use unstable_cache on API route

**Pros:** Simple, no schema change
**Cons:** Cache invalidation complexity
**Effort:** Small (30 min)
**Risk:** Low

```typescript
// In API route
import { unstable_cache } from 'next/cache';

const getCachedBuMatching = unstable_cache(
  async (bidId: string) => computeBuMatching(bidId),
  ['bu-matching'],
  { revalidate: 3600, tags: [`bid-${bidId}`] }
);
```

### Solution C: Use SWR on client

**Pros:** Simple client-side caching
**Cons:** Still computes on server each time (just caches response)
**Effort:** Small (15 min)
**Risk:** Low

```typescript
import useSWR from 'swr';

const { data: buMatching } = useSWR(`/api/bids/${bidId}/bu-matching`, fetcher, {
  revalidateOnFocus: false,
});
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**

- `components/bids/bu-matching-tab.tsx` (add caching)
- `app/api/bids/[id]/bu-matching/route.ts` (add server caching)
- Optionally: `lib/db/schema.ts` (add result column)

## Acceptance Criteria

- [ ] BU matching result cached after first computation
- [ ] Subsequent loads use cached result
- [ ] Cache invalidated when bid requirements change
- [ ] No redundant API calls on tab switches

## Work Log

| Date       | Action                           | Learnings                                         |
| ---------- | -------------------------------- | ------------------------------------------------- |
| 2026-01-18 | Created from Gemini CLI analysis | Expensive computations should be cached or stored |

## Resources

- [Next.js unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)
- [SWR documentation](https://swr.vercel.app/)
