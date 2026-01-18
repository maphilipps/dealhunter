---
status: pending
priority: p2
issue_id: "031"
tags: [code-review, typescript, dry]
dependencies: []
---

# Duplicate Type Definitions - Zod Schema AND Interface

## Problem Statement

`lib/routing/actions.ts` defines both a Zod schema AND a TypeScript interface for the same structure. This violates DRY and can lead to drift between the two definitions.

**Impact:** Maintenance burden, potential type drift.

## Findings

**From kieran-typescript-reviewer and code-simplicity-reviewer agents:**

**Duplicate definitions (lines 12-24):**
```typescript
// Zod schema (lines 12-17)
const AssignBusinessUnitInputSchema = z.object({
  bidId: z.string().min(1, 'Bid ID ist erforderlich'),
  businessLineName: z.string().min(1, 'Business Unit ist erforderlich'),
  overrideReason: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

// TypeScript interface (lines 19-24)
export interface AssignBusinessUnitInput {
  bidId: string;
  businessLineName: string;
  overrideReason?: string;
  expectedVersion?: number;
}
```

## Proposed Solutions

### Solution A: Use Zod inference (Recommended)
**Pros:** Single source of truth, DRY
**Cons:** None
**Effort:** Tiny (5 min)
**Risk:** None

```typescript
const AssignBusinessUnitInputSchema = z.object({
  bidId: z.string().min(1, 'Bid ID ist erforderlich'),
  businessLineName: z.string().min(1, 'Business Unit ist erforderlich'),
  overrideReason: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
});

// Derive type from schema
export type AssignBusinessUnitInput = z.infer<typeof AssignBusinessUnitInputSchema>;
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/routing/actions.ts` (lines 19-24 - remove interface)

## Acceptance Criteria

- [ ] Remove `AssignBusinessUnitInput` interface
- [ ] Replace with `z.infer<typeof AssignBusinessUnitInputSchema>`
- [ ] No type errors after change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | Use Zod inference, don't duplicate types |

## Resources

- Zod type inference: https://zod.dev/?id=type-inference
