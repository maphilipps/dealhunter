---
status: complete
priority: p1
issue_id: '095'
tags: [code-review, data-integrity, deep-scan-v2, race-condition]
dependencies: []
---

# Delete Tool Race Condition

## Problem Statement

The delete operation checks the run status, then deletes in a separate statement without a transaction. This creates a race condition where the status could change between the check and the delete.

## Findings

**Agent:** data-integrity-guardian

**File:** `lib/agent-tools/tools/deep-scan.ts`
**Lines:** 363-395

```typescript
async execute(input, _context) {
  const run = await db.query.deepScanV2Runs.findFirst({...});

  if (!run) { return { success: false, error: ... }; }

  // Status check
  if (!['completed', 'failed', 'cancelled'].includes(run.status)) {
    return { success: false, error: ... };
  }

  // DELETE - NOT in transaction with status check!
  await db.delete(deepScanV2Runs).where(eq(deepScanV2Runs.id, input.runId));

  return { success: true, data: { deleted: true } };
}
```

**Race condition scenario:**

1. Thread A: Calls delete, checks status = 'completed'
2. Thread B: Calls retry, changes status to 'pending'
3. Thread A: Executes DELETE
4. Result: A pending run is deleted, losing work in progress

**Impact:**

- Data loss when concurrent operations occur
- Work in progress can be deleted unexpectedly
- No audit trail of deletion in race scenarios

## Proposed Solutions

### Option A: Use transaction with row lock (Recommended)

**Pros:** Guarantees atomicity, prevents races
**Cons:** Slightly higher DB load
**Effort:** Small
**Risk:** Low

```typescript
await db.transaction(async tx => {
  const [run] = await tx
    .select()
    .from(deepScanV2Runs)
    .where(eq(deepScanV2Runs.id, input.runId))
    .for('update'); // Row-level lock

  if (!run) {
    throw new Error(`Run ${input.runId} nicht gefunden`);
  }

  if (!['completed', 'failed', 'cancelled'].includes(run.status)) {
    throw new Error(`Run kann im Status '${run.status}' nicht gelöscht werden`);
  }

  await tx.delete(deepScanV2Runs).where(eq(deepScanV2Runs.id, input.runId));
});
```

### Option B: Use conditional DELETE

**Pros:** Single statement
**Cons:** Less clear error message
**Effort:** Small
**Risk:** Low

```typescript
const result = await db
  .delete(deepScanV2Runs)
  .where(
    and(
      eq(deepScanV2Runs.id, input.runId),
      inArray(deepScanV2Runs.status, ['completed', 'failed', 'cancelled'])
    )
  )
  .returning({ id: deepScanV2Runs.id });

if (result.length === 0) {
  return { success: false, error: 'Run nicht gefunden oder Status ungültig' };
}
```

## Recommended Action

Implement Option A for explicit error handling and audit trail.

## Technical Details

**Affected Files:**

- `lib/agent-tools/tools/deep-scan.ts`

**Also consider for:**

- Cancel tool
- Retry tool

## Acceptance Criteria

- [x] Delete operation is wrapped in transaction
- [x] Row-level lock prevents concurrent modification
- [x] Clear error messages for each failure case
- [x] Activity log entry before deletion

## Work Log

| Date       | Action    | Notes                                                              |
| ---------- | --------- | ------------------------------------------------------------------ |
| 2026-02-04 | Created   | From data-integrity-guardian review                                |
| 2026-02-04 | Completed | Wrapped DELETE, CANCEL, RETRY in transactions with row-level locks |

## Resources

- PR: feat/deep-scan-v2-agent-native
