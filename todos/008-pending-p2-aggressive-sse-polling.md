---
status: pending
priority: p2
issue_id: PERF-002
tags: [code-review, performance, sse, polling, database]
dependencies: []
---

# IMPORTANT: Aggressive SSE Polling Pattern (27 min × 1 query/sec = 1,620 queries)

## Problem Statement

The Epic 7 plan describes SSE progress tracking with client-side polling for analysis status. For a 27-minute background job, this results in 1,620 database queries (1 query/second × 27 minutes × 60 seconds), causing unnecessary database load and API traffic.

**Impact**: Excessive database queries, wasted API resources, higher hosting costs
**Scale**: 10 concurrent analyses = 16,200 queries (vs 10 with push-based SSE)

## Findings

**Performance Oracle Report:**
- Plan describes SSE endpoint that polls database for status updates
- Long-running background job (10-30 minutes per analysis)
- Client polls every 1 second for updates
- Database query rate: 1 query/second per active analysis
- Better pattern: Inngest emits events → SSE pushes to client (0 polling)

**Current Epic 5a Pattern (Good):**
```typescript
// app/api/bids/[id]/evaluate/stream/route.ts
const stream = createAgentEventStream(async (emit) => {
  emit({ type: AgentEventType.START });

  const result = await runBitEvaluationWithStreaming(input, emit);
  // ✅ Agents PUSH events via emit callback
  // ✅ No database polling needed

  emit({ type: AgentEventType.COMPLETE, data: result });
});
```

**Planned Epic 7 Pattern (Bad):**
```typescript
// ANTI-PATTERN from plan:
const stream = new ReadableStream({
  async start(controller) {
    // ❌ Poll database every 1 second
    const interval = setInterval(async () => {
      const [analysis] = await db.select()
        .from(deepMigrationAnalyses)
        .where(eq(deepMigrationAnalyses.id, analysisId));

      controller.enqueue(`data: ${JSON.stringify(analysis)}\n\n`);

      if (analysis.status === 'completed') clearInterval(interval);
    }, 1000); // ❌ 1 query/second × 1,620 seconds = 1,620 queries
  }
});
```

## Proposed Solutions

### Solution 1: Inngest Event Emitter → SSE Push (Recommended)
**Pros:**
- Zero database polling
- Real-time updates (sub-second latency)
- Follows Epic 5a pattern
- Scalable to 1000s of concurrent jobs

**Cons:**
- Requires Inngest event emission infrastructure
- More complex initial setup

**Effort**: Medium (3-4 hours)
**Risk**: Low (proven pattern in Epic 5a)

**Implementation:**
```typescript
// lib/inngest/functions/deep-analysis.ts
import { EventEmitter } from '@/lib/streaming/event-emitter';

export const deepAnalysisFunction = inngest.createFunction(
  { id: 'deep-analysis-run', name: 'Deep Migration Analysis', retries: 2 },
  { event: 'deep-analysis.run' },
  async ({ event, step }) => {
    const { bidId, emit } = event.data; // ✅ Receive emit callback from SSE route

    emit({ type: 'PROGRESS', data: { message: 'Starting content analysis...' } });

    const contentArch = await step.run('content-analysis', async () => {
      // ... content analysis logic
      emit({ type: 'PROGRESS', data: { message: 'Content analysis complete' } });
      return result;
    });

    emit({ type: 'PROGRESS', data: { message: 'Starting migration complexity...' } });
    const migrationComplexity = await step.run('migration-complexity', async () => {
      // ... migration complexity logic
      emit({ type: 'PROGRESS', data: { message: 'Migration complexity complete' } });
      return result;
    });

    // ... more steps with emit callbacks

    emit({ type: 'COMPLETE', data: { analysisId } });
    return { success: true };
  }
);

// app/api/bids/[id]/deep-analysis/stream/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const stream = createAgentEventStream(async (emit) => {
    emit({ type: AgentEventType.START });

    // Trigger Inngest with emit callback
    await inngest.send({
      name: 'deep-analysis.run',
      data: {
        bidId: params.id,
        userId: session.user.id,
        emit, // ✅ Pass emit callback to Inngest function
      },
    });
  });

  return createSSEResponse(stream); // ✅ 0 database polling
}
```

### Solution 2: Inngest Webhook → SSE Broadcast
**Pros:**
- Decoupled from Inngest execution
- Standard webhook pattern

**Cons:**
- Requires webhook infrastructure
- More complex state management
- Still needs some polling or pub/sub

**Effort**: Large (6-8 hours)
**Risk**: Medium (more moving parts)

### Solution 3: Long Polling with Exponential Backoff
**Pros:**
- Simpler than push-based approach
- Reduces query rate (1/sec → 1/5sec → 1/10sec)

**Cons:**
- Still polling (just less aggressive)
- Not as real-time as push
- More complex client logic

**Effort**: Small (1-2 hours)
**Risk**: Low

**Implementation:**
```typescript
// Polling interval increases over time:
// First 1 min: 1 query/sec (60 queries)
// Min 1-5: 1 query/5sec (48 queries)
// Min 5+: 1 query/10sec (132 queries for remaining 22 min)
// Total: 240 queries (vs 1,620) ✅ 85% reduction
```

## Recommended Action

**Use Solution 1: Inngest Event Emitter → SSE Push**

This follows the proven Epic 5a pattern and eliminates database polling entirely. It's the most scalable and performant approach.

## Technical Details

**Affected Files:**
- `lib/inngest/functions/deep-analysis.ts` - Add emit callback parameter
- `app/api/bids/[id]/deep-analysis/stream/route.ts` - NEW SSE route
- `lib/streaming/event-emitter.ts` - Reuse existing infrastructure

**Database Changes:** None (eliminates queries instead)

**Breaking Changes:** None (new feature)

**Query Reduction:**
| Pattern | Queries per Analysis | Queries for 10 Concurrent |
|---------|---------------------|---------------------------|
| Current Plan (1/sec polling) | 1,620 | 16,200 |
| Solution 1 (Push) | 0 | 0 ✅ |
| Solution 3 (Exponential backoff) | 240 | 2,400 |

## Acceptance Criteria

- [ ] SSE route implemented following Epic 5a pattern
- [ ] Inngest function emits progress events
- [ ] Client receives real-time updates (< 1 second latency)
- [ ] Zero database polling queries
- [ ] Performance test: 10 concurrent analyses generate 0 polling queries
- [ ] Fallback handling if SSE connection drops
- [ ] Documentation updated with SSE architecture

## Work Log

**2026-01-17**: Issue identified by performance-oracle agent during Epic 7 Phase 1 review

## Resources

- [Epic 5a SSE Implementation](app/api/bids/[id]/evaluate/stream/route.ts)
- [Event Emitter Infrastructure](lib/streaming/event-emitter.ts)
- [Inngest Step Functions](https://www.inngest.com/docs/functions/multi-step)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
