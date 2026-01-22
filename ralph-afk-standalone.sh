#!/bin/bash
set -e

# Ralph AFK - Autonomer Feature Workflow
# Führt Claude Code autonom aus, um Linear Issues zu bearbeiten
#
# Verwendung: ./ralph-afk-standalone.sh <iterations>
# Beispiel:   ./ralph-afk-standalone.sh 5

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  echo ""
  echo "Startet Claude Code im autonomen Modus für die angegebene Anzahl von Iterationen."
  echo "Jede Iteration bearbeitet ein Linear Issue (Team: Dealhunter)."
  exit 1
fi

ITERATIONS=$1

echo "=================================================="
echo "Ralph AFK - Autonomer Feature Workflow"
echo "Iterationen: $ITERATIONS"
echo "Team: Dealhunter"
echo "=================================================="
echo ""

for ((i=1; i<=$ITERATIONS; i++)); do
  echo ""
  echo "=== Iteration $i von $ITERATIONS ==="
  echo "$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

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
   - Format: 'feat(DEA-X): <description>' or 'fix(DEA-X): <description>'
   - Include issue reference in commit message
   - Commit directly to main branch

9. **Complete Issue:** Update issue status to 'Done' in Linear
   - Add comment with what was implemented
   - Reference commit hash
   - Close any related sub-issues if applicable

**CRITICAL RULES:**
- ONLY work on a SINGLE FEATURE per iteration
- YOU decide priority, not the system
- ALWAYS read ALL issue comments BEFORE implementing (they contain critical updates!)
- ALWAYS check existing code first (Ralph Wiggum Principle)
- ALWAYS run type checks and tests before committing
- ALWAYS update Linear issue with each step
- ALWAYS commit directly to main (no branches)
- If while implementing you notice all work is complete, output: <promise>COMPLETE</promise>
")

  echo "$result"

  # Check for completion signal
  if echo "$result" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "=================================================="
    echo "Alle verfügbaren Issues wurden abgeschlossen!"
    echo "Beende nach Iteration $i."
    echo "=================================================="
    break
  fi

  # Pause zwischen Iterationen (Rate Limit Protection)
  if [ $i -lt $ITERATIONS ]; then
    echo ""
    echo "--- Pause vor nächster Iteration (2s) ---"
    sleep 2
  fi
done

echo ""
echo "=================================================="
echo "Ralph AFK abgeschlossen"
echo "Durchgeführte Iterationen: $i von $ITERATIONS"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
