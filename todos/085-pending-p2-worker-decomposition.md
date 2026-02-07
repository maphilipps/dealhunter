---
status: pending
priority: p2
issue_id: '085'
tags: [code-review, architecture, maintainability]
dependencies: []
---

# PreQual Processing Worker Needs Decomposition

## Problem Statement

`prequal-processing-worker.ts` has grown to 600+ lines with 6+ responsibilities: PDF extraction, requirement extraction, finding publishing, streaming events, CMS matrix, section orchestration. The ~170-line finding-publisher block (lines 771-938) maps extraction results to publish calls and should be extracted. The ~30 `void publishX(...).catch(...)` calls should use a shared helper.

## Findings

- **Source:** TypeScript Reviewer, Architecture Strategist, Code Simplifier
- **Location:** `lib/bullmq/workers/prequal-processing-worker.ts`

## Proposed Solutions

### Option A: Extract finding publisher + publish helper (Recommended)

Extract `publishExtractedFindings()` to `lib/streaming/finding-extractor.ts`, create `fireAndForget()` wrapper.

- **Effort:** Medium (45 min) | **Risk:** Low

## Acceptance Criteria

- [ ] Finding-publisher block extracted to separate module
- [ ] Fire-and-forget publish pattern uses shared helper
- [ ] Worker file < 500 lines
