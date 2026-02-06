---
name: ship
description: Analyze plan + codebase, spawn expert team, build, review, test, ship
argument-hint: '[feature description or brainstorm/plan file path]'
---

# Ship — Adaptive Expert Team

Analyze the plan and codebase, assemble the right expert team, then execute the full lifecycle: build, review, test, fix, ship.

**You are the lead. You coordinate — you do NOT write code yourself. Use delegate mode.**

## Phase 1: Understand the Mission (Lead does this)

### Step 1: Ingest the Plan

Read `$ARGUMENTS`:

- If it's a file path (e.g. `docs/brainstorms/*.md` or `docs/plans/*.md`), read the file
- Otherwise treat the argument as a feature description

Summarize: What are we building? What's the scope?

### Step 2: Analyze the Codebase

Research the codebase to understand what the plan touches:

1. **Identify affected domains**: Which parts of the codebase are involved? (e.g. API routes, components, lib modules, DB schema, agent tools, tests)
2. **Map file areas**: Group affected files by domain/expertise area
3. **Detect patterns**: What existing patterns must be followed? (Check CLAUDE.md conventions)
4. **Find risks**: Are there shared files that multiple changes would touch? Dependencies between changes?

### Step 3: Design the Team

Based on the plan and codebase analysis, decide which **expert roles** are needed. Don't use a fixed team — compose the right specialists.

**Pick from these role archetypes** (use only what's needed, typically 3-6 teammates):

| Archetype        | When to use                                        | Spawn prompt focus                                                            |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `backend`        | API routes, server actions, DB schema, lib modules | Relevant lib/ and app/api/ files, Drizzle patterns, server action conventions |
| `frontend`       | React components, pages, layouts, client hooks     | Component patterns, Server vs Client components, Suspense, UI conventions     |
| `agent-tools`    | Agent tool definitions, tool registries            | CLAUDE.md tool naming conventions, existing tool patterns                     |
| `ai-integration` | AI SDK usage, streaming, agent orchestration       | AI SDK patterns (streamText, generateText, tools), SSE streaming              |
| `data-modeling`  | DB schema changes, migrations, seed data           | Drizzle ORM patterns, migration safety, data integrity                        |
| `test-writer`    | Test coverage for new/changed code                 | Existing test patterns, test utilities, factories                             |
| `ux-specialist`  | Navigation, layouts, user flows, responsive design | Existing UI patterns, component library, Tailwind conventions                 |
| `cleanup`        | Renames, dead code removal, import fixes           | Git status, find-and-replace patterns, tsc verification                       |

**Team design rules:**

- Each teammate owns a **distinct set of files** — no overlap
- If two roles must touch the same file, make one depend on the other (sequential via task dependencies)
- Prefer fewer, focused teammates over many generalists
- Every team gets a `reviewer` (code review + simplification) and `tester` (verification) — these run AFTER development

### Step 4: Log Team Design

Log the team composition to the console so the user can see it, then **proceed immediately** — no approval needed:

```
Team: ship-<short-topic>

Teammates:
  <name> (<archetype>) — <what they'll do>, <key files they own>
  ...
  reviewer — code review after development
  tester — testing + verification after development

Task breakdown:
  1. <task> → assigned to <name>
  2. <task> → assigned to <name> (blocked by: #1)
  ...

Estimated scope: <N> tasks, <N> files changed
```

**Do NOT wait for approval. Proceed to spawning immediately.**

## Phase 2: Spawn & Build (Parallel where possible)

### Step 5: Create Team and Tasks

1. Create the agent team: `ship-<short-topic>`
2. Spawn all teammates with `bypassPermissions` mode and `sonnet` model
3. Create all tasks in the shared task list with proper dependencies
4. Give each teammate a **rich spawn prompt** that includes:
   - Their specific role and file ownership
   - Relevant codebase context (file paths, existing patterns to follow)
   - CLAUDE.md conventions that apply to their work
   - Which tasks are theirs
   - Constraint: `Run tsc --noEmit after each significant change`

### Step 6: Development

Developers claim and work through their tasks. Monitor progress:

- Check task list periodically
- If a teammate is stuck (2+ attempts on same issue), help unblock or restructure
- If a teammate finishes early, point them to unclaimed tasks
- Watch for file conflicts — intervene immediately if two teammates touch the same file

**Wait for all development tasks to complete before proceeding.**

## Phase 3: Review + Test (Parallel)

### Step 7: Code Review

Spawn or assign `reviewer` to:

1. `git diff` — review all changes
2. Check against:
   - **Simplicity** — no over-engineering, YAGNI
   - **Consistency** — follows existing codebase patterns
   - **CLAUDE.md** — naming conventions, tool patterns
   - **React best practices** — Server/Client split, Suspense, dynamic imports
   - **AI SDK patterns** — streamText, structured outputs, tool calling (if applicable)
   - **Security** — no injection vectors, proper validation
3. Create fix tasks for issues found (mark severity: critical / nice-to-have)

### Step 8: Testing

In parallel with review, spawn or assign `tester` to:

1. `npx tsc --noEmit` — type checking
2. `npm test` — run test suite
3. `npm run lint` — linting (if available)
4. If UI changes: verify pages load, no console errors
5. Create fix tasks for failures

**Wait for both review and testing to complete.**

## Phase 4: Fix (Iterative)

### Step 9: Fix Issues

1. Assign fix tasks to the appropriate original developers (they know the code best)
2. After fixes, have `tester` verify again
3. **Repeat until clean:** `tsc --noEmit` passes AND `npm test` passes AND no critical review findings remain

## Phase 5: Ship

### Step 10: Final Check (Lead does this)

1. `git diff` — review complete changeset one more time
2. `npx tsc --noEmit` — clean
3. `npm test` — green
4. Verify no files outside planned scope were modified

### Step 11: Cleanup & Report

1. Shut down all teammates gracefully
2. Clean up the team
3. Report to user:
   - **What was built** — summary of changes
   - **Files changed** — grouped by domain
   - **Test results** — pass/fail summary
   - **Open items** — anything deferred or worth noting
   - Suggest a commit message

## Hard Rules

- **Lead never writes code.** You coordinate, delegate, unblock, and verify.
- **File ownership is sacred.** Two teammates must never edit the same file simultaneously. Use task dependencies to enforce sequential access when needed.
- **Small tasks.** 5-6 tasks per developer, each self-contained with clear deliverables.
- **Fail fast.** If stuck after 2 attempts, restructure or reassign.
- **Context is king.** Teammates don't inherit your conversation — give them everything they need in their spawn prompt and task descriptions.
- **No scope creep.** Developers follow the plan. No bonus refactoring, no extra features.

Start with Phase 1 now.
