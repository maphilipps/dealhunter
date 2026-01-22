---
status: pending
priority: p1
issue_id: DEA-138
tags: [code-review, bug, references-agent, typescript]
dependencies: []
---

# String Concatenation Bug in References Agent Fallback Message

## Problem Statement

In `lib/agents/references-agent.ts` lines 487-488, there's a string concatenation bug in the fallback message generation that produces malformed output when `industryScore < 60`.

**Current Code:**

```typescript
matchReason: `Good match based on ${ref.industryScore >= 60 ? 'industry similarity' : ''} ${ref.technologyScore >= 60 ? 'and technology overlap' : ''}.`.trim(),
```

**Bug Output:** When industryScore < 60 but technologyScore >= 60:
`"Good match based on  and technology overlap."` (note the double space and awkward "and")

## Findings

- **Source:** kieran-typescript-reviewer
- **File:** `lib/agents/references-agent.ts:487-488`
- **Severity:** P1 - Data corruption in user-facing content
- **Impact:** Malformed recommendation reasons displayed to users

## Proposed Solutions

### Solution 1: Conditional Array Join (Recommended)

Build an array of matching criteria and join with proper grammar.

```typescript
const reasons: string[] = [];
if (ref.industryScore >= 60) reasons.push('industry similarity');
if (ref.technologyScore >= 60) reasons.push('technology overlap');
matchReason: reasons.length > 0
  ? `Good match based on ${reasons.join(' and ')}.`
  : 'General match based on project requirements.',
```

**Pros:** Clean, grammatically correct, extensible
**Cons:** Slightly more verbose
**Effort:** Small (15 min)
**Risk:** Low

### Solution 2: Ternary Chain

Use nested ternaries for all combinations.

**Pros:** Single expression
**Cons:** Hard to read, not extensible
**Effort:** Small
**Risk:** Medium - easy to introduce new bugs

## Recommended Action

Solution 1 - Conditional Array Join

## Technical Details

**Affected Files:**

- `lib/agents/references-agent.ts`

**Test Cases:**

1. industryScore >= 60, technologyScore >= 60 → "industry similarity and technology overlap"
2. industryScore >= 60, technologyScore < 60 → "industry similarity"
3. industryScore < 60, technologyScore >= 60 → "technology overlap"
4. Both < 60 → fallback message

## Acceptance Criteria

- [ ] Fallback message grammatically correct in all score combinations
- [ ] No double spaces in output
- [ ] "and" only appears when both criteria match
- [ ] Unit test covers all 4 combinations

## Work Log

| Date       | Action                   | Learnings                                             |
| ---------- | ------------------------ | ----------------------------------------------------- |
| 2026-01-22 | Created from code review | String interpolation with conditionals is error-prone |

## Resources

- PR: DEA-138 subtasks
- Related: kieran-typescript-reviewer findings
