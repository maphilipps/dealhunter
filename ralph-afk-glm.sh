#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo "=== Linting Iteration $i of $1 (GLM Models) ==="

  result=$(claude --dangerously-skip-permissions --settings ~/.claude/settings-glm.json -p "
  **LINTING LOOP - FIX ONE ERROR AT A TIME:**

  1. **Run Linting:**
     - Execute: npm run lint
     - Capture and analyze the output
     - Count total errors remaining

  2. **Identify ONE Error:**
     - Pick the FIRST linting error from the output
     - Understand what the error is about
     - Identify the file and line number

  3. **Fix the Error:**
     - Read the file with the error
     - Fix ONLY this ONE error
     - Keep the fix minimal and focused
     - Don't fix multiple errors at once
     - Don't refactor unrelated code

  4. **Verify the Fix:**
     - Run npm run lint again
     - Confirm this specific error is gone
     - Check that no NEW errors were introduced
     - If error persists, try a different approach

  5. **Commit the Fix:**
     - Stage changes: git add .
     - Format: 'lint: fix <error-type> in <filename>'
     - Example: 'lint: fix unused import in page.tsx'
     - Commit directly to main branch

  6. **Report Progress:**
     - State which error was fixed
     - Show errors remaining count
     - If no errors remain, output: <promise>COMPLETE</promise>

  **CRITICAL RULES:**
  - Fix ONLY ONE error per iteration
  - ALWAYS verify with npm run lint after fixing
  - Keep changes minimal - don't over-engineer
  - Commit after each successful fix
  - Stop when linting shows 0 errors
  ")

  echo "$result"

  # Check if complete
  if echo "$result" | grep -q "<promise>COMPLETE</promise>"; then
    echo "✅ All linting errors fixed!"
    exit 0
  fi

  # Short pause between iterations
  sleep 2
done

echo "Completed $1 linting iterations."
