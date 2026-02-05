#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

for ((i=1; i<=$1; i++)); do
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  # Get open GitHub issues with full context
  issues=$(gh issue list --state open --json number,title,body,labels,comments --limit 20 2>/dev/null || echo "[]")

  # Get last 10 RALPH commits
  ralph_commits=$(git log --grep="RALPH:" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  echo "------- ITERATION $i --------"
  echo "Open issues: $(echo "$issues" | jq length)"

  # Clean up any running dev processes
  rm -rf ./.next/dev/lock 2>/dev/null || true

  docker sandbox run claude \
    --verbose \
    --print \
    --output-format stream-json \
    -p "@plans/backlog/prompt.md

## Open GitHub Issues
\`\`\`json
$issues
\`\`\`

## Previous RALPH Commits
$ralph_commits" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "✅ Ralph complete after $i iterations."
    exit 0
  fi

  if [[ "$result" == *"<promise>ABORT</promise>"* ]]; then
    echo "🚫 Ralph aborted in iteration $i. Check GitHub issue comments for details."
    exit 1
  fi
done

echo "⚠️ Ralph reached max iterations ($1) without completing."
exit 0
