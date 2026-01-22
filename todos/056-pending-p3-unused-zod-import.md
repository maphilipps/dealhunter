---
status: pending
priority: p3
issue_id: DEA-138
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Unused Zod Import in CMS Selection Service

## Problem Statement

In `lib/leads/cms-selection-service.ts`, Zod is imported but not used (dead code).

## Findings

- **Source:** kieran-typescript-reviewer
- **File:** `lib/leads/cms-selection-service.ts`
- **Severity:** P3 - Code cleanup
- **Impact:** Minor - dead import

## Proposed Solutions

### Solution 1: Remove Import (Recommended)

Simply remove the unused import.

**Effort:** Trivial (1 min)
**Risk:** None

### Solution 2: Use Zod for Input Validation

Add proper Zod schemas for function inputs.

**Effort:** Small
**Risk:** Low
**Note:** This overlaps with #053

## Recommended Action

Either remove the import OR use it for input validation (#053)

## Technical Details

**Affected Files:**

- `lib/leads/cms-selection-service.ts`

## Acceptance Criteria

- [ ] No unused imports
- [ ] ESLint no-unused-vars passes

## Work Log

| Date       | Action                   | Learnings          |
| ---------- | ------------------------ | ------------------ |
| 2026-01-22 | Created from code review | Keep imports clean |

## Resources

- PR: DEA-138 subtasks
