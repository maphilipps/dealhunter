---
status: pending
priority: p2
issue_id: '047'
tags: [code-review, performance, quickscan, rate-limiting]
dependencies: []
---

# Rate Limiting für externe API-Aufrufe im QuickScan

## Problem Statement

Der QuickScan macht parallele Aufrufe an externe APIs (Web Search, Company Intel) ohne Rate Limiting. Dies kann zu API-Throttling, Blockierung oder erhöhten Kosten führen.

## Findings

**Source:** performance-oracle Review Agent (Plan Review)

**Betroffene externe API-Aufrufe:**

1. `researchCompany(url)` - Web Search API
2. `researchDecisionMakers(url)` - Web Search API
3. `fetchSitemapWithFallback(url)` - HTTP Fetch
4. `fetchPagesParallel(urls)` - Multiple HTTP Fetches (10 parallel)

**Risiken:**

- Exa API hat Rate Limits (~100 req/min)
- Viele parallele QuickScans = API-Blockierung
- Keine Retry-Logik bei 429 Errors
- Keine Backoff-Strategie

## Proposed Solutions

### Option A: Bottleneck Library (Empfohlen)

**Pros:** Bewährte Lösung, Retry-Support, leichtgewichtig
**Cons:** Neue Dependency
**Effort:** Small (2-4h)
**Risk:** Low

```typescript
import Bottleneck from 'bottleneck';

const webSearchLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 500, // 2 requests/sec
});

const httpLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 100,
});

// Usage
const result = await webSearchLimiter.schedule(() => searchWeb(query));
```

### Option B: Custom Rate Limiter

**Pros:** Keine Dependency
**Cons:** Mehr Code, weniger Features
**Effort:** Medium
**Risk:** Medium

### Option C: API Gateway Level

**Pros:** Zentral, alle Services profitieren
**Cons:** Infrastruktur-Änderung
**Effort:** Large
**Risk:** Medium

## Recommended Action

Option A - Bottleneck für alle externen API-Aufrufe.

## Technical Details

**Affected Files:**

- `lib/quick-scan/agent.ts`
- `lib/search/web-search.ts`
- `lib/quick-scan/tools/decision-maker-research.ts`

**New Dependencies:**

- `bottleneck` (~15KB)

## Acceptance Criteria

- [ ] Web Search API max 2 concurrent, 500ms between calls
- [ ] HTTP Fetches max 5 concurrent, 100ms between calls
- [ ] Retry-Logik bei 429/503 Errors
- [ ] Exponential Backoff implementiert
- [ ] Rate Limit Status in Logs sichtbar

## Work Log

| Date       | Action                        | Learnings                     |
| ---------- | ----------------------------- | ----------------------------- |
| 2026-01-20 | Todo erstellt aus Plan Review | Missing rate limiting erkannt |

## Resources

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- Bottleneck: https://github.com/SGrondin/bottleneck
