#!/bin/bash
set -e

# ─────────────────────────────────────────────────
# RALPH AFK Worker — Parallel-fähig mit Git Worktrees
#
# Usage:
#   bash plans/backlog/afk.sh <iterations>
#
# Parallel (3 Terminals):
#   bash plans/backlog/afk.sh 5 &
#   bash plans/backlog/afk.sh 5 &
#   bash plans/backlog/afk.sh 5 &
# ─────────────────────────────────────────────────

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ITERATIONS=$1
REPO_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_BASE="$REPO_ROOT/.worktrees"
LOCK_DIR="$WORKTREE_BASE/.locks"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# jq filters for Claude CLI streaming output
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

# Track current state for cleanup
current_issue=""
current_worktree=""
tmpfile=""

# ─────────────────────────────────────────────────
# Lockfile functions (POSIX-atomic mkdir)
# ─────────────────────────────────────────────────

lock_issue() {
  local issue_num=$1
  mkdir -p "$LOCK_DIR"
  if mkdir "$LOCK_DIR/issue-$issue_num.lock" 2>/dev/null; then
    echo $$ > "$LOCK_DIR/issue-$issue_num.lock/pid"
    return 0
  fi
  # Check for stale lock
  if is_lock_stale "$LOCK_DIR/issue-$issue_num.lock"; then
    echo "🧹 Stale lock für Issue #$issue_num gefunden (PID tot), räume auf..."
    rm -rf "$LOCK_DIR/issue-$issue_num.lock"
    if mkdir "$LOCK_DIR/issue-$issue_num.lock" 2>/dev/null; then
      echo $$ > "$LOCK_DIR/issue-$issue_num.lock/pid"
      return 0
    fi
  fi
  return 1
}

unlock_issue() {
  local issue_num=$1
  rm -rf "$LOCK_DIR/issue-$issue_num.lock"
}

is_lock_stale() {
  local lockdir=$1
  local pid_file="$lockdir/pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0  # PID dead → stale lock
    fi
  fi
  return 1
}

acquire_merge_lock() {
  mkdir -p "$LOCK_DIR"
  while ! mkdir "$LOCK_DIR/merge.lock" 2>/dev/null; do
    # Check for stale merge lock
    if is_lock_stale "$LOCK_DIR/merge.lock"; then
      echo "🧹 Stale Merge-Lock gefunden, räume auf..."
      rm -rf "$LOCK_DIR/merge.lock"
      continue
    fi
    echo "⏳ Warte auf Merge-Lock (anderer Worker merged gerade)..."
    sleep 2
  done
  echo $$ > "$LOCK_DIR/merge.lock/pid"
}

release_merge_lock() {
  rm -rf "$LOCK_DIR/merge.lock"
}

# ─────────────────────────────────────────────────
# Issue selection (first unlocked issue)
# ─────────────────────────────────────────────────

select_issue() {
  local issues_json=$1
  local count
  count=$(echo "$issues_json" | jq length)
  for ((j=0; j<count; j++)); do
    local num
    num=$(echo "$issues_json" | jq -r ".[$j].number")
    if lock_issue "$num"; then
      echo "$num"
      return 0
    fi
  done
  return 1
}

get_issue_title() {
  local issues_json=$1
  local issue_num=$2
  echo "$issues_json" | jq -r ".[] | select(.number == $issue_num) | .title"
}

get_issue_json() {
  local issues_json=$1
  local issue_num=$2
  echo "$issues_json" | jq ".[] | select(.number == $issue_num)"
}

# ─────────────────────────────────────────────────
# Status banner
# ─────────────────────────────────────────────────

print_banner() {
  local iter=$1 total=$2 issue_num=$3 title=$4
  local pid=$$
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  🤖 RALPH Worker [PID $pid]"
  printf "║  ITERATION %d/%d\n" "$iter" "$total"
  echo "║  Issue #$issue_num: $title"
  echo "║  Worktree: .worktrees/ralph-issue-$issue_num"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
}

# ─────────────────────────────────────────────────
# GitHub issue claim comment
# ─────────────────────────────────────────────────

claim_issue() {
  local issue_num=$1
  local branch="ralph-issue-$issue_num"
  gh issue comment "$issue_num" --body "$(cat <<EOF
## 🤖 RALPH Worker übernimmt

| | |
|---|---|
| **PID** | $$ |
| **Branch** | \`$branch\` |
| **Worktree** | \`.worktrees/$branch\` |
| **Gestartet** | $(date '+%Y-%m-%d %H:%M:%S') |
EOF
)"
  gh issue edit "$issue_num" --add-label "in-progress" 2>/dev/null || true
}

# ─────────────────────────────────────────────────
# Worktree management
# ─────────────────────────────────────────────────

create_worktree() {
  local issue_num=$1
  local branch="ralph-issue-$issue_num"
  local worktree_path="$WORKTREE_BASE/$branch"

  mkdir -p "$WORKTREE_BASE"

  # Create branch from current main
  git branch "$branch" main 2>/dev/null || true
  git worktree add "$worktree_path" "$branch"

  echo "$worktree_path"
}

remove_worktree() {
  local issue_num=$1
  local branch="ralph-issue-$issue_num"
  local worktree_path="$WORKTREE_BASE/$branch"

  if [ -d "$worktree_path" ]; then
    git worktree remove "$worktree_path" --force 2>/dev/null || true
  fi
  git branch -D "$branch" 2>/dev/null || true
}

# ─────────────────────────────────────────────────
# Squash-merge to main
# ─────────────────────────────────────────────────

merge_to_main() {
  local branch=$1
  local issue_num=$2
  local start_time=$3

  acquire_merge_lock

  # Ensure we release on any exit from this function
  local merge_ok=false

  cd "$REPO_ROOT"
  git checkout main
  git pull --rebase origin main

  if git merge --squash "$branch"; then
    # Build commit message from squashed changes
    local commit_msg
    commit_msg=$(cat <<EOF
RALPH: squash merge issue #$issue_num

Merged from worktree branch $branch
EOF
)
    if git commit -m "$commit_msg"; then
      if git push origin main; then
        merge_ok=true
      fi
    fi
  fi

  release_merge_lock

  if $merge_ok; then
    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - start_time ))
    local minutes=$(( duration / 60 ))
    local seconds=$(( duration % 60 ))
    echo ""
    echo "✅ Issue #$issue_num merged to main | ⏱ ${minutes}m ${seconds}s"
    echo ""
    return 0
  else
    echo ""
    echo "❌ Merge für Issue #$issue_num fehlgeschlagen"
    echo ""
    return 1
  fi
}

# ─────────────────────────────────────────────────
# Cleanup on exit (SIGINT, SIGTERM, normal exit)
# ─────────────────────────────────────────────────

cleanup_on_exit() {
  echo ""
  echo "🧹 Cleanup Worker [PID $$]..."

  if [ -n "$current_issue" ]; then
    unlock_issue "$current_issue"
    remove_worktree "$current_issue"
  fi

  # Only release merge lock if we own it
  if [ -f "$LOCK_DIR/merge.lock/pid" ]; then
    local lock_pid
    lock_pid=$(cat "$LOCK_DIR/merge.lock/pid" 2>/dev/null || echo "")
    if [ "$lock_pid" = "$$" ]; then
      release_merge_lock
    fi
  fi

  [ -n "$tmpfile" ] && rm -f "$tmpfile"

  echo "👋 Worker [PID $$] beendet."
}
trap cleanup_on_exit EXIT INT TERM

# ─────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────

echo ""
echo "🤖 RALPH AFK Worker gestartet [PID $$]"
echo "   Iterationen: $ITERATIONS"
echo "   Repo: $REPO_ROOT"
echo ""

for ((i=1; i<=ITERATIONS; i++)); do
  tmpfile=$(mktemp)
  current_issue=""
  current_worktree=""

  # 1. Update main
  cd "$REPO_ROOT"
  git checkout main 2>/dev/null || true
  git pull --rebase origin main 2>/dev/null || true

  # 2. Fetch open issues + recent commits
  issues=$(gh issue list --state open --json number,title,body,labels,comments --limit 20 2>/dev/null || echo "[]")
  ralph_commits=$(git log --grep="RALPH:" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  issue_count=$(echo "$issues" | jq length)
  echo "📋 Offene Issues: $issue_count"

  if [ "$issue_count" -eq 0 ]; then
    echo "✅ Keine offenen Issues mehr. Worker beendet."
    exit 0
  fi

  # 3. Select first unlocked issue
  issue_num=$(select_issue "$issues") || {
    echo "⏳ Alle Issues sind von anderen Workern belegt. Warte 10s..."
    sleep 10
    continue
  }
  current_issue="$issue_num"

  issue_title=$(get_issue_title "$issues" "$issue_num")
  issue_json=$(get_issue_json "$issues" "$issue_num")
  start_time=$(date +%s)

  # 4. Print banner
  print_banner "$i" "$ITERATIONS" "$issue_num" "$issue_title"

  # 5. Create worktree
  current_worktree=$(create_worktree "$issue_num")
  echo "📂 Worktree erstellt: $current_worktree"

  # 6. Claim issue on GitHub
  claim_issue "$issue_num"

  # 7. Clean up any stale dev processes
  rm -rf "$current_worktree/.next/dev/lock" 2>/dev/null || true

  # 8. Run Claude CLI in worktree
  prompt_content=$(cat "$SCRIPT_DIR/prompt.md")
  full_prompt="$prompt_content

## Open GitHub Issues
\`\`\`json
$(echo "$issue_json" | jq -s '.')
\`\`\`

## Previous RALPH Commits
$ralph_commits

## Important: Working Directory
You are working in a git worktree at: $current_worktree
Branch: ralph-issue-$issue_num
Only work on Issue #$issue_num: $issue_title
Do NOT checkout other branches. Commit directly to this branch."

  (cd "$current_worktree" && cc \
    --print \
    --output-format stream-json \
    -p "$full_prompt") \
    | grep --line-buffered '^{' \
    | tee "$tmpfile" \
    | jq --unbuffered -rj "$stream_text"

  # 9. Evaluate result
  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "🔀 Squash-Merge für Issue #$issue_num..."

    if merge_to_main "ralph-issue-$issue_num" "$issue_num" "$start_time"; then
      # Cleanup worktree and lock
      remove_worktree "$issue_num"
      unlock_issue "$issue_num"
      current_issue=""
      current_worktree=""
    else
      echo "⚠️ Merge fehlgeschlagen, Worktree bleibt bestehen: $current_worktree"
      unlock_issue "$issue_num"
      current_issue=""
      current_worktree=""
    fi

  elif [[ "$result" == *"<promise>ABORT</promise>"* ]]; then
    echo ""
    echo "🚫 Issue #$issue_num aborted in Iteration $i"
    remove_worktree "$issue_num"
    unlock_issue "$issue_num"
    current_issue=""
    current_worktree=""

  else
    echo ""
    echo "⚠️ Kein klares Ergebnis für Issue #$issue_num, räume auf..."
    remove_worktree "$issue_num"
    unlock_issue "$issue_num"
    current_issue=""
    current_worktree=""
  fi

  rm -f "$tmpfile"
  tmpfile=""
done

echo ""
echo "🏁 RALPH Worker [PID $$] hat alle $ITERATIONS Iterationen abgeschlossen."
exit 0
