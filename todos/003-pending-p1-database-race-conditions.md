---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, data-integrity, concurrency, database]
dependencies: []
---

# Database Race Conditions in Stream Endpoints

## Problem Statement

SSE stream endpoints perform multiple database operations (read bid, stream evaluation, update bid) without transaction boundaries or optimistic locking. If two users trigger evaluation simultaneously, or if a user triggers evaluation while another update is in progress, race conditions can cause data corruption, lost updates, or inconsistent state.

**Why it matters:**
- Data corruption risk (evaluation results overwritten)
- Inconsistent bid status transitions
- Lost agent outputs if concurrent writes occur
- User confusion when results don't match expectations
- Violates ACID properties

## Findings

**Location:** `app/api/bids/[id]/evaluate/stream/route.ts:54-82`
**Location:** `app/api/bids/[id]/quick-scan/stream/route.ts:54-60`

**Evidence:**
```typescript
// evaluate/stream/route.ts
const stream = createAgentEventStream(async (emit) => {
  // Long-running evaluation (30+ seconds)
  const result = await runBitEvaluationWithStreaming(...);

  // Update happens much later - what if bid changed?
  await db
    .update(bidOpportunities)
    .set({
      bitEvaluation: result,
      status: 'bit_decided',  // Race: status might have changed
      updatedAt: new Date().toISOString(),
    })
    .where(eq(bidOpportunities.id, id));
});
```

**Race Scenarios:**
1. User triggers evaluation twice in quick succession → second overwrites first
2. Evaluation completes while user edits bid → edits lost
3. Two agents update same bid fields → last write wins
4. Status transitions out of order → invalid state

**Source:** Data Integrity Guardian review agent

## Proposed Solutions

### Solution 1: Optimistic Locking with Version Field (Recommended)

Add version column, check on update, retry if mismatch.

**Pros:**
- Prevents lost updates
- Simple to implement with Drizzle
- Industry standard pattern
- No blocking/locking overhead

**Cons:**
- Requires schema migration
- Need retry logic for conflicts
- Client may need to refetch on conflict

**Effort:** Small (2-3 hours)
**Risk:** Low

**Implementation:**
```typescript
// Schema addition
export const bidOpportunities = sqliteTable('bid_opportunities', {
  // ... existing fields
  version: integer('version').notNull().default(1),
});

// Update with version check
const stream = createAgentEventStream(async (emit) => {
  // Fetch with version
  const [bid] = await db.select()
    .from(bidOpportunities)
    .where(eq(bidOpportunities.id, id));

  const currentVersion = bid.version;

  const result = await runBitEvaluationWithStreaming(...);

  // Update only if version matches
  const updated = await db
    .update(bidOpportunities)
    .set({
      bitEvaluation: result,
      status: 'bit_decided',
      version: currentVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(
      eq(bidOpportunities.id, id),
      eq(bidOpportunities.version, currentVersion)
    ));

  if (updated.rowsAffected === 0) {
    throw new Error('Bid was modified during evaluation');
  }
});
```

### Solution 2: Database Transactions

Wrap all operations in a transaction.

**Pros:**
- ACID guarantees
- Familiar pattern
- Rollback on failure

**Cons:**
- Long transactions (30+ seconds) hold locks
- Can cause deadlocks
- Not suitable for streaming operations
- Poor concurrency

**Effort:** Small (2-3 hours)
**Risk:** High (long-running transactions)

**Not Recommended** for streaming use case.

### Solution 3: Status-based Locking

Set status to 'evaluating' before running, prevent concurrent evals.

**Pros:**
- Simple application-level lock
- No schema changes
- Easy to understand

**Cons:**
- Not a complete solution (race on status set)
- Orphaned locks if process crashes
- No protection for other field updates

**Effort:** Small (1-2 hours)
**Risk:** Medium

**Should be combined** with Solution 1, not used alone.

## Recommended Action

*(To be filled during triage)*

## Technical Details

**Affected Files:**
- `lib/db/schema.ts` (add version field)
- `app/api/bids/[id]/evaluate/stream/route.ts` (add version check)
- `app/api/bids/[id]/quick-scan/stream/route.ts` (add version check)
- Any other endpoints that update bidOpportunities

**Database Changes:**
```sql
-- Migration
ALTER TABLE bid_opportunities ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

**Concurrency Patterns:**
- Optimistic locking (version field)
- Compare-and-swap on updates
- Retry logic for conflicts
- Status transitions validation

## Acceptance Criteria

- [ ] Version field added to bidOpportunities schema
- [ ] All updates check version before writing
- [ ] ConflictError thrown when version mismatch detected
- [ ] Client handles conflict errors gracefully
- [ ] Tests for concurrent update scenarios
- [ ] Migration script created and tested
- [ ] No orphaned evaluations if update fails
- [ ] Status transitions remain valid under concurrency
- [ ] Documentation updated with concurrency guarantees

## Work Log

**2026-01-16**: Todo created from Data Integrity Guardian review findings

## Resources

- Data Integrity Guardian review report
- Optimistic locking pattern: https://en.wikipedia.org/wiki/Optimistic_concurrency_control
- Drizzle transactions: https://orm.drizzle.team/docs/transactions
- Similar implementation: (find in codebase if exists)
