---
status: pending
priority: p2
issue_id: '032'
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Missing Exhaustiveness Checks in Switch Statements

## Problem Statement

Switch statements on union types in `lib/workflow/bl-review-status.ts` have `default` cases that silently allow unknown values. If a new phase is added, TypeScript won't catch the missing handler.

**Impact:** Silent bugs when extending workflow phases.

## Findings

**From kieran-typescript-reviewer agent:**

**Dangerous default case (lines 72-73):**

```typescript
default:
  return { allowed: true };  // Silently allows unknown phases!
```

**Same issue in getWorkflowProgress (lines 138-154):**
The switch has no exhaustiveness check. If a new `BLReviewPhase` is added, `completed` would remain `false` by default.

## Proposed Solutions

### Solution A: Use never type for exhaustiveness (Recommended)

**Pros:** Compile-time error if new phase is missed
**Cons:** None
**Effort:** Small (15 min)
**Risk:** None

```typescript
default: {
  const _exhaustiveCheck: never = nextPhase;
  return { allowed: false, reason: `Unknown phase: ${_exhaustiveCheck}` };
}
```

Or use a helper function:

```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**

- `lib/workflow/bl-review-status.ts` (lines 72-73, 138-154)

## Acceptance Criteria

- [ ] Add exhaustiveness check to `canTransitionTo` switch
- [ ] Add exhaustiveness check to `getWorkflowProgress` switch
- [ ] TypeScript error if new BLReviewPhase is added without handling

## Work Log

| Date       | Action                   | Learnings                                               |
| ---------- | ------------------------ | ------------------------------------------------------- |
| 2026-01-18 | Created from code review | Use `never` type for discriminated union exhaustiveness |

## Resources

- TypeScript exhaustiveness checking: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
