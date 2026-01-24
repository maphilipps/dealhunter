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
     - Use GitHub CLI (gh) to get ALL available issues
     - Command: gh issue list --state open --json number,title,labels,body --limit 50
     - Analyze priorities, dependencies, and impact based on labels:
       * critical > high > medium > low
       * Quick wins: Check for 'Quick Win' mentions in issue body
       * Dependencies: Check Acceptance Criteria for blockers
     - YOU decide which task has the highest priority
     - Consider: labels (critical/high/medium/low), quick wins, dependencies, business value
     - IMPORTANT: Choose ONE task, don't just pick the first in the list

  2. **Start Issue:** Update chosen issue to 'in-progress'
     - Command: gh issue edit <number> --add-label 'in-progress'
     - Add comment: gh issue comment <number> --body '🚀 Starting work on this issue'

  3. **Read ALL Issue Comments:** BEFORE any implementation:
     - Command: gh issue view <number> --json comments --jq '.comments'
     - Comments contain CRITICAL context: feedback, clarifications, requirements updates
     - Comments may contain: bug reports, user requests, code review notes, blockers
     - If comments contradict the description: comments are MORE RECENT and take priority
     - Summarize key points from comments before proceeding

  4. **Ralph Wiggum Principle:** BEFORE writing ANY code:
     - Read the issue description carefully (gh issue view <number>)
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
     - Run tests: npm test (if tests exist)
     - Fix any errors before proceeding
     - If new code added: ensure test coverage
     - Use fix_my_app MCP if build errors occur

  7. **Append progress to progress.txt:**
     - Issue #<number> and Title
     - What was implemented
     - Any notes or blockers
     - Link to commit (after commit step)

  8. **Make a git commit:**
     - Stage changes: git add .
     - Format: 'feat(#<number>): <description>' or 'fix(#<number>): <description>'
     - Include 'Closes #<number>' in commit message body
     - Commit directly to main branch

  9. **Complete Issue:** Close the issue
     - Command: gh issue close <number> --comment '✅ Implemented. See commit <hash>'
     - The 'Closes #<number>' in commit message will auto-close on push
     - Remove 'in-progress' label if needed: gh issue edit <number> --remove-label 'in-progress'

  **CRITICAL RULES:**
  - ONLY work on a SINGLE FEATURE per iteration
  - YOU decide priority based on labels and impact, not just order
  - ALWAYS read ALL issue comments BEFORE implementing (they contain critical updates!)
  - ALWAYS check existing code first (Ralph Wiggum Principle)
  - ALWAYS run type checks and tests before committing
  - ALWAYS update GitHub issue with each step
  - ALWAYS commit directly to main (no branches)
  - If while implementing you notice all work is complete, output: <promise>COMPLETE</promise>

  **GITHUB CLI QUICK REFERENCE:**
  - List issues: gh issue list --state open --json number,title,labels --limit 50
  - View issue: gh issue view <number>
  - View comments: gh issue view <number> --json comments --jq '.comments'
  - Add label: gh issue edit <number> --add-label 'in-progress'
  - Remove label: gh issue edit <number> --remove-label 'in-progress'
  - Comment: gh issue comment <number> --body 'message'
  - Close: gh issue close <number> --comment 'message'
  ")

  echo "$result"


  # Short pause between iterations to avoid rate limits
  sleep 2
done

echo "Completed $1 iterations."
