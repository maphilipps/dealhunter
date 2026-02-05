# GITHUB ISSUES

Fetch open issues from GitHub:

```bash
gh issue list --state open --json number,title,body,labels,comments --limit 20
```

Parse the JSON to understand:

- Issue number, title, body (requirements)
- Labels (priority: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW)
- Existing comments (prior work, blockers)

# RECENT COMMITS

Review the last 10 RALPH commits to understand what work has been done:

```bash
git log --oneline --grep="RALPH:" -10 --format="%h %ad %s" --date=short
```

# TASK BREAKDOWN

Break down each issue into tasks. An issue may contain:

- A single task (small bugfix, visual tweak)
- Many tasks (large refactor, new feature)

Make each task the **smallest possible unit of work**. We don't want to outrun our headlights. Aim for one small change per task.

# TASK SELECTION

Pick the next task. Prioritize in this order:

| Priority | Type                     | Example                         |
| -------- | ------------------------ | ------------------------------- |
| 1        | 🔴 Critical bugfixes     | Production errors, data loss    |
| 2        | 🔴 HIGH-labeled issues   | Action Parity, CRUD gaps        |
| 3        | Tracer bullets           | End-to-end slice of new feature |
| 4        | 🟡 MEDIUM-labeled issues | Tools refactor, Discovery       |
| 5        | 🟢 LOW / Quick wins      | AI SDK patterns, polish         |
| 6        | Refactors                | Code cleanup, tech debt         |

**Tracer Bullets** (from The Pragmatic Programmer): Build a tiny, end-to-end slice first. Validates architecture before investing significant time.

If all tasks are complete, output `<promise>COMPLETE</promise>`.

# ISSUE STATUS UPDATE

Before starting work, update the issue:

```bash
# Add "in progress" label
gh issue edit <number> --add-label "in-progress"

# Optional: Assign to self
gh issue edit <number> --add-assignee "@me"
```

# EXPLORATION

Read the issue thoroughly before writing any code.

1. **Read the full issue body** — every line, checkbox, code block, acceptance criteria
2. **Read all comments** — newer comments take priority over older ones
3. **Identify affected files** — read them completely, not just the relevant function
4. **Search for existing patterns** — find code that solves similar problems in the codebase
5. **Understand the expected behavior** — what should happen after the change?
6. **Plan verification** — how will you prove the task is done?

Only start coding when you can answer:

- What exactly needs to change?
- Which files are involved?
- What is the expected behavior after the change?
- How will I verify it works?

# SUBAGENTS

Use subagents to parallelize work and keep your context window clean.

- **Parallel exploration**: Dispatch subagents to read multiple files or modules simultaneously
- **Research delegation**: Send codebase-wide searches to a subagent instead of polluting your own context
- **Test running**: Dispatch a subagent to run tests while you continue reviewing your own changes
- **Pattern finding**: Let a subagent search for similar patterns across the codebase

When to use subagents:

- You need to read 3+ files to understand the full picture
- You need to search for a pattern across many files
- You want to run tests without blocking your current work

# EXECUTION

Complete the task.

If anything blocks completion:

1. Output `<promise>ABORT</promise>`
2. Document the blocker in a GitHub comment
3. Remove "in-progress" label

If task is larger than expected:

1. Output `HANG ON A SECOND`
2. Break into smaller chunk
3. Complete only that chunk
4. Comment on issue with partial progress

# ELEGANT SOLUTION

After your first implementation, pause and ask:

> Is this the simplest possible solution?

Signs of a mediocre solution:

- Too many files changed for a small feature
- Complex conditional logic where a simpler pattern exists
- Code duplication instead of reuse
- Over-engineering for hypothetical future requirements

If the answer is no:

1. `git checkout -- .` (discard changes)
2. Think about the simplest approach
3. Implement again from scratch

The second attempt is almost always better. Don't be afraid to throw away your first try.

# FEEDBACK LOOPS

Before committing, run all checks:

```bash
npm run typecheck     # TypeScript
npm run test:run      # Vitest (single run, not watch)
npm run lint          # ESLint
npm run format:check  # Prettier (fix with npm run format)
```

All four must pass before committing. If any fail, fix the issue and re-run.

# SELF-REVIEW

After all checks pass, review your own changes:

```bash
git diff --stat
git diff
```

For every changed file, ask:

- Does this change match the issue requirements?
- Could this break existing functionality?
- Are there edge cases I haven't considered?
- Is there any debug code, console.log, or commented-out code left?

The diff should be **minimal** — no unrelated changes, no formatting-only changes in files you didn't modify, no "while I'm here" improvements.

If you find problems:

- Small issues: fix them
- Fundamental issues: `git checkout -- .` and re-implement

# COMMIT

Make a git commit. The message **must**:

1. Start with `RALPH:` prefix
2. Reference the issue number
3. Include task completed
4. Key decisions made
5. Files changed

Format:

```
RALPH: <short description> (#<issue>)

- Task: <what was done>
- Decision: <key choices made>
- Files: <main files changed>
- Next: <remaining work or blockers>
```

# ISSUE LIFECYCLE

## Task Complete (Issue Fully Resolved)

```bash
# Close with comment
gh issue close <number> --comment "$(cat <<'EOF'
## ✅ Resolved in RALPH commit

**Commit:** <sha>
**Summary:** <what was implemented>

### Changes
- <file1>: <change>
- <file2>: <change>

### Verification
- [ ] Tests pass
- [ ] Typecheck pass
- [ ] Lint pass
- [ ] Format check pass
EOF
)"

# Remove in-progress, add done
gh issue edit <number> --remove-label "in-progress"
```

## Task Partial (Issue Has Remaining Work)

```bash
# Add progress comment
gh issue comment <number> --body "$(cat <<'EOF'
## 🔄 Progress Update

**Commit:** <sha>
**Completed:** <what was done>

### Remaining Tasks
- [ ] <task 1>
- [ ] <task 2>

### Blockers
<any blockers encountered>
EOF
)"
```

## Task Blocked

```bash
# Add blocked label and comment
gh issue edit <number> --add-label "blocked" --remove-label "in-progress"
gh issue comment <number> --body "## 🚫 Blocked\n\n<reason>"
```

# FINAL RULES

1. **ONLY WORK ON A SINGLE TASK**
2. Always update issue status (labels, comments)
3. Never close an issue without verification passing
4. Reference issue number in every commit
