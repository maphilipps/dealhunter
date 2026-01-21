#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 ==="

  result=$(claude --dangerously-skip-permissions -p "
  **LINEAR ISSUE WORKFLOW WITH SKILLS & WORKFLOWS:**

  1. **Find Next Issue:** Use Linear MCP to find the SINGLE highest-priority issue
     - Use list_issues with:
       * team: 'Dealhunter'
       * state: 'Backlog' (preferred) or 'Todo'
       * limit: 50
     - **ALWAYS select by HIGHEST PRIORITY FIRST:**
       * Priority 1 (Urgent) = HIGHEST priority → select these FIRST
       * Priority 2 (High) = Second highest
       * Priority 3 (Normal) = Third
       * Priority 4 (Low) = Fourth
       * Priority 0 (None) = Lowest → select these LAST
     - **Selection order:**
       1. Find ALL priority 1 (Urgent) issues → if any exist, take the oldest (earliest createdAt)
       2. If no priority 1: find ALL priority 2 (High) issues → take oldest
       3. If no priority 2: find ALL priority 3 (Normal) issues → take oldest
       4. If no priority 3: find ALL priority 4 (Low) issues → take oldest
       5. If no priority 4: find ALL priority 0 (None) issues → take oldest
     - ONLY select ONE issue, not multiple
     - IMPORTANT: Verify issue status is Backlog/Todo before starting

  2. **Start Issue:** Update issue status to 'In Progress' in Linear
     - Add comment: 'Starting implementation - invoking workflow'

  3. **Invoke Skills:** Load relevant skills for this project
     - Run: /vercel-react-best-practices
     - Run: /ai-backend (Vercel AI SDK for backend/agents)
     - Run: /ai-elements (Vercel AI Elements for UI)
     - These skills provide context for Next.js, React, and AI SDK patterns
     - Add Linear comment: 'Skills loaded - proceeding to planning'

  4. **Plan Phase:** Use planning workflow
     - Run: /workflows:plan
     - This will create a detailed implementation plan
     - Review the plan before proceeding
     - Add Linear comment: 'Plan created at .claude/plans/[plan-file].md'

  5. **Deepen Plan (Optional):** Enhance plan with research
     - Run: /deepen-plan (if needed for complex features)
     - This adds best practices, performance considerations, UI details
     - Add Linear comment: 'Plan enhanced with research agents'

  6. **Implementation Phase:** Use work workflow
     - Run: /workflows:work
     - This will implement the feature following the plan
     - Adheres to Ralph Wiggum Principle (check existing code first)
     - Uses ShadCN components and Vercel AI SDK patterns
     - **IMPORTANT:** Maintain 80%+ test coverage with Vitest
     - Update Linear with each completed TodoWrite task
     - Add Linear comment: 'Implementation complete - [X] tests passing, [Y]% coverage'

  7. **Review Phase:** Use review workflow
     - Run: /workflows:review
     - This will perform comprehensive code review
     - Ensures quality and best practices
     - Add Linear comment: 'Review complete - [results]'

  8. **Browser Testing:** Test UI in browser
     - Run: /test-browser
     - This will test pages affected by changes
     - Add Linear comment: 'Browser tests passed - screenshots captured'

  9. **Resolve TODOs:** If any TODOs exist
     - Run: /resolve_todo_parallel
     - This resolves all pending TODOs in parallel

  10. **Test & Verify:**
      - Run type checks: npm run type-check (if exists)
      - Run tests: npm test (if exists)
      - REQUIRE: Coverage >= 80% (Vitest)
      - Fix any errors before proceeding
      - Add Linear comment: 'All tests passing - LSP clean'

  11. **Commit:** Commit changes to main branch
      - Format: 'feat(DEA-X): <description>' or 'fix(DEA-X): <description>'
      - Include issue reference in commit message
      - Add Linear comment: 'Committed to main - [commit hash]'

  12. **Complete Issue:** Update issue status to 'Done' in Linear
      - Add final comment with:
        * What was implemented
        * Test coverage achieved
        * Commit hash
        * Any notes or follow-ups

  13. **Progress Log:** Append to progress.txt:
      - Issue ID and Title
      - What was implemented
      - Test coverage percentage
      - Any notes or blockers

  **IMPORTANT RULES:**
  - ONLY work on ONE issue per iteration
  - ALWAYS use the workflow skills individually (/workflows:plan, /workflows:work, /workflows:review, /test-browser)
  - ALWAYS invoke Vercel skills for context
  - ALWAYS document EVERY step in Linear with comments
  - ALWAYS maintain 80%+ test coverage
  - ALWAYS commit directly to main (no branches)
  - ALWAYS update Linear issue status at each phase
  - ALWAYS update progress.txt when complete
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
