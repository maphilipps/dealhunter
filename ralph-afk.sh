#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 ==="

  result=$(claude --dangerously-skip-permissions -p "
  **AUTONOMOUS FEATURE WORKFLOW:**

  1. **Decide which task to work on next:**
     - Use Linear MCP to get ALL available issues (Backlog, Todo, In Progress)
     - Team: Dealhunter
     - Analyze priorities, dependencies, and impact
     - YOU decide which task has the highest priority
     - Consider: blockers, quick wins, dependencies, business value
     - IMPORTANT: Choose ONE task, don't just pick the first in the list

  2. **Start Issue:** Update chosen issue status to 'In Progress' in Linear
     - Add comment: \"Starting work on this issue\"

  3. **Ralph Wiggum Principle:** BEFORE writing ANY code:
     - Read the issue description carefully
     - Follow the 'Ralph Wiggum Principle' instruction in the issue
     - Check existing code in the mentioned paths
     - Understand what already exists
     - Only then proceed with implementation

  4. **Implement:** Work on the issue following its Acceptance Criteria
     - ONLY work on this ONE feature
     - Follow the requirements exactly
     - Use existing code where possible
     - Keep changes focused and minimal

  5. **Check feedback loops:**
     - Run type checks: npm run typecheck
     - Run tests: npm test
     - Fix any errors before proceeding
     - If new code added: ensure test coverage
     - Use fix_my_app MCP if build errors occur

  6. **Append progress to progress.txt:**
     - Issue ID and Title
     - What was implemented
     - Any notes or blockers
     - Link to commit (after commit step)

  7. **Make a git commit:**
     - Stage changes: git add .
     - Format: 'feat(DEA-X): <description>' or 'fix(DEA-X): <description>'
     - Include issue reference in commit message
     - Commit directly to main branch

  8. **Complete Issue:** Update issue status to 'Done' in Linear
     - Add comment with what was implemented
     - Reference commit hash
     - Close any related sub-issues if applicable

  **CRITICAL RULES:**
  - ONLY work on a SINGLE FEATURE per iteration
  - YOU decide priority, not the system
  - ALWAYS check existing code first (Ralph Wiggum Principle)
  - ALWAYS run type checks and tests before committing
  - ALWAYS update Linear issue with each step
  - ALWAYS commit directly to main (no branches)
  - If while implementing you notice all work is complete, output: <promise>COMPLETE</promise>
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
