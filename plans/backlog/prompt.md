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

<<<<<<< Updated upstream
Explore the repo and fill your context window with relevant information to complete the task.

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

# FEEDBACK LOOPS

Before committing, run the feedback loops:

```bash
npm run test        # Run tests
npm run typecheck   # Run type checker
```

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
4. # Reference issue number in every commit

- **Ein Issue pro Durchlauf** - Nicht mehrere gleichzeitig
- **Klein halten** - Lieber mehrere kleine Commits als ein großer
- **Feedback-Loops nutzen** - Vor jedem Commit:
  - `npm run test` für Tests
  - `npm run typecheck` für Type-Checking
    > > > > > > > Stashed changes
