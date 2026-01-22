---
status: pending
priority: p1
issue_id: DEA-138
tags: [code-review, database, data-integrity, transactions]
dependencies: []
---

# Missing Transaction Boundaries in Multi-Table Operations

## Problem Statement

In `lib/agents/deep-scan-orchestrator.ts` and `lib/leads/cms-selection-service.ts`, multiple database operations are performed without transaction wrappers. If one operation fails mid-way, the database is left in an inconsistent state.

## Findings

- **Source:** data-integrity-guardian
- **Files:**
  - `lib/agents/deep-scan-orchestrator.ts:executeSectionAgent()` - writes to both `leadSectionData` and `rfpEmbeddings`
  - `lib/leads/cms-selection-service.ts:selectCMSForLead()` - reads then writes without atomicity
- **Severity:** P1 - Data corruption risk
- **Impact:** Partial writes on failure, inconsistent state

**Example in executeSectionAgent:**

```typescript
// Store result in leadSectionData for caching
await db.insert(leadSectionData).values({...});  // Could fail here

// Store in RAG for semantic retrieval - orphaned if above fails
await db.insert(rfpEmbeddings).values({...});
```

## Proposed Solutions

### Solution 1: Drizzle Transaction Wrapper (Recommended)

Wrap multi-table operations in `db.transaction()`.

```typescript
await db.transaction(async (tx) => {
  await tx.insert(leadSectionData).values({...});
  await tx.insert(rfpEmbeddings).values({...});
});
```

**Pros:** Atomic operations, rollback on failure
**Cons:** Slight performance overhead
**Effort:** Medium (30 min per file)
**Risk:** Low

### Solution 2: Compensating Transactions

Manually track and rollback on failure.

**Pros:** More control
**Cons:** Complex, error-prone, not atomic
**Effort:** Large
**Risk:** High

## Recommended Action

Solution 1 - Use Drizzle transaction wrapper

## Technical Details

**Affected Files:**

- `lib/agents/deep-scan-orchestrator.ts:executeSectionAgent()`
- `lib/leads/cms-selection-service.ts:selectCMSForLead()`
- Review all other multi-table writes

**Search Pattern:**

```bash
grep -r "await db.insert" lib/ | grep -A5 "await db.insert"
```

## Acceptance Criteria

- [ ] All multi-table writes wrapped in transactions
- [ ] Rollback tested on intentional failure
- [ ] No partial writes possible
- [ ] Error handling preserves transaction boundary

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-22 | Created from code review | Always use transactions for related writes |

## Resources

- PR: DEA-138 subtasks
- Drizzle Transaction Docs: https://orm.drizzle.team/docs/transactions
