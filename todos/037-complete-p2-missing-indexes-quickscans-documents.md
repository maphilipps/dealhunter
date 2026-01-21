---
status: complete
priority: p2
issue_id: '037'
tags: [performance, database, gemini-analysis]
dependencies: []
---

# Missing Database Indexes for quickScans and documents Tables

## Problem Statement

The `quickScans` and `documents` tables lack indexes on their foreign key columns (`bidOpportunityId`). This will degrade query performance as the dataset grows.

**Impact:** Slow queries when fetching Quick Scan results or documents for a bid.

## Findings

**From Gemini CLI large codebase analysis:**

**Missing indexes in `lib/db/schema.ts`:**

```typescript
// Line 395: quickScans.bidOpportunityId - used in getQuickScanResult
// Line 466: documents.bidOpportunityId - used in getBidDocuments
```

**Queries affected:**

- `lib/quick-scan/actions.ts` - `getQuickScanResult()` filters by `bidOpportunityId`
- `lib/bids/actions.ts` - `getBidDocuments()` filters by `bidOpportunityId`

## Proposed Solutions

### Solution A: Add indexes to schema (Recommended)

**Pros:** Simple fix, significant performance improvement
**Cons:** Migration required
**Effort:** Small (15 min)
**Risk:** Low

```typescript
// lib/db/schema.ts

export const quickScans = sqliteTable(
  'quick_scans',
  {
    // ... columns
  },
  table => ({
    bidOpportunityIdx: index('quick_scans_bid_opportunity_idx').on(table.bidOpportunityId),
  })
);

export const documents = sqliteTable(
  'documents',
  {
    // ... columns
  },
  table => ({
    bidOpportunityIdx: index('documents_bid_opportunity_idx').on(table.bidOpportunityId),
  })
);
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**

- `lib/db/schema.ts` (add index definitions)

**Database Changes:**

- Add index on `quick_scans.bid_opportunity_id`
- Add index on `documents.bid_opportunity_id`

## Acceptance Criteria

- [ ] Index added to `quickScans` table for `bidOpportunityId`
- [ ] Index added to `documents` table for `bidOpportunityId`
- [ ] Schema pushed with `npm run db:push`
- [ ] Query performance verified

## Work Log

| Date       | Action                           | Learnings                               |
| ---------- | -------------------------------- | --------------------------------------- |
| 2026-01-18 | Created from Gemini CLI analysis | Foreign keys should always have indexes |

## Resources

- Gemini CLI performance analysis output
