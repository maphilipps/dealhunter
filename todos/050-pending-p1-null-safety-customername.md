---
status: pending
priority: p1
issue_id: DEA-138
tags: [code-review, typescript, null-safety, references-agent]
dependencies: []
---

# Null Safety Violation on customerName in References Agent

## Problem Statement

In `lib/agents/references-agent.ts`, `lead.customerName` can be null but is used without null checking in string interpolation, potentially causing "null" to appear in user-facing text.

## Findings

- **Source:** kieran-typescript-reviewer
- **File:** `lib/agents/references-agent.ts`
- **Severity:** P1 - User-facing data quality issue
- **Impact:** "null" text appearing in AI prompts and user-facing content

The DB schema allows `customerName` to be null:

```typescript
customerName: text('customer_name'), // No .notNull()
```

## Proposed Solutions

### Solution 1: Null Coalescing (Recommended)

Use nullish coalescing operator with sensible default.

```typescript
const customerName = lead.customerName ?? 'Unknown Customer';
```

**Pros:** Simple, clear intent
**Cons:** None
**Effort:** Small (5 min)
**Risk:** Low

### Solution 2: Early Return

Return early if required data is missing.

**Pros:** Explicit failure handling
**Cons:** May prevent valid analysis
**Effort:** Small
**Risk:** Medium - might reject valid inputs

## Recommended Action

Solution 1 - Use null coalescing with 'Unknown Customer' fallback

## Technical Details

**Affected Files:**

- `lib/agents/references-agent.ts`
- Potentially other agents using `lead.customerName`

**Search Pattern:**

```bash
grep -r "lead.customerName" lib/agents/
```

## Acceptance Criteria

- [ ] No "null" text in any user-facing output
- [ ] Sensible fallback value used
- [ ] TypeScript strict null checks pass
- [ ] Check all agents for same pattern

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2026-01-22 | Created from code review | Always check nullable DB fields |

## Resources

- PR: DEA-138 subtasks
