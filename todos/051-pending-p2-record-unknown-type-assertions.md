---
status: pending
priority: p2
issue_id: "051"
tags: [code-review, typescript, dea-186, type-safety]
dependencies: []
---

# Excessive Record<string, unknown> Type Assertions

## Problem Statement

The extraction agent uses `Record<string, unknown>` type assertions extensively, followed by additional property casts. This pattern bypasses TypeScript's type system and is error-prone.

**Why it matters:**
- Multiple layers of type assertions indicate poorly defined types
- Every property access requires another cast
- Maintenance burden and potential runtime errors
- Loses TypeScript's compile-time safety benefits

## Findings

### TypeScript Reviewer Analysis

**Location:** `lib/extraction/agent.ts:568, 592-593, 616`

**Problematic Pattern:**
```typescript
extractedData.contacts = (extractedData.contacts as Record<string, unknown>[])
  .filter(contact => {
    const name = contact.name as string | undefined;
    const confidence = typeof contact.confidence === 'number' ? contact.confidence : 0;
    // ...
  })
```

**Issues:**
1. `Record<string, unknown>[]` cast is too loose
2. `contact.name as string | undefined` is another unsafe cast
3. Confidence type check at runtime instead of compile time

## Proposed Solutions

### Option A: Define Intermediate Types (Recommended)
**Pros:** Type-safe, better DX, IDE support
**Cons:** More code upfront
**Effort:** Medium (2-3 hours)
**Risk:** Low

```typescript
// lib/extraction/types.ts
interface ParsedContact {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  category?: string;
  confidence?: number;
}

interface ParsedDeliverable {
  name?: string;
  description?: string;
  deadline?: string;
  deadlineTime?: string;
  format?: string;
  copies?: number;
  mandatory?: boolean;
  confidence?: number;
}

// Then use proper type guards
function isValidContact(contact: unknown): contact is ParsedContact {
  return typeof contact === 'object' && contact !== null;
}
```

### Option B: Use Zod for Runtime Parsing
**Pros:** Single source of truth, runtime validation
**Cons:** Performance overhead
**Effort:** Medium (2-3 hours)
**Risk:** Low

```typescript
const parsedContactSchema = z.object({
  name: z.string().optional(),
  confidence: z.number().optional(),
  // ...
});

const contacts = extractedData.contacts
  .map(c => parsedContactSchema.safeParse(c))
  .filter(r => r.success)
  .map(r => r.data);
```

### Option C: Infer Types from Schema
**Pros:** DRY, uses existing schema
**Cons:** Complex type manipulation
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
import { extractedRequirementsSchema } from './schema';
type Contact = NonNullable<z.infer<typeof extractedRequirementsSchema>['contacts']>[number];
```

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected Files:**
- `lib/extraction/agent.ts:568-612` - Contact/Deliverable filtering
- `lib/extraction/agent.ts:615-641` - URL/Budget/CMS filtering

**Components:** Extraction Agent

**Database Changes:** None required

## Acceptance Criteria

- [ ] Define intermediate types for parsed data
- [ ] Remove `Record<string, unknown>` casts
- [ ] Add type guards for runtime validation
- [ ] Ensure TypeScript strict mode passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Created from PR #11 review | TypeScript reviewer flagged type safety issues |

## Resources

- PR: https://github.com/maphilipps/dealhunter/pull/11
- Linear Issue: DEA-186
