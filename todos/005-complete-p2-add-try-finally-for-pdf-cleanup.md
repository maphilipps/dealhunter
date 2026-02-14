---
status: pending
priority: p2
issue_id: '005'
tags: [code-review, reliability, memory, pdf-extraction]
dependencies: []
---

# Add try/finally for PDF Cleanup in Deterministic Extractor

## Problem Statement

In `lib/bids/pdf-deterministic-extractor.ts`, `pdf.cleanup()` and `pdf.destroy()` are called after all page processing, but if an error is thrown during extraction (e.g., in `buildParagraphs` or `formatPageWithMarkers`), the PDF document handle is never released. This can cause memory leaks under repeated failures.

## Findings

- `lib/bids/pdf-deterministic-extractor.ts:97-98`: `pdf.cleanup()` and `pdf.destroy()` are not wrapped in try/finally
- If any error occurs between `getDocument()` (line 48) and cleanup (line 97), the PDF handle leaks
- The per-page cleanup (`page.cleanup()` in line 81) is already correctly wrapped in try/finally
- Flagged by: performance-oracle, architecture-strategist

## Proposed Solutions

### Option 1: Wrap Main Logic in try/finally (Recommended)

**Approach:** Wrap the entire extraction logic after `getDocument()` in a try/finally block.

```typescript
const pdf = await pdfjsLib.getDocument({ ... }).promise;
try {
  // ... all extraction logic ...
  return `[[PASS text]]\n${body}`;
} finally {
  pdf.cleanup();
  pdf.destroy();
}
```

**Pros:** Guarantees cleanup on any error path
**Cons:** None
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 — straightforward try/finally wrap.

## Technical Details

- **Affected files:** `lib/bids/pdf-deterministic-extractor.ts`
- **Components:** `extractTextDeterministic()` function

## Acceptance Criteria

- [ ] `pdf.cleanup()` and `pdf.destroy()` are called even when extraction throws
- [ ] Existing tests still pass
- [ ] Error is re-thrown after cleanup

## Work Log

| Date       | Action                   | Learnings                                   |
| ---------- | ------------------------ | ------------------------------------------- |
| 2026-02-14 | Created from code review | Always wrap resource handles in try/finally |

## Resources

- Review: pdf-deterministic-extractor implementation
