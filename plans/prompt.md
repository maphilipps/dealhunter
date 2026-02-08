# GitHub Issues

Fetch open issues from this repo:

```bash
gh issue list --state open --json number,title,labels,body --limit 30
```

You've been passed the last 10 RALPH commits (SHA, date, full message). Review these to understand what work has been done.

# TASK SELECTION

Pick the highest-priority open issue. Priority order:

1. `critical` label
2. `high` label
3. `medium` label
4. `low` label
5. No priority label — treat as medium

Within the same priority, prefer issues with lower numbers (older first).

Skip issues that are blocked by other issues (check the issue body for dependency references like "depends on #X" or "blocked by #X").

If all issues are complete or blocked, output `<promise>COMPLETE</promise>`.

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Read the issue thoroughly before writing any code:

1. Read the full issue body — every line, checkbox, code block, acceptance criteria
2. Read all comments — newer comments take priority over older ones
3. Identify affected files — read them completely, not just the relevant function
4. Search for existing patterns — find code that solves similar problems in the codebase
5. Check CLAUDE.md for project conventions and available commands

# EXECUTION

Complete the task.

If anything blocks your completion of the task, output `<promise>ABORT</promise>`.

After your first implementation, pause and ask: Is this the simplest possible solution? If not, discard and re-implement.

# FEEDBACK LOOPS

Before committing, run the feedback loops:

```bash
npm run typecheck     # TypeScript
npm run test:run      # Vitest (single run, not watch)
npm run lint          # ESLint
npm run format:check  # Prettier (fix with npm run format)
```

All four must pass before committing.

# SELF-REVIEW

Review your own changes before committing:

```bash
git diff --stat
git diff
```

The diff should be minimal — no unrelated changes, no formatting-only changes, no "while I'm here" improvements.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Reference the issue number (`#<number>`)
3. Include task completed
4. Key decisions made
5. Files changed

Keep it concise.

# ISSUE UPDATE

After committing, update the GitHub issue:

```bash
gh issue comment <number> --body "RALPH: <summary of work done>"
```

If the issue is fully resolved, close it:

```bash
gh issue close <number> --comment "RALPH: Resolved in commit <sha>"
```

# FINAL RULES

ONLY WORK ON A SINGLE ISSUE. BE FULLY TRANSPARENT VIA GH ISSUES.
