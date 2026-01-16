---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, security, rate-limiting, ddos]
dependencies: ["001"]
---

# Missing Rate Limiting on SSE Endpoints

## Problem Statement

SSE endpoints have no rate limiting, allowing a malicious user to open unlimited concurrent streams and exhaust server resources. Each stream spawns multiple AI agent calls (4 parallel agents in BIT evaluation), making this a high-cost DoS vector.

**Why it matters:**
- DoS attack vector (open 100 concurrent streams)
- Resource exhaustion (4 AI calls per stream × 100 streams = 400 concurrent AI requests)
- Cost explosion (AI API costs)
- Legitimate users blocked by resource contention
- Server crashes under load

## Findings

**Location:** `app/api/bids/[id]/evaluate/stream/route.ts`
**Location:** `app/api/bids/[id]/quick-scan/stream/route.ts`

**Evidence:**
```typescript
// No rate limiting present
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // User can call this unlimited times
  const stream = createAgentEventStream(async (emit) => {
    // Spawns 4 expensive AI agents
    const result = await runBitEvaluationWithStreaming(...);
  });
}
```

**Attack Scenario:**
```bash
# Malicious user opens 100 streams
for i in {1..100}; do
  curl -N "https://app.com/api/bids/123/evaluate/stream" &
done

# Result: 400 concurrent AI agent calls, server crash
```

**Source:** Security Sentinel review agent

**Dependency:** Requires #001 (authentication) to be fixed first, so we can rate-limit per user.

## Proposed Solutions

### Solution 1: Per-User Stream Limit with Redis (Recommended)

Track active streams per user in Redis, limit to 3 concurrent.

**Pros:**
- Effective DoS prevention
- Works across server instances (shared state)
- Fast lookups with Redis
- Industry standard pattern

**Cons:**
- Requires Redis dependency
- Need to handle stream cleanup on abort

**Effort:** Medium (3-4 hours)
**Risk:** Low

**Implementation:**
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.REDIS_URL });
const MAX_CONCURRENT_STREAMS = 3;
const STREAM_TTL = 300; // 5 minutes

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth(request);
  const userId = session.user.id;

  // Check active streams
  const activeStreams = await redis.get(`streams:${userId}`) || 0;
  if (activeStreams >= MAX_CONCURRENT_STREAMS) {
    return new Response('Too many active streams', { status: 429 });
  }

  // Increment counter
  await redis.incr(`streams:${userId}`);
  await redis.expire(`streams:${userId}`, STREAM_TTL);

  const stream = createAgentEventStream(async (emit) => {
    try {
      const result = await runBitEvaluationWithStreaming(...);
    } finally {
      // Decrement on completion
      await redis.decr(`streams:${userId}`);
    }
  });

  return createSSEResponse(stream);
}
```

### Solution 2: In-Memory Stream Tracking

Track streams in-memory Map (won't work across instances).

**Pros:**
- No Redis dependency
- Simple implementation
- Zero latency

**Cons:**
- Doesn't work with multiple server instances
- Lost on server restart
- Not production-ready for horizontal scaling

**Effort:** Small (2-3 hours)
**Risk:** Medium (doesn't scale)

**Not Recommended** for production.

### Solution 3: Per-Bid Mutex Lock

Allow only 1 evaluation per bid at a time.

**Pros:**
- Prevents duplicate evaluations
- Simple logic

**Cons:**
- Doesn't prevent user from evaluating 100 different bids
- Not a complete DoS solution
- Frustrates legitimate concurrent usage

**Effort:** Small (2 hours)
**Risk:** Low

**Should be combined** with Solution 1, not used alone.

## Recommended Action

*(To be filled during triage)*

## Technical Details

**Affected Files:**
- `app/api/bids/[id]/evaluate/stream/route.ts`
- `app/api/bids/[id]/quick-scan/stream/route.ts`
- `lib/rate-limiting/stream-limiter.ts` (new utility)

**Dependencies:**
- Upstash Redis or similar KV store
- Environment variable: `REDIS_URL`

**Configuration:**
```env
REDIS_URL=redis://...
MAX_CONCURRENT_STREAMS_PER_USER=3
STREAM_TTL_SECONDS=300
```

## Acceptance Criteria

- [ ] Users limited to 3 concurrent streams max
- [ ] 429 Too Many Requests returned when limit exceeded
- [ ] Stream counter decremented on completion
- [ ] Stream counter decremented on abort/error
- [ ] TTL ensures orphaned streams don't block forever
- [ ] Works across multiple server instances (if using Redis)
- [ ] Tests for rate limit scenarios
- [ ] Monitoring/logging for rate limit hits
- [ ] Documentation updated with limits

## Work Log

**2026-01-16**: Todo created from Security Sentinel review findings

## Resources

- Security Sentinel review report
- Upstash Redis: https://upstash.com/docs/redis
- Rate limiting patterns: https://blog.logrocket.com/rate-limiting-node-js/
- Similar implementation: (find in codebase if exists)
