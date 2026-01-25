---
id: '061'
title: N+1 Database Updates in Background Job
status: pending
priority: p1
created: 2026-01-25
assignee: null
tags:
  - performance
  - database
  - background-jobs
---

# N+1 Database Updates in Background Job

## Summary

The `updateJobProgress()` function is called inside loops in the deep scan processor, causing 40+ database writes per deep scan job. This pattern leads to connection pool exhaustion under load.

## Location

- **File:** `lib/bullmq/workers/deep-scan-processor.ts`
- **Pattern:** `updateJobProgress()` called inside loops

## Problem

Each iteration of the expert processing loop triggers a separate database update for job progress. With 11 experts and multiple progress updates per expert, this results in approximately 40+ database writes per job.

### Impact

- Connection pool exhaustion under concurrent load
- Increased latency due to excessive round-trips
- Database lock contention
- Potential job failures during high concurrency

## Proposed Solution

1. **Batch progress updates** - Accumulate progress changes and write them in batches (e.g., every 5 seconds or every N updates)
2. **Use Redis for intermediate state** - Store progress in Redis and sync to DB periodically
3. **Debounce updates** - Implement a debounced update mechanism that coalesces rapid updates

### Example Implementation

```typescript
// Before (N+1 pattern)
for (const expert of experts) {
  await runExpert(expert);
  await updateJobProgress(job.id, progress); // DB write per iteration
}

// After (batched)
const progressUpdater = createBatchedProgressUpdater(job.id, {
  flushInterval: 5000,
  maxBatchSize: 10,
});

for (const expert of experts) {
  await runExpert(expert);
  progressUpdater.queue(progress); // Queues, doesn't write immediately
}

await progressUpdater.flush(); // Final flush
```

## Acceptance Criteria

- [ ] Progress updates are batched or debounced
- [ ] Maximum 5-10 DB writes per deep scan job (down from 40+)
- [ ] Job progress UI still updates within 5 seconds of changes
- [ ] Load test passes with 10 concurrent jobs without pool exhaustion

## Related Issues

- ID 062: Connection Pool Exhaustion Risk
