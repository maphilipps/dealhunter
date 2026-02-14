---
status: pending
priority: p3
issue_id: '008'
tags: [code-review, quality, cleanup, pdf-extraction]
dependencies: []
---

# Clean Up Dead Code, Cache Import, Remove Redundancies

## Problem Statement

Several minor code quality issues were identified across the PDF extraction files that don't affect correctness but reduce maintainability.

## Findings

1. **Cache dynamic import** (`pdf-deterministic-extractor.ts:45`): `await import('pdfjs-dist/legacy/build/pdf.mjs')` is called every invocation. While Node.js caches ES module imports, a module-level variable would make the intent explicit.

2. **Redundant sort** (`pdf-deterministic-extractor.ts:168`): `mergeLineItems()` sorts items by `x`, but items are already sorted by `x` in `groupItemsIntoLines()` (line 135). The sort in `mergeLineItems` is defensive but unnecessary.

3. **Dead code** (`pdf-extractor.ts`): `extractTextFromPdfPages()` is no longer called by any code path — it was the old multi-page AI extraction function. Can be removed.

4. **YAGNI type** (`pdf-extractor.ts`): `PdfLocatorStyle` type is exported but only used internally and only has one value. Could be simplified.

5. **Duplicate types** (`pdf-deterministic-extractor.ts`): `LineItem` and `TextLine` share 3 of 4 fields. Could use `extends` or intersection type.

6. **Redundant check** (`pdf-deterministic-extractor.ts:319`): `text.length > 120` is checked in `isHeadingLine`, but line 326 also checks `text.length <= 120` — the first check makes the second redundant.

## Proposed Solutions

### Option 1: Batch Cleanup (Recommended)

**Approach:** Fix all items in a single cleanup pass.

**Pros:** Single commit, clean diff
**Cons:** Slightly larger change
**Effort:** Small
**Risk:** Low

## Technical Details

- **Affected files:** `lib/bids/pdf-deterministic-extractor.ts`, `lib/bids/pdf-extractor.ts`

## Acceptance Criteria

- [ ] Dynamic import cached at module level
- [ ] Redundant sort removed from `mergeLineItems`
- [ ] Dead `extractTextFromPdfPages` function removed
- [ ] Duplicate type fields consolidated
- [ ] Redundant length check simplified
- [ ] All tests pass

## Work Log

| Date       | Action                   | Learnings                                     |
| ---------- | ------------------------ | --------------------------------------------- |
| 2026-02-14 | Created from code review | Batch minor cleanups to minimize commit noise |

## Resources

- Review: pdf-deterministic-extractor implementation
