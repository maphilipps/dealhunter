---
id: '062'
title: Connection Pool Exhaustion Risk
status: pending
priority: p1
created: 2026-01-25
assignee: null
tags:
  - performance
  - database
  - infrastructure
---

# Connection Pool Exhaustion Risk

## Summary

The database connection pool is configured with a maximum of 20 connections, but the worker architecture can require up to 44 connections under normal operation. This guarantees connection pool exhaustion with concurrent jobs.

## Location

- **File:** `lib/db/index.ts`
- **Config:** `pool max: 20`

## Problem

### Connection Math

| Component                  | Connections Needed       |
| -------------------------- | ------------------------ |
| Workers per job            | 1                        |
| Experts per job            | 11 (running in parallel) |
| Queries per expert         | ~2                       |
| **Per job total**          | ~22 connections          |
| **With 2 concurrent jobs** | ~44 connections          |
| **Pool size**              | 20 connections           |

### Failure Mode

When pool is exhausted:

1. New queries wait for available connections
2. Timeouts occur after pool wait limit
3. Jobs fail with connection timeout errors
4. Cascading failures as retries compound the problem

## Proposed Solution

### Option A: Increase Pool Size (Quick Fix)

```typescript
// lib/db/index.ts
const pool = new Pool({
  max: 50, // Increase from 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

**Caveat:** Ensure the database can handle this many connections.

### Option B: Limit Expert Parallelism (Recommended)

```typescript
// Use p-limit or similar to control concurrency
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 experts running at once

const results = await Promise.all(experts.map(expert => limit(() => runExpert(expert))));
```

### Option C: Connection-Aware Job Queue

Configure BullMQ to limit concurrent jobs based on available connections:

```typescript
const worker = new Worker(queueName, processor, {
  concurrency: 1, // One job at a time per worker
  limiter: {
    max: 2,
    duration: 1000,
  },
});
```

### Recommended Approach

Combine options:

1. Increase pool to 40 connections (provides headroom)
2. Limit expert parallelism to 5 concurrent experts
3. Set job concurrency to 2 maximum

## Acceptance Criteria

- [ ] Pool size adjusted or parallelism controlled
- [ ] 5 concurrent deep scan jobs complete without connection errors
- [ ] Connection pool metrics monitored (add logging/metrics)
- [ ] Load test passes with sustained concurrent job execution

## Related Issues

- ID 061: N+1 Database Updates in Background Job
