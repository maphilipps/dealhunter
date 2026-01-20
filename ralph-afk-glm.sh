#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 (GLM Models) ==="

  result=$(claude --dangerously-skip-permissions --config .claude/settings.json.bak -p "
  Use /lfg to implement the next highest-priority Linear issue.

  **WORKFLOW:**
  1. Find the SINGLE highest-priority issue from Linear (team: 'Dealhunter', state: 'Backlog' or 'Todo')
  2. Run: /lfg to execute the full autonomous workflow (plan → work → review → commit)
  3. Run: /workflows:compound to document what was learned/solved
  4. Update Linear issue status to 'Done' when complete
  5. Append to progress.txt with what was implemented

  **PRIORITY RANKING:** 1 (Urgent) > 2 (High) > 3 (Normal) > 4 (Low) > 0 (None)

  **IMPORTANT RULES:**
  - ONLY work on ONE issue per iteration
  - /lfg handles: planning, implementation, review, tests, and commit
  - /workflows:compound handles: knowledge documentation for team learning
  - ALWAYS commit directly to main (no branches)
  - If NO issues left in Backlog, output: <promise>COMPLETE</promise>
  ")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "All Backlog issues complete after $i iterations."
    exit 0
  fi

  # Short pause between iterations to avoid rate limits
  sleep 2
done

echo "Completed $1 iterations."
