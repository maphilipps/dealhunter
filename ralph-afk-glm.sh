#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 (GLM Models) ==="

  result=$(claude --dangerously-skip-permissions --config .claude/settings.json.bak -p "
  **LINEAR ISSUE WORKFLOW WITH SKILLS & WORKFLOWS:**

  1. **Find Next Issue:** Use Linear MCP to find the SINGLE highest-priority issue
     - Use list_issues with:
       * team: 'Dealhunter'
       * state: 'Backlog' (preferred) or 'Todo'
       * orderBy: 'updatedAt'
       * limit: 50
     - From results, select the ONE issue with LOWEST priority number (1=Urgent is highest)
     - Priority ranking: 1 (Urgent) > 2 (High) > 3 (Normal) > 4 (Low) > 0 (None)
     - If multiple issues have same priority, take the oldest (earliest createdAt)
     - ONLY select ONE issue, not multiple
     - IMPORTANT: Verify issue status is Backlog/Todo before starting

  2. **Start Issue:** Update issue status to 'In Progress' in Linear

  3. **Invoke Skills:** Load relevant skills for this project
     - Run: /vercel-react-best-practices
     - Run: /ai-backend (Vercel AI SDK for backend/agents)
     - Run: /ai-elements (Vercel AI Elements for UI)
     - These skills provide context for Next.js, React, and AI SDK patterns

  4. **Plan Phase:** Use planning workflow
     - Run: /workflows:plan
     - This will create a detailed implementation plan
     - Review the plan before proceeding

  5. **Implementation Phase:** Use work workflow
     - Run: /workflows:work
     - This will implement the feature following the plan
     - Adheres to Ralph Wiggum Principle (check existing code first)
     - Uses ShadCN components and Vercel AI SDK patterns

  6. **Review Phase:** Use review workflow
     - Run: /workflows:review
     - This will perform comprehensive code review
     - Ensures quality and best practices

  7. **Resolve TODOs:** If any TODOs exist
     - Run: /resolve_todo_parallel
     - This resolves all pending TODOs in parallel

  8. **Test & Verify:**
     - Run type checks: npm run type-check (if exists)
     - Run tests: npm test (if exists)
     - Fix any errors before proceeding

  9. **Commit:** Commit changes to main branch
     - Format: 'feat(DEA-X): <description>' or 'fix(DEA-X): <description>'
     - Include issue reference in commit message

  10. **Complete Issue:** Update issue status to 'Done' in Linear
      - Add comment with what was implemented
      - Link to commit if possible

  11. **Progress Log:** Append to progress.txt:
      - Issue ID and Title
      - What was implemented
      - Any notes or blockers

  **IMPORTANT RULES:**
  - ONLY work on ONE issue per iteration
  - ALWAYS use the workflow skills (/workflows:plan, /workflows:work, /workflows:review)
  - ALWAYS invoke Vercel skills for context
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
