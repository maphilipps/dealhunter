---
status: pending
priority: p1
issue_id:
tags: [code-review, database, data-integrity, transactions, bullmq]
dependencies: []
---

# Missing Transaction Boundaries in BullMQ Deep Scan Processor

## Problem Statement

In `lib/bullmq/workers/deep-scan-processor.ts`, multiple database operations are performed without transaction wrappers. If the system crashes between operations, the database will be left in an inconsistent state with partial data.

## Findings

- **Source:** code-review
- **Files:**
  - `lib/bullmq/workers/deep-scan-processor.ts` - multiple DB operations without transactions
- **Severity:** P1 - Data corruption risk on system failure
- **Impact:** System crash between operations results in inconsistent data

**Evidence:**

```bash
grep -r "transaction" lib/
# Returns nothing - no transaction usage in codebase
```

The deep-scan-processor performs multiple sequential database writes:

1. Update job status
2. Store section results
3. Update embeddings
4. Mark completion

If the worker crashes between any of these steps, the database state becomes inconsistent.

## Proposed Solutions

### Solution 1: Drizzle Transaction Wrapper (Recommended)

Wrap all related database operations in `db.transaction()`.

```typescript
await db.transaction(async (tx) => {
  // Update job status
  await tx.update(backgroundJobs).set({ status: 'processing' }).where(...);

  // Store section data
  await tx.insert(leadSectionData).values({...});

  // Update embeddings
  await tx.insert(rfpEmbeddings).values({...});

  // Mark completion
  await tx.update(backgroundJobs).set({ status: 'completed' }).where(...);
});
```

**Pros:** Atomic operations, automatic rollback on failure, data consistency guaranteed
**Cons:** Slight performance overhead, requires code restructuring
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: Idempotent Operations with Checkpoints

Design operations to be idempotent and use checkpoint tracking.

**Pros:** Allows partial recovery, more flexible
**Cons:** Complex implementation, still not fully atomic
**Effort:** Large (1-2 days)
**Risk:** Medium

### Solution 3: Saga Pattern

Implement compensating transactions for each operation.

**Pros:** Works across distributed systems
**Cons:** Very complex, overkill for single-database operations
**Effort:** Very Large
**Risk:** High

## Recommended Action

Solution 1 - Use Drizzle transaction wrapper for all multi-operation database writes in the deep-scan-processor.

## Technical Details

**Affected Files:**

- `lib/bullmq/workers/deep-scan-processor.ts`

**Search Pattern:**

```bash
grep -rn "await db\." lib/bullmq/
grep -rn "\.insert\|\.update\|\.delete" lib/bullmq/
```

**Migration Steps:**

1. Identify all database operation sequences in deep-scan-processor
2. Group related operations into transaction blocks
3. Pass `tx` instead of `db` to nested function calls
4. Add error handling that preserves transaction boundaries
5. Test with intentional failures to verify rollback

## Acceptance Criteria

- [ ] All multi-table writes in deep-scan-processor wrapped in transactions
- [ ] Transaction rollback tested with intentional failures
- [ ] No partial writes possible on worker crash
- [ ] Error handling preserves transaction boundaries
- [ ] `grep -r "transaction" lib/bullmq/` shows transaction usage

## Work Log

| Date       | Action                   | Learnings                                         |
| ---------- | ------------------------ | ------------------------------------------------- |
| 2026-01-25 | Created from code review | BullMQ workers need transaction safety for DB ops |

## Resources

- Drizzle Transaction Docs: https://orm.drizzle.team/docs/transactions
- BullMQ Best Practices: https://docs.bullmq.io/guide/best-practices
