---
status: pending
priority: p2
issue_id: '081'
tags: [code-review, ai-sdk, consistency]
dependencies: []
---

# Manual JSON Parsing in runSimpleFallbackExtraction

## Problem Statement

`runSimpleFallbackExtraction` in the prequal-processing-worker uses `text.indexOf('{')` / `text.lastIndexOf('}')` manual JSON parsing, which is the exact fragile pattern removed from `extractHeaderFields` and `inferSubmissionDeadline`. Should use `Output.object({ schema })`.

## Findings

- **Source:** TypeScript Reviewer, Agent-Native Reviewer, Pattern Recognition, Architecture Strategist
- **Location:** `lib/bullmq/workers/prequal-processing-worker.ts:191-198`

## Proposed Solutions

### Option A: Use Output.object with Zod schema (Recommended)

Match the pattern used in `inferSubmissionDeadline` and `extractHeaderFields`.

- **Effort:** Small (15 min) | **Risk:** Low

## Acceptance Criteria

- [ ] `runSimpleFallbackExtraction` uses `Output.object({ schema })` instead of manual JSON parsing
- [ ] Schema validates all expected fields
