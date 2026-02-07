---
status: pending
priority: p1
issue_id: '077'
tags: [code-review, silent-failure, rag, observability]
dependencies: []
---

# Embedding Failure Silently Degrades RAG Quality

## Problem Statement

In `lib/extraction/agent-native.ts` line 268, embedding failure was downgraded from a thrown error to `console.warn`. The extraction agent runs without RAG data, producing results based purely on truncated prompt text. The agent has no way to know its `prequal.query` tool will return degraded/empty results. Users receive extraction results that appear complete but lack semantic document search.

Additionally, in `lib/ai/embedding-config.ts` lines 112-118, embedding dimension mismatches use `console.warn` and return `null`. This is a persistent config error that goes unnoticed — every embedding call hits this path repeatedly.

## Findings

- **Source:** Silent Failure Hunter, Agent-Native Reviewer agents
- **Location:** `lib/extraction/agent-native.ts:268`, `lib/ai/embedding-config.ts:112-118`
- **Severity:** CRITICAL — silent quality degradation with no user feedback
- **Impact:** Users get incomplete extraction results without knowing quality was degraded

## Proposed Solutions

### Option A: Upgrade to Sentry + Quality Flag (Recommended)

- **Pros:** Tracks degradation in production, surfaces in UI
- **Cons:** Requires UI change for quality indicator
- **Effort:** Medium (30 min)
- **Risk:** Low

### Option B: Restore Error for Config Issues, Warn for Transient

- **Pros:** Distinguishes config errors from transient failures
- **Cons:** Config errors crash the pipeline
- **Effort:** Small (15 min)
- **Risk:** Low

## Technical Details

- **Affected files:** `lib/extraction/agent-native.ts`, `lib/ai/embedding-config.ts`
- **Current behavior:** `console.warn` on failure, continues without RAG
- **Desired behavior:** `logError` for Sentry, quality flag in results

## Acceptance Criteria

- [ ] Embedding failures tracked in Sentry (not just console.warn)
- [ ] Dimension mismatch errors clearly indicate admin misconfiguration
- [ ] Extraction results indicate when RAG was unavailable
- [ ] All 4 embedding consumers handle dimension mismatches consistently

## Work Log

- 2026-02-07: Created from code review (silent-failure-hunter, agent-native-reviewer agents)
