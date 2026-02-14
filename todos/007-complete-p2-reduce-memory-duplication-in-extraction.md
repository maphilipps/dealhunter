---
status: pending
priority: p2
issue_id: '007'
tags: [code-review, performance, memory, pdf-extraction]
dependencies: []
---

# Reduce Memory Duplication in PDF Extraction

## Problem Statement

The deterministic extractor has two memory inefficiencies:

1. `allPageItems` stores all page lines, then `flatMap` creates a second copy of all lines for body font detection — doubling memory for large PDFs
2. `new Uint8Array(buffer)` copies the entire buffer; Node.js Buffers are already Uint8Arrays

## Findings

- `lib/bids/pdf-deterministic-extractor.ts:47`: `const data = new Uint8Array(buffer)` — unnecessary copy, Buffer is already a Uint8Array subclass
- `lib/bids/pdf-deterministic-extractor.ts:86`: `const allLines = allPageItems.flatMap(p => p.lines)` — creates a full copy of all lines just for font detection
- For a 50-page PDF with ~5000 lines, this means ~10000 line objects in memory simultaneously
- Flagged by: performance-oracle

## Proposed Solutions

### Option 1: Stream-Based Font Detection + Zero-Copy Buffer (Recommended)

**Approach:**

1. Replace `new Uint8Array(buffer)` with direct buffer usage
2. Compute font stats incrementally while collecting page items, avoiding the `flatMap`

```typescript
// Zero-copy buffer
const pdf = await pdfjsLib.getDocument({
  data: buffer,
  // ...
}).promise;

// Incremental font detection
const sizeCharCounts = new Map<number, number>();
const nameCharCounts = new Map<string, number>();

for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
  // ... extract lines ...
  // Update font stats inline instead of collecting all lines first
  for (const line of lines) {
    // update sizeCharCounts, nameCharCounts
  }
  allPageItems.push({ pageNum, lines });
}

const bodyFontSize = findMaxKey(sizeCharCounts);
// ... etc
```

**Pros:** Halves memory usage for line data, eliminates buffer copy
**Cons:** Slightly more complex loop structure
**Effort:** Medium
**Risk:** Low

### Option 2: Keep Current Structure, Just Fix Buffer Copy

**Approach:** Only replace `new Uint8Array(buffer)` with direct buffer usage.

**Pros:** Minimal change
**Cons:** Doesn't address the flatMap duplication
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 for full optimization, or Option 2 as a quick win.

## Technical Details

- **Affected files:** `lib/bids/pdf-deterministic-extractor.ts`
- **Components:** `extractTextDeterministic()` function

## Acceptance Criteria

- [ ] `new Uint8Array(buffer)` replaced with direct buffer usage
- [ ] `flatMap` removed or replaced with incremental computation
- [ ] All existing tests pass
- [ ] Memory profile shows reduced allocation for large PDFs

## Work Log

| Date       | Action                   | Learnings                                                   |
| ---------- | ------------------------ | ----------------------------------------------------------- |
| 2026-02-14 | Created from code review | Node.js Buffer extends Uint8Array; avoid unnecessary copies |

## Resources

- Review: pdf-deterministic-extractor implementation
