---
status: pending
priority: p2
issue_id: '006'
tags: [code-review, security, dos, pdf-extraction]
dependencies: []
---

# Add Page Count Limit for DoS Protection

## Problem Statement

`extractTextDeterministic()` processes all pages of a PDF without any upper limit. A maliciously crafted PDF with thousands of empty or near-empty pages could cause excessive CPU and memory usage, potentially leading to denial of service in the BullMQ worker processing queue.

## Findings

- `lib/bids/pdf-deterministic-extractor.ts:61`: `for (let pageNum = 1; pageNum <= totalPages; pageNum++)` — no upper bound
- The existing AI extractor has a similar issue but is rate-limited by API calls
- The deterministic extractor runs locally, so it can consume unbounded CPU
- Pre-qual PDFs are typically 5-50 pages; anything over 500 pages is likely malicious or erroneous
- Flagged by: security-sentinel

## Proposed Solutions

### Option 1: Configurable Page Limit with Sensible Default (Recommended)

**Approach:** Add a `MAX_PDF_PAGES` constant (default 500) and throw if exceeded.

```typescript
const MAX_PDF_PAGES = 500;
if (totalPages > MAX_PDF_PAGES) {
  throw new Error(`PDF hat ${totalPages} Seiten (Maximum: ${MAX_PDF_PAGES})`);
}
```

**Pros:** Simple, prevents DoS, clear error message
**Cons:** Could reject legitimate very large documents
**Effort:** Small
**Risk:** Low

### Option 2: Process First N Pages with Warning

**Approach:** Process only the first N pages and append a warning marker.

**Pros:** Doesn't reject large PDFs entirely
**Cons:** Incomplete extraction might cause downstream issues
**Effort:** Small
**Risk:** Medium

## Recommended Action

Option 1 — hard limit with clear error message.

## Technical Details

- **Affected files:** `lib/bids/pdf-deterministic-extractor.ts`
- **Components:** `extractTextDeterministic()` function

## Acceptance Criteria

- [ ] PDFs with more than MAX_PDF_PAGES pages throw a descriptive error
- [ ] Normal PDFs (< 500 pages) are unaffected
- [ ] Add a test for the page limit

## Work Log

| Date       | Action                   | Learnings                                            |
| ---------- | ------------------------ | ---------------------------------------------------- |
| 2026-02-14 | Created from code review | Always set resource limits for user-uploaded content |

## Resources

- Review: pdf-deterministic-extractor implementation
