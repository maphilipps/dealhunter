---
status: pending
priority: p2
issue_id: "053"
tags: [code-review, simplicity, dea-186, dry]
dependencies: ["052"]
---

# Duplicate Filtering Logic in Extraction Agent

## Problem Statement

The filtering logic for contacts and deliverables is nearly identical, repeated 5 times with slight variations. This violates DRY and makes the code harder to test and modify.

**Why it matters:**
- Same confidence + name check repeated 5 times
- Bug fixes must be applied to multiple places
- Increases cognitive load
- Makes unit testing difficult

## Findings

### Code Simplicity Reviewer Analysis

**Location:** `lib/extraction/agent.ts:567-612, 615-641`

**Duplicated Pattern:**
```typescript
// Contacts filter (lines 570-580)
.filter(contact => {
  const name = contact.name as string | undefined;
  const confidence = typeof contact.confidence === 'number' ? contact.confidence : 0;
  if (!name || name === '...' || name.toLowerCase() === 'unbekannt' || name.toLowerCase() === 'unknown') {
    return false;
  }
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return false;
  }
  return true;
})

// Deliverables filter (lines 596-606) - IDENTICAL LOGIC
.filter(d => {
  const name = d.name as string | undefined;
  const confidence = typeof d.confidence === 'number' ? d.confidence : 0;
  // Same conditions...
})
```

**Also duplicated for:** websiteUrls, budgetRange, cmsConstraints

## Proposed Solutions

### Option A: Extract Utility Function (Recommended)
**Pros:** DRY, testable, clear intent
**Cons:** Slight indirection
**Effort:** Small (30 minutes)
**Risk:** Low

```typescript
// lib/extraction/filters.ts
const PLACEHOLDER_NAMES = ['...', 'unbekannt', 'unknown', 'n/a', 'tbd'] as const;

function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_NAMES.includes(name.toLowerCase() as typeof PLACEHOLDER_NAMES[number]);
}

export function filterByConfidenceAndName<T extends { name?: string; confidence?: number }>(
  items: T[],
  minConfidence: number,
): T[] {
  return items.filter(item => {
    const { name, confidence = 0 } = item;
    if (!name || isPlaceholderName(name)) return false;
    return confidence >= minConfidence;
  });
}

// Usage
extractedData.contacts = filterByConfidenceAndName(extractedData.contacts, MIN_CONFIDENCE_THRESHOLD);
extractedData.requiredDeliverables = filterByConfidenceAndName(extractedData.requiredDeliverables, MIN_CONFIDENCE_THRESHOLD);
```

### Option B: Generic Higher-Order Function
**Pros:** Very flexible
**Cons:** More complex signature
**Effort:** Small (45 minutes)
**Risk:** Low

```typescript
function createConfidenceFilter<T>(
  getConfidence: (item: T) => number,
  isValid: (item: T) => boolean,
  minConfidence: number,
) {
  return (item: T) => isValid(item) && getConfidence(item) >= minConfidence;
}
```

### Option C: Combine Filter + Map
**Pros:** Single pass, more efficient
**Cons:** Slightly more complex
**Effort:** Medium (1 hour)
**Risk:** Low

Use `.reduce()` to combine filtering and mapping in one pass.

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected Files:**
- `lib/extraction/agent.ts:567-641`
- New file: `lib/extraction/filters.ts`

**Components:** Extraction Agent

**Database Changes:** None required

## Acceptance Criteria

- [ ] Extract common filtering logic to utility function
- [ ] Define placeholder names as constants
- [ ] Apply utility to contacts, deliverables, URLs
- [ ] Add unit tests for filter function

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Created from PR #11 review | Code simplicity reviewer + TypeScript reviewer flagged |

## Resources

- PR: https://github.com/maphilipps/dealhunter/pull/11
- Linear Issue: DEA-186
