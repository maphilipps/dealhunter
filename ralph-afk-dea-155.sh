#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 (DEA-155 Focus) ==="

  result=$(claude --dangerously-skip-permissions -p "
  **AUTONOMOUS FEATURE WORKFLOW (DEA-155 ONLY):**

  1. **Get DEA-155 and its Subtasks:**
     - Use Linear MCP to get issue DEA-155 first
     - Then list ALL issues and filter for subtasks of DEA-155
     - Team: Dealhunter
     - Focus ONLY on DEA-155 and its subtasks - ignore all other issues
     - Analyze which subtask has the highest priority (consider: dependencies, blocking status, completion order)
     - If DEA-155 has no more open subtasks, work on DEA-155 itself

  2. **Start Issue:** Update chosen issue status to 'In Progress' in Linear
     - Add comment: \"Starting work on this issue (DEA-155 focused workflow)\"

  3. **Read ALL Issue Comments:** BEFORE any implementation:
     - Use Linear MCP list_comments to get ALL comments on the issue
     - Comments contain CRITICAL context: feedback, clarifications, requirements updates
     - Comments may contain: bug reports, user requests, code review notes, blockers
     - If comments contradict the description: comments are MORE RECENT and take priority
     - Summarize key points from comments before proceeding

  4. **Ralph Wiggum Principle:** BEFORE writing ANY code:
     - Read the issue description carefully
     - Follow the 'Ralph Wiggum Principle' instruction in the issue
     - Check existing code in the mentioned paths
     - Understand what already exists
     - Only then proceed with implementation

  5. **Implement:** Work on the issue following its Acceptance Criteria
     - ONLY work on this ONE feature
     - Follow the requirements exactly
     - Use existing code where possible
     - Keep changes focused and minimal

  6. **Check feedback loops:**
     - Run type checks: npm run typecheck
     - Run tests: npm test
     - Fix any errors before proceeding
     - If new code added: ensure test coverage
     - Use fix_my_app MCP if build errors occur

  7. **Append progress to progress.txt:**
     - Issue ID and Title
     - What was implemented
     - Any notes or blockers
     - Link to commit (after commit step)

  8. **Make a git commit:**
     - Stage changes: git add .
     - Format: 'feat(DEA-155): <description>' or 'fix(DEA-155): <description>'
     - For subtasks: include subtask ID too, e.g., 'feat(DEA-155/subtask): <description>'
     - Include issue reference in commit message
     - Commit directly to main branch

  9. **Complete Issue:** Update issue status to 'Done' in Linear
     - Add comment with what was implemented
     - Reference commit hash
     - If this was the last subtask, check if DEA-155 parent can be marked Done

  **CRITICAL RULES:**
  - ONLY work on DEA-155 or its subtasks - IGNORE all other issues
  - ONLY work on a SINGLE FEATURE per iteration
  - ALWAYS read ALL issue comments BEFORE implementing (they contain critical updates!)
  - ALWAYS check existing code first (Ralph Wiggum Principle)
  - ALWAYS run type checks and tests before committing
  - ALWAYS update Linear issue with each step
  - ALWAYS commit directly to main (no branches)
  - If all DEA-155 subtasks AND DEA-155 itself are complete, output: <promise>COMPLETE</promise>
  ")

  echo "$result"

  # Check if DEA-155 is complete
  if echo "$result" | grep -q "<promise>COMPLETE</promise>"; then
    echo "DEA-155 and all subtasks are complete!"
    break
  fi

  # Short pause between iterations to avoid rate limits
  sleep 2
done

echo "Completed $1 iterations (DEA-155 focused)."
