---
status: pending
priority: p2
issue_id: '004'
tags: [code-review, security, typescript, pdf-extraction]
dependencies: []
---

# Validate PDF_EXTRACTION_ENGINE Environment Variable

## Problem Statement

In `lib/bids/pdf-extractor.ts`, the `PDF_EXTRACTION_ENGINE` env var is cast with `as PdfExtractionEngine | undefined` without runtime validation. A typo like `PDF_EXTRACTION_ENGINE=deterministc` would silently pass through and potentially cause unexpected behavior in the engine routing logic.

## Findings

- `lib/bids/pdf-extractor.ts`: `const envEngine = process.env.PDF_EXTRACTION_ENGINE as PdfExtractionEngine | undefined;`
- The `as` cast bypasses TypeScript's type checking at runtime
- Invalid values would not match either `'deterministic'` or `'ai'`, falling through to the default, but this masks configuration errors
- Flagged by: kieran-typescript-reviewer, security-sentinel

## Proposed Solutions

### Option 1: Runtime Validation with Warning (Recommended)

**Approach:** Validate the env var at runtime and log a warning for invalid values, falling back to `'deterministic'`.

```typescript
const validEngines = ['deterministic', 'ai'] as const;
const rawEngine = process.env.PDF_EXTRACTION_ENGINE;
const envEngine =
  rawEngine && validEngines.includes(rawEngine as any)
    ? (rawEngine as PdfExtractionEngine)
    : undefined;
if (rawEngine && !envEngine) {
  console.warn(`[PDF Extractor] Invalid PDF_EXTRACTION_ENGINE="${rawEngine}", using default`);
}
```

**Pros:** Catches typos early, logs useful warning
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

### Option 2: Throw on Invalid Value

**Approach:** Throw an error if env var is set to an invalid value.

**Pros:** Fail-fast, prevents misconfiguration
**Cons:** Could break startup if env is misconfigured
**Effort:** Small
**Risk:** Medium (could cause outage on deploy with typo)

## Recommended Action

Option 1 — validate with warning and fallback.

## Technical Details

- **Affected files:** `lib/bids/pdf-extractor.ts`
- **Components:** PDF extraction engine routing

## Acceptance Criteria

- [ ] Invalid `PDF_EXTRACTION_ENGINE` values log a warning
- [ ] Invalid values fall back to `'deterministic'`
- [ ] Valid values (`'deterministic'`, `'ai'`) work as before

## Work Log

| Date       | Action                   | Learnings                                                     |
| ---------- | ------------------------ | ------------------------------------------------------------- |
| 2026-02-14 | Created from code review | Unsafe `as` cast on env vars is a common pattern to watch for |

## Resources

- Review: pdf-deterministic-extractor implementation
