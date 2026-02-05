# DealHunter

A deal aggregation and discovery platform built with Next.js, AI SDK, and TypeScript.

## Task Source

GitHub Issues are the primary task source. Fetch them with:

```bash
gh issue list --state open --json number,title,body,labels,comments --limit 20
```

Parse the JSON to understand:

- Issue number, title, body (requirements)
- Labels (priority: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW)
- Existing comments (prior work, blockers)

## Priority Schema

| Priority | Type                     | Example                         |
| -------- | ------------------------ | ------------------------------- |
| 1        | 🔴 Critical bugfixes     | Production errors, data loss    |
| 2        | 🔴 HIGH-labeled issues   | Action Parity, CRUD gaps        |
| 3        | Tracer bullets           | End-to-end slice of new feature |
| 4        | 🟡 MEDIUM-labeled issues | Tools refactor, Discovery       |
| 5        | 🟢 LOW / Quick wins      | AI SDK patterns, polish         |
| 6        | Refactors                | Code cleanup, tech debt         |

**Tracer Bullets** (from The Pragmatic Programmer): Build a tiny, end-to-end slice first. Validates architecture before investing significant time.

## Issue Lifecycle

### Starting Work

```bash
gh issue edit <number> --add-label "in-progress"
gh issue edit <number> --add-assignee "@me"
```

### Task Complete (Issue Fully Resolved)

```bash
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

gh issue edit <number> --remove-label "in-progress"
```

### Task Partial (Issue Has Remaining Work)

```bash
gh issue comment <number> --body "$(cat <<'EOF'
## 🔄 Progress Update

**Commit:** <sha>
**Completed:** <what was done>

### Remaining Tasks
- [ ] <task 1>
- [ ] <task 2>
EOF
)"
```

### Task Blocked

```bash
gh issue edit <number> --add-label "blocked" --remove-label "in-progress"
gh issue comment <number> --body "## 🚫 Blocked\n\n<reason>"
```
