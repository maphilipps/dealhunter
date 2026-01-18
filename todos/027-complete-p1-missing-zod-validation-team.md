---
status: pending
priority: p1
issue_id: "027"
tags: [code-review, security, validation, zod]
dependencies: []
---

# Missing Zod Validation in Team Actions

## Problem Statement

Server Actions in `lib/team/actions.ts` accept user input without Zod validation, unlike `lib/routing/actions.ts` which properly validates with Zod schemas. This could allow malformed data to reach the database.

**Impact:** Input validation gap. Could allow malformed team assignments.

## Findings

**From security-sentinel and nextjs-reviewer agents:**

**No validation (team/actions.ts:25):**
```typescript
export async function suggestTeamForBid(bidId: string): Promise<SuggestTeamResult> {
  // bidId used directly without validation
```

**No validation (team/actions.ts:95-98):**
```typescript
export async function assignTeam(
  bidId: string,
  teamAssignment: TeamAssignment,  // No runtime validation
  expectedVersion?: number
)
```

**Good example (routing/actions.ts:11-17):**
```typescript
const AssignBusinessUnitInputSchema = z.object({
  bidId: z.string().min(1, 'Bid ID ist erforderlich'),
  businessLineName: z.string().min(1, 'Business Unit ist erforderlich'),
  // ...
});
```

## Proposed Solutions

### Solution A: Add Zod schemas for team inputs (Recommended)
**Pros:** Consistent with routing/actions.ts, runtime validation
**Cons:** None
**Effort:** Small (30 min)
**Risk:** Low

```typescript
const SuggestTeamInputSchema = z.object({
  bidId: z.string().uuid('Invalid bid ID format'),
});

const AssignTeamInputSchema = z.object({
  bidId: z.string().uuid(),
  teamAssignment: TeamAssignmentSchema, // Import from ./schema
  expectedVersion: z.number().int().positive().optional(),
});
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/team/actions.ts` (functions: suggestTeamForBid, assignTeam, getTeamAssignment, getAvailableEmployees)

## Acceptance Criteria

- [ ] Add Zod schema for `suggestTeamForBid` input
- [ ] Add Zod schema for `assignTeam` input including TeamAssignment validation
- [ ] Use `safeParse()` pattern matching routing/actions.ts
- [ ] Return validation errors in German

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | All Server Action inputs need Zod validation |

## Resources

- Zod documentation: https://zod.dev/
