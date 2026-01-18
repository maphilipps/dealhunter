---
status: pending
priority: p3
issue_id: "035"
tags: [code-review, ux, error-handling]
dependencies: []
---

# Silent Email Failure Should Surface to UI

## Problem Statement

When email notification fails in `lib/routing/actions.ts`, the error is logged but silently ignored. Users have no indication that the BL leader was not notified.

**Impact:** Poor UX - user thinks notification was sent when it wasn't.

## Findings

**From nextjs-reviewer agent:**

**Silent failure (lines 178-182):**
```typescript
if (!emailResult.success) {
  console.error('Failed to send BL assignment email:', emailResult.error);
  // Don't fail the entire operation if email fails
  // The assignment was successful, just log the email error
}
```

## Proposed Solutions

### Solution A: Return warning in result (Recommended)
**Pros:** User knows notification failed, can retry
**Cons:** Requires UI change to display warnings
**Effort:** Medium (30 min)
**Risk:** Low

```typescript
interface AssignBusinessUnitResult {
  success: boolean;
  error?: string;
  warning?: string;  // NEW
}

// Return warning:
return {
  success: true,
  warning: emailResult.success ? undefined : 'Team assigned, but email notification failed',
};
```

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**
- `lib/routing/actions.ts` (lines 27-29 - update type, lines 178-186 - return warning)
- UI component that calls this action - display warning toast

## Acceptance Criteria

- [ ] Add `warning` field to `AssignBusinessUnitResult`
- [ ] Set warning when email fails but assignment succeeds
- [ ] UI displays warning toast to user

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created from code review | Never silently swallow errors from users |

## Resources

- None
