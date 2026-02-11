---
status: pending
priority: p1
issue_id: '001'
tags: [code-review, quality, ci, typescript, lint]
dependencies: []
---

# Fix Lint Errors in PreQual Synthesis Changes

## Problem Statement

The reviewed change set introduces multiple ESLint errors in production files. If lint is enforced in CI, this blocks merge and deployment. Even where runtime behavior is currently unaffected, failing static checks reduce release confidence and hide higher-value regressions.

## Findings

- `app/(dashboard)/qualifications/[id]/summary/page.tsx:65` triggers `@typescript-eslint/no-floating-promises` (`params.then(...)` is not explicitly handled/ignored).
- `lib/qualifications/sections/award-criteria-section.ts:178` triggers `no-useless-escape` in regex construction.
- `lib/qualifications/sections/decision-grade-utils.ts:189` triggers `@typescript-eslint/no-unnecessary-type-assertion`.
- `lib/qualification/orchestrator-worker.ts:602`, `lib/qualification/orchestrator-worker.ts:699`, and `lib/qualification/orchestrator-worker.ts:713` trigger `@typescript-eslint/no-unnecessary-type-assertion`.
- `lib/qualifications/sections/risks-section.ts:61` triggers `@typescript-eslint/no-duplicate-type-constituents`.
- Repro command used during review:
  - `npx eslint 'lib/qualification/orchestrator-worker.ts' 'lib/json-render/prequal-section-agent.ts' 'lib/qualifications/sources.ts' 'lib/qualifications/sections/*.ts' 'app/api/qualifications/[id]/dashboard-summary/route.ts' 'app/(dashboard)/qualifications/[id]/summary/page.tsx'`

## Proposed Solutions

### Option 1: Minimal Lint-Fix Patch (Recommended)

**Approach:** Fix only error-level lint violations in touched files (no broad refactor).

**Pros:**

- Fastest path to green CI
- Lowest behavioral risk
- Keeps diff focused

**Cons:**

- Does not reduce broader warning noise
- Leaves technical debt for later

**Effort:** Small (1-2 hours)

**Risk:** Low

---

### Option 2: Targeted Cleanup in Reviewed Modules

**Approach:** Fix error-level issues plus high-signal warnings in `orchestrator-worker.ts`, `decision-grade-utils.ts`, and section runners.

**Pros:**

- Better long-term maintainability
- Cleaner follow-up reviews

**Cons:**

- Larger diff and review surface
- Higher chance of incidental regressions

**Effort:** Medium (3-5 hours)

**Risk:** Medium

## Recommended Action

Pending triage.

## Technical Details

**Affected files:**

- `/Users/marc.philipps/Sites/dealhunter/app/(dashboard)/qualifications/[id]/summary/page.tsx`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualifications/sections/award-criteria-section.ts`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualifications/sections/decision-grade-utils.ts`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualification/orchestrator-worker.ts`
- `/Users/marc.philipps/Sites/dealhunter/lib/qualifications/sections/risks-section.ts`

**Database changes:**

- No

## Resources

- Branch: `codex/fix-qualification-pages`
- Review command output: ESLint run listed above

## Acceptance Criteria

- [ ] `npx eslint ...` passes for reviewed files with zero errors
- [ ] No changes to runtime behavior from lint-only fixes
- [ ] Existing targeted tests still pass
- [ ] Typecheck remains green (`npx tsc --noEmit`)

## Work Log

### 2026-02-11 - Initial Review Capture

**By:** Codex

**Actions:**

- Executed targeted ESLint on reviewed PreQual files.
- Captured all error-level violations with file/line evidence.
- Grouped violations as merge-blocking quality issue.

**Learnings:**

- Most issues are straightforward lint conformance fixes.
- Resolving these first will unblock higher-signal review loops.

## Notes

- Treat this as merge-blocking if CI enforces lint errors.
