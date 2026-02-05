#!/bin/bash
set -eo pipefail

# ─────────────────────────────────────────────────
# RALPH Once — Human-in-the-Loop (HITL)
#
# Runs a single iteration with --permission-mode acceptEdits.
# The human reviews tool calls in real time.
#
# Usage:
#   bash plans/once.sh
# ─────────────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# jq filters for Claude CLI streaming output
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

tmpfile=$(mktemp)
cleanup() {
  [ -n "$tmpfile" ] && rm -f "$tmpfile"
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

# Fetch open issues + recent commits
issues=$(gh issue list --state open --json number,title,body,labels,comments --limit 20 2>/dev/null || echo "[]")
ralph_commits=$(git log --grep="RALPH:" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

issue_count=$(echo "$issues" | jq length)

echo ""
echo "RALPH Once — Human-in-the-Loop"
echo "  Open issues: $issue_count"
echo "  Mode: --permission-mode acceptEdits"
echo ""

if [ "$issue_count" -eq 0 ]; then
  echo "No open issues. Nothing to do."
  exit 0
fi

# Build prompt with context
prompt_content=$(cat "$SCRIPT_DIR/prompt.md")
full_prompt="$prompt_content

## Open GitHub Issues
\`\`\`json
$issues
\`\`\`

## Previous RALPH Commits
$ralph_commits"

# Run Claude CLI with HITL permissions
claude --permission-mode acceptEdits \
  --print \
  --output-format stream-json \
  -p "$full_prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

# Evaluate result
result=$(jq -r "$final_result" "$tmpfile")

if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
  echo ""
  echo "RALPH complete."
fi

if [[ "$result" == *"<promise>ABORT</promise>"* ]]; then
  echo ""
  echo "RALPH aborted."
  exit 1
fi

echo ""
echo "RALPH Once finished."
exit 0
