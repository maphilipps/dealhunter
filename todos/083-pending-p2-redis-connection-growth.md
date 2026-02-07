---
status: pending
priority: p2
issue_id: '083'
tags: [code-review, performance, redis, streaming]
dependencies: []
---

# Redis Connection Growth — New Subscriber Per SSE Client

## Problem Statement

The processing-stream SSE endpoint creates a new Redis subscriber connection per client request. With 20+ concurrent users watching processing, that's 20+ Redis connections just for streaming. No connection pooling or limit exists.

## Findings

- **Source:** Architecture Strategist, Performance Oracle
- **Location:** `app/api/qualifications/[id]/processing-stream/route.ts:119`

## Proposed Solutions

### Option A: Connection pool for Redis subscribers

Implement a shared subscriber pool with max connection limit.

- **Effort:** Medium (1h) | **Risk:** Low

## Acceptance Criteria

- [ ] Redis subscriber connections are pooled or limited per qualification
- [ ] Connection cleanup on disconnect is verified
