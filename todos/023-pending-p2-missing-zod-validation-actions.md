---
status: pending
priority: p2
issue_id: '023'
tags: [code-review, security, validation, zod]
dependencies: []
---

# 023 - MEDIUM: Missing Zod Input Validation on Server Actions

## Problem Statement

Server action parameters (especially `bidId`) are not validated with Zod before being used in database queries. Per CLAUDE.md guidelines, Server Actions should have Zod validation.

## Findings

**Source:** security-sentinel agent, kieran-typescript-reviewer agent

**Affected Functions:**

- `triggerBaselineComparison(bidId: string)` - `lib/baseline-comparison/actions.ts`
- `getBaselineComparisonResult(bidId: string)` - `lib/baseline-comparison/actions.ts`
- `triggerProjectPlanning(bidId: string)` - `lib/project-planning/actions.ts`
- `getProjectPlan(bidId: string)` - `lib/project-planning/actions.ts`
- `updateProjectPhase(bidId, phaseIndex, updates)` - `lib/project-planning/actions.ts`
- `sendTeamNotifications(bidId: string)` - `lib/notifications/actions.ts`
- `getNotificationStatus(bidId: string)` - `lib/notifications/actions.ts`

**Risk:** Invalid input could cause unexpected behavior or be exploited.

## Proposed Solutions

### Solution 1: Add Zod validation to each action

```typescript
import { z } from 'zod';

const bidIdSchema = z.string().min(1);

export async function triggerBaselineComparison(bidId: string) {
  const parsed = bidIdSchema.safeParse(bidId);
  if (!parsed.success) {
    return { success: false, error: 'Ungültige Bid-ID' };
  }
  // ... rest of function
}
```

- **Effort:** Small
- **Risk:** Low
- **Pros:** Defense-in-depth, consistent with guidelines
- **Cons:** Slightly more code

## Recommended Action

**Solution 1** - Add Zod validation

## Technical Details

**Affected Files:**

- `lib/baseline-comparison/actions.ts`
- `lib/project-planning/actions.ts`
- `lib/notifications/actions.ts`

## Acceptance Criteria

- [ ] All server actions validate bidId with Zod
- [ ] Invalid inputs return proper error messages
- [ ] TypeScript build passes

## Work Log

| Date       | Action                           | Learning                             |
| ---------- | -------------------------------- | ------------------------------------ |
| 2026-01-18 | Discovered via security-sentinel | Input validation is defense-in-depth |
