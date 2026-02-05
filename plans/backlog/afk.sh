#!/bin/bash
set -e

# ─────────────────────────────────────────────────
# RALPH AFK Worker — Simple sequential loop
#
# Usage:
#   bash plans/backlog/afk.sh <iterations>
# ─────────────────────────────────────────────────

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ITERATIONS=$1
REPO_ROOT=$(git rev-parse --show-toplevel)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# jq filters for Claude CLI streaming output
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

tmpfile=""
cleanup() {
  [ -n "$tmpfile" ] && rm -f "$tmpfile"
}
trap cleanup EXIT INT TERM

echo ""
echo "🤖 RALPH AFK Worker gestartet [PID $$]"
echo "   Iterationen: $ITERATIONS"
echo "   Repo: $REPO_ROOT"
echo ""

for ((i=1; i<=ITERATIONS; i++)); do
  tmpfile=$(mktemp)

  # 1. Update main
  cd "$REPO_ROOT"
  git checkout main 2>/dev/null || true
  git pull --rebase origin main 2>/dev/null || true

  # 2. Fetch open issues + recent commits
  issues=$(gh issue list --state open --json number,title,body,labels,comments --limit 20 2>/dev/null || echo "[]")
  ralph_commits=$(git log --grep="RALPH:" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  issue_count=$(echo "$issues" | jq length)

  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  🤖 RALPH Worker [PID $$]"
  printf "║  ITERATION %d/%d\n" "$i" "$ITERATIONS"
  echo "║  📋 Offene Issues: $issue_count"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""

  if [ "$issue_count" -eq 0 ]; then
    echo "✅ Keine offenen Issues mehr. Worker beendet."
    exit 0
  fi

  # 3. Build prompt with context
  prompt_content=$(cat "$SCRIPT_DIR/prompt.md")
  full_prompt="$prompt_content

## Open GitHub Issues
\`\`\`json
$issues
\`\`\`

## Previous RALPH Commits
$ralph_commits"

  # 4. Run Claude CLI
  cc \
    --print \
    --output-format stream-json \
    -p "$full_prompt" \
    | grep --line-buffered '^{' \
    | tee "$tmpfile" \
    | jq --unbuffered -rj "$stream_text"

  # 5. Evaluate result
  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "✅ RALPH complete nach Iteration $i"
    echo "📤 Pushe nach origin main..."
    git push origin main
    exit 0
  fi

  if [[ "$result" == *"<promise>ABORT</promise>"* ]]; then
    echo ""
    echo "🚫 RALPH aborted in Iteration $i"
    exit 1
  fi

  # 6. Push after each successful iteration
  echo ""
  echo "📤 Pushe Änderungen nach origin main..."
  git push origin main 2>/dev/null || echo "⚠️ Push fehlgeschlagen"

  rm -f "$tmpfile"
  tmpfile=""
done

echo ""
echo "🏁 RALPH Worker hat alle $ITERATIONS Iterationen abgeschlossen."
exit 0
