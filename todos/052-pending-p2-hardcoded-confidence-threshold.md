---
status: pending
priority: p2
issue_id: '052'
tags: [code-review, architecture, dea-186, configuration]
dependencies: []
---

# Hardcoded Confidence Threshold Configuration

## Problem Statement

The `MIN_CONFIDENCE_THRESHOLD = 30` constant is hardcoded in `agent.ts`, and the same threshold value appears in multiple files without a central definition. This creates configuration drift and maintenance issues.

**Why it matters:**

- Same threshold (30) hardcoded in multiple places
- Changing threshold requires finding/updating multiple files
- Violates DRY principle
- No way to adjust threshold without code changes

## Findings

### Architecture Strategist Analysis

**Location:** `lib/extraction/agent.ts:89`

**Hardcoded Value:**

```typescript
const MIN_CONFIDENCE_THRESHOLD = 30;
```

**Also found in:**

- `lib/quick-scan/tools/multi-page-analyzer.ts:575, 580, 585, 590`

### Inconsistency with Codebase Pattern

The codebase already has configuration patterns in:

- `/lib/ai/config.ts` with `defaultSettings` and `modelNames`

The threshold should follow this established pattern.

## Proposed Solutions

### Option A: Centralize in Extraction Config (Recommended)

**Pros:** Follows existing patterns, easy to find
**Cons:** Requires import in multiple files
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// lib/extraction/config.ts
export const extractionConfig = {
  minConfidenceThreshold: 30,
  languageDetectionSampleSize: 1500,
  maxRagChunks: 5,
} as const;

// Usage in agent.ts
import { extractionConfig } from './config';
// ...
if (confidence < extractionConfig.minConfidenceThreshold) {
```

### Option B: Environment Variable

**Pros:** Runtime configurable, no code changes needed
**Cons:** More complex, needs validation
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
const MIN_CONFIDENCE_THRESHOLD = parseInt(process.env.EXTRACTION_MIN_CONFIDENCE ?? '30', 10);
```

### Option C: Add to Schema

**Pros:** Domain model includes configuration
**Cons:** Schema bloat
**Effort:** Medium (2 hours)
**Risk:** Low

```typescript
// In schema.ts
export const extractionConfigSchema = z.object({
  minConfidenceThreshold: z.number().min(0).max(100).default(30),
});
```

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected Files:**

- `lib/extraction/agent.ts:89`
- `lib/quick-scan/tools/multi-page-analyzer.ts:575, 580, 585, 590`
- New file: `lib/extraction/config.ts`

**Components:** Extraction Agent, Quick Scan

**Database Changes:** None required

## Acceptance Criteria

- [ ] Create centralized extraction config file
- [ ] Update all hardcoded threshold references
- [ ] Add JSDoc explaining threshold meaning
- [ ] Consider adding to env vars for production tuning

## Work Log

| Date       | Action                     | Learnings                                    |
| ---------- | -------------------------- | -------------------------------------------- |
| 2026-01-22 | Created from PR #11 review | Architecture strategist flagged config drift |

## Resources

- PR: https://github.com/maphilipps/dealhunter/pull/11
- Linear Issue: DEA-186
