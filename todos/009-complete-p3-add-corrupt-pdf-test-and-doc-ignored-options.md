---
status: pending
priority: p3
issue_id: '009'
tags: [code-review, testing, documentation, pdf-extraction]
dependencies: []
---

# Add Corrupt PDF Test and Document Ignored Options

## Problem Statement

Two minor gaps in test coverage and documentation were identified:

1. No test for corrupt/malformed PDF input (what happens when pdfjs-dist can't parse the buffer?)
2. When `engine: 'deterministic'` is used, several AI-specific options (`extractionMode`, `includeLocators`, etc.) are silently ignored without documentation

## Findings

1. **Missing corrupt PDF test**: The test suite covers empty PDFs and empty pages, but not a corrupt buffer (e.g., random bytes). `pdfjs-dist` will throw, and the error should propagate cleanly.

2. **Ignored options**: `prequal-processing-worker.ts` passes `{ extractionMode: 'thorough', includeLocators: true }` to `extractTextFromPdf()`. When the deterministic engine is used, these options are silently ignored. This is correct behavior but should be documented.

- Flagged by: code-simplicity-reviewer, architecture-strategist

## Proposed Solutions

### Option 1: Add Test + JSDoc Comment (Recommended)

**Approach:**

1. Add a test with `Buffer.from('not a pdf')` to verify clean error propagation
2. Add JSDoc note to `extractTextFromPdf` that AI-specific options are ignored in deterministic mode

**Pros:** Better coverage, clearer API contract
**Cons:** Minimal additional code
**Effort:** Small
**Risk:** Low

## Technical Details

- **Affected files:** `lib/bids/__tests__/pdf-deterministic-extractor.test.ts`, `lib/bids/pdf-extractor.ts`

## Acceptance Criteria

- [ ] Test exists for corrupt PDF buffer input
- [ ] Error from corrupt PDF is descriptive (not a generic crash)
- [ ] JSDoc on `extractTextFromPdf` documents which options apply to which engine
- [ ] All tests pass

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-02-14 | Created from code review | Test error paths, not just happy paths |

## Resources

- Review: pdf-deterministic-extractor implementation
