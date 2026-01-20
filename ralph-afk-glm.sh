#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 (GLM Models) ==="

  result=$(claude --dangerously-skip-permissions --config .claude/settings.json.bak -p "
  **LINEAR ISSUE WORKFLOW:**

  1. **Find Next Issue:** Use Linear MCP to find the highest-priority Backlog issue in Dealhunter project
     - Team: Dealhunter
     - Status: Backlog (bevorzugt) oder Todo
     - Sort by: Priority/Creation Date
     - IMPORTANT: Check that the issue hasn't been started yet

  2. **Start Issue:** Update issue status to 'In Progress' in Linear

  3. **Ralph Wiggum Principle:** BEFORE writing ANY code:
     - Read the issue description carefully
     - Follow the 'Ralph Wiggum Principle' instruction in the issue
     - Check existing code in the mentioned paths
     - Understand what already exists
     - Only then proceed with implementation

  4. **Implement:** Work on the issue following its Acceptance Criteria
     - ONLY work on this ONE issue
     - Follow the requirements exactly
     - Use existing code where possible

  5. **Test & Check:**
     - Run type checks: npm run type-check (if exists)
     - Run tests: npm test (if exists)
     - Fix any errors before proceeding

  6. **Commit:** Commit changes to main branch
     - Format: 'feat(DEA-X): <description>' or 'fix(DEA-X): <description>'
     - Include issue reference in commit message

  7. **Complete Issue:** Update issue status to 'Done' in Linear
     - Add comment with what was implemented
     - Link to commit if possible

  8. **Progress Log:** Append to progress.txt:
     - Issue ID and Title
     - What was implemented
     - Any notes or blockers

  **IMPORTANT RULES:**
  - ONLY work on ONE issue per iteration
  - ALWAYS check existing code first (Ralph Wiggum Principle)
  - ALWAYS commit directly to main (no branches)
  - ALWAYS update Linear issue status
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
