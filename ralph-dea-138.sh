#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

PARENT_ISSUE="DEA-138"

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 (Working on $PARENT_ISSUE) ==="

  result=$(claude --dangerously-skip-permissions -p "
  **FOCUSED FEATURE WORKFLOW - $PARENT_ISSUE ONLY:**

  You are working EXCLUSIVELY on Linear issue $PARENT_ISSUE and its subtasks.
  URL: https://linear.app/adessocms/issue/DEA-138/prd-lead-detail-page-redesign-deep-scan-navigation-and-rag-integration

  1. **Get Issue and Subtasks:**
     - Use Linear MCP to get issue $PARENT_ISSUE details
     - List all subtasks/children of $PARENT_ISSUE
     - Team: Dealhunter
     - Identify which subtask to work on next based on:
       * Status (prioritize 'Todo' over 'Backlog')
       * Dependencies between subtasks
       * Logical implementation order
     - If parent issue has no subtasks, work on the parent itself

  2. **Start Issue:** Update chosen issue status to 'In Progress' in Linear
     - Add comment: \"Starting work on this issue\"

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
     - ONLY work on this ONE subtask/feature
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
     - Format: 'feat($PARENT_ISSUE): <description>' or 'fix($PARENT_ISSUE): <description>'
     - Include issue reference in commit message
     - Commit directly to current branch

  9. **Complete Issue:** Update issue status to 'Done' in Linear
     - Add comment with what was implemented
     - Reference commit hash

  **CRITICAL RULES:**
  - ONLY work on $PARENT_ISSUE or its subtasks - NO OTHER ISSUES
  - ONE subtask per iteration
  - ALWAYS read ALL issue comments BEFORE implementing (they contain critical updates!)
  - ALWAYS check existing code first (Ralph Wiggum Principle)
  - ALWAYS run type checks and tests before committing
  - ALWAYS update Linear issue with each step
  - If ALL subtasks of $PARENT_ISSUE are complete, output: <promise>COMPLETE</promise>
  - If $PARENT_ISSUE itself is complete (no more work), output: <promise>COMPLETE</promise>
  ")

  echo "$result"

  # Check if all work is complete
  if echo "$result" | grep -q "<promise>COMPLETE</promise>"; then
    echo "=== All subtasks of $PARENT_ISSUE completed! ==="
    exit 0
  fi

  # Short pause between iterations to avoid rate limits
  sleep 2
done

echo "Completed $1 iterations for $PARENT_ISSUE."
