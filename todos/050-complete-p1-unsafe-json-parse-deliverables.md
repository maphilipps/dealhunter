---
status: complete
priority: p1
issue_id: '050'
tags: [code-review, typescript, dea-186, type-safety]
dependencies: []
---

# Unsafe JSON.parse Without Validation in Deliverables Page

## Problem Statement

The deliverables page parses `extractedRequirements` from the database using `JSON.parse` with a direct type assertion, bypassing Zod validation. This could cause runtime errors if the data is malformed or corrupted.

**Why it matters:**

- Database could contain malformed JSON from bugs or migrations
- No runtime validation that the shape matches `ExtractedRequirements`
- Could cause unhandled exceptions and white screens
- Violates "trust but verify" principle

## Findings

### TypeScript Reviewer Analysis

**Location:** `app/(dashboard)/rfps/[id]/deliverables/page.tsx:40-42`

**Vulnerable Code:**

```typescript
const extractedReqs: ExtractedRequirements | null = preQualification.extractedRequirements
  ? (JSON.parse(preQualification.extractedRequirements) as ExtractedRequirements)
  : null;
```

**Issue:** Type assertion `as ExtractedRequirements` bypasses TypeScript's type checking at runtime.

### Pattern Recognition

Same anti-pattern exists in multiple pages:

- `app/(dashboard)/rfps/[id]/page.tsx`
- `app/(dashboard)/rfps/[id]/contacts/page.tsx`
- `app/(dashboard)/rfps/[id]/timeline/page.tsx`

## Proposed Solutions

### Option A: Zod safeParse (Recommended)

**Pros:** Runtime validation, graceful error handling
**Cons:** Slight performance overhead
**Effort:** Small (30 minutes)
**Risk:** Low

```typescript
import { extractedRequirementsSchema } from '@/lib/extraction/schema';

const parseResult = preQualification.extractedRequirements
  ? extractedRequirementsSchema.safeParse(JSON.parse(preQualification.extractedRequirements))
  : null;

if (parseResult && !parseResult.success) {
  console.error('Invalid extracted requirements:', parseResult.error);
  // Handle gracefully - show empty state or error alert
}
const extractedReqs = parseResult?.data ?? null;
```

### Option B: Try-Catch Wrapper

**Pros:** Simple, catches parse errors
**Cons:** Less strict validation
**Effort:** Small (15 minutes)
**Risk:** Medium

```typescript
let extractedReqs: ExtractedRequirements | null = null;
try {
  extractedReqs = preQualification.extractedRequirements ? JSON.parse(preQualification.extractedRequirements) : null;
} catch (e) {
  console.error('Failed to parse extractedRequirements:', e);
}
```

### Option C: Create Utility Function

**Pros:** DRY, consistent across codebase
**Cons:** Requires refactoring multiple files
**Effort:** Medium (2 hours)
**Risk:** Low

```typescript
// lib/utils/parse-extracted-requirements.ts
export function parseExtractedRequirements(json: string | null): ExtractedRequirements | null {
  if (!json) return null;
  const result = extractedRequirementsSchema.safeParse(JSON.parse(json));
  return result.success ? result.data : null;
}
```

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected Files:**

- `app/(dashboard)/rfps/[id]/deliverables/page.tsx:40-42`
- Similar pattern in other RFP detail pages

**Components:** Server Components, Data Parsing

**Database Changes:** None required

## Acceptance Criteria

- [ ] Replace direct type assertion with Zod safeParse
- [ ] Handle parse errors gracefully with user-friendly message
- [ ] Apply fix to all similar patterns in RFP pages
- [ ] Add unit test for malformed JSON handling

## Work Log

| Date       | Action                     | Learnings                                      |
| ---------- | -------------------------- | ---------------------------------------------- |
| 2026-01-22 | Created from PR #11 review | TypeScript reviewer + Next.js reviewer flagged |

## Resources

- PR: https://github.com/maphilipps/dealhunter/pull/11
- Linear Issue: DEA-186
- Zod safeParse docs: https://zod.dev/?id=safeparse
