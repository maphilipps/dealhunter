---
status: pending
priority: p2
issue_id: '002'
tags: [code-review, performance, api, database, qualifications]
dependencies: []
---

# Optimize Central Bidder Question Query

## Problem Statement

The dashboard summary endpoint currently loads all embeddings for `agentName='prequal_section_agent'` and filters open questions in application code. As datasets grow, this increases DB read volume, JSON parsing cost, and response time for `/dashboard-summary`.

## Findings

- In `/Users/marc.philipps/Sites/dealhunter/app/api/qualifications/[id]/dashboard-summary/route.ts:82-93`, `getCentralBidderQuestions()` fetches all rows with `agentName='prequal_section_agent'` for a qualification.
- Filtering for open questions happens after fetch (`isOpenQuestion` and metadata parsing) at `/Users/marc.philipps/Sites/dealhunter/app/api/qualifications/[id]/dashboard-summary/route.ts:98-120`.
- The query already requests `createdAt`, but ordering is not pushed into DB, so heavy in-memory work remains for large result sets.

## Proposed Solutions

### Option 1: Narrow Query to Question Rows (Recommended)

**Approach:** Query only `chunkType='bidder_question'` (and optionally explicitly include section findings with `metadata.kind='open_question'` using SQL JSON filters), reducing payload before application parsing.

**Pros:**

- Immediate response-time and memory improvement
- Minimal code churn
- Clear data contract for centralized questions

**Cons:**

- Requires precise backward-compatibility behavior for legacy rows
- Slight SQL complexity if both sources are needed

**Effort:** Small (1-3 hours)

**Risk:** Low

---

### Option 2: Persist Dedicated Read Model for Central Questions

**Approach:** Write centralized bidder questions into a dedicated table or dedicated chunk type only, and read exclusively from that source.

**Pros:**

- Best long-term performance and clarity
- Simplifies summary endpoint logic

**Cons:**

- Schema/data migration effort
- Requires rollout/backfill strategy

**Effort:** Medium (4-8 hours)

**Risk:** Medium

## Recommended Action

Pending triage.

## Technical Details

**Affected files:**

- `/Users/marc.philipps/Sites/dealhunter/app/api/qualifications/[id]/dashboard-summary/route.ts`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualifications/sections/decision-grade-utils.ts`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualifications/sections/section-utils.ts`

**Related components:**

- Dashboard summary API
- Section artifact persistence/deletion

**Database changes:**

- Not required for Option 1
- Potentially required for Option 2

## Resources

- Endpoint: `/api/qualifications/[id]/dashboard-summary`
- Function: `getCentralBidderQuestions()`

## Acceptance Criteria

- [ ] Central question query does not fetch full section finding corpus by default
- [ ] Endpoint behavior remains correct for centralized bidder question display
- [ ] Response time/memory for summary endpoint improves on large datasets
- [ ] Regression tests cover question extraction behavior

## Work Log

### 2026-02-11 - Initial Review Capture

**By:** Codex

**Actions:**

- Reviewed central bidder question data path end-to-end.
- Identified broad query + app-layer filtering bottleneck.
- Captured optimization options with migration/no-migration paths.

**Learnings:**

- Existing persistence model already stores dedicated `bidder_question` rows, so narrowing query is feasible.

## Notes

- Keep section-reference enrichment behavior unchanged while optimizing query shape.
