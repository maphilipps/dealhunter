#!/bin/bash
set -e

PLAN_FILE="${1:-docs/plans/2026-01-30-deep-scan-v2-mvp.md}"
START_BATCH="${2:-1}"

# ── Batch Definitions ──────────────────────────────────────────────
# Format: "task_range|description"
BATCHES=(
  "1-3|Foundation: Types, Constants, Schema, BullMQ Queue"
  "4-6|Checkpoint System, RAG Foundation, RAG Ingest Pipeline"
  "7-10|Audit Modules: Tech, Performance, A11y, Components"
  "11-14|Expert Agents (CMS, Industry) + Orchestrator + Tools"
  "15-18|Indication Generator + APIs (Interview, Pipeline, Results)"
  "19-22|Knowledge APIs + UI (Chat, Audit View, Pitch Page)"
  "23-24|Worker Wiring + Integration Testing"
)

TOTAL_BATCHES=${#BATCHES[@]}
PROGRESS_FILE="batch-progress.log"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Ralph AFK — Batch Plan Executor (Superpowers Edition)  ║"
echo "║  Plan: $PLAN_FILE"
echo "║  Batches: $START_BATCH to $TOTAL_BATCHES                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

for ((i=START_BATCH-1; i<TOTAL_BATCHES; i++)); do
  batch="${BATCHES[$i]}"
  task_range="${batch%%|*}"
  description="${batch##*|}"
  batch_num=$((i+1))

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  BATCH $batch_num/$TOTAL_BATCHES — Tasks $task_range"
  echo "  $description"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  REVIEW_FILE=$(mktemp /tmp/batch-review-XXXXXX.md)

  # ── Phase 1: Implement (superpowers:executing-plans) ────────────
  echo ""
  echo "▶ Phase 1/4: Implementing Tasks $task_range..."
  echo "  Skill: superpowers:executing-plans"
  echo ""

  claude --dangerously-skip-permissions -p "
  Invoke the superpowers:executing-plans skill and follow it exactly.

  You are implementing Batch $batch_num (Tasks $task_range) from the plan file: $PLAN_FILE

  The executing-plans skill defines:
  - Step 1: Load and review the plan (read $PLAN_FILE, find Tasks $task_range)
  - Step 2: Execute batch — implement each task following the plan steps exactly
  - Step 3: Report what was implemented with verification output

  Additional rules:
  - Read CLAUDE.md first for project conventions
  - For each task: read all referenced files BEFORE writing code
  - Run TypeScript check after each task: npx tsc --noEmit --pretty 2>&1 | grep -v node_modules | head -30
  - Commit after each task with format: feat(pitch): <description>
    Include Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  - Only stage relevant files (no git add -A)
  - If blocked on a task, skip it and note why

  Use the superpowers:verification-before-completion skill before claiming any task is done:
  - Run the verification command FRESH
  - Read the FULL output
  - Only claim completion with evidence
  "

  echo ""
  echo "✓ Phase 1 complete"

  sleep 2

  # ── Phase 2: Review (superpowers:requesting-code-review) ────────
  echo ""
  echo "▶ Phase 2/4: Reviewing Batch $batch_num..."
  echo "  Skill: superpowers:requesting-code-review"
  echo ""

  claude --dangerously-skip-permissions -p "
  Invoke the superpowers:requesting-code-review skill.

  You are reviewing Batch $batch_num (Tasks $task_range) of the plan: $PLAN_FILE

  Step 1: Determine the diff range
  - Run: git log --oneline -15
  - Find the commits from this batch (feat(pitch): ... messages)
  - Get BASE_SHA (commit before batch) and HEAD_SHA (latest commit)

  Step 2: Dispatch the code-reviewer subagent (use Task tool with superpowers:code-reviewer):
  - WHAT_WAS_IMPLEMENTED: Batch $batch_num — Tasks $task_range ($description)
  - PLAN_OR_REQUIREMENTS: $PLAN_FILE
  - BASE_SHA and HEAD_SHA from step 1
  - DESCRIPTION: Pitch pipeline batch $batch_num implementation

  Step 3: Also invoke these review skills from CLAUDE.md (use Task tool in parallel):
  - react-best-practices — for any React/Next.js code
  - ai-sdk — for any AI SDK usage
  - code-simplifier — simplify and refine for clarity

  Step 4: Combine all review findings and write them to: $REVIEW_FILE
  Format:
  - CRITICAL: [file:line] issue — recommended fix
  - IMPORTANT: [file:line] issue — recommended fix
  - SUGGESTION: [file:line] issue — recommended fix

  If no issues found across all reviewers, write 'NO_ISSUES_FOUND' to $REVIEW_FILE.
  " > /dev/null

  echo "✓ Phase 2 complete — Review saved to $REVIEW_FILE"

  sleep 2

  # ── Phase 3: Fix Findings (superpowers:receiving-code-review) ───
  echo ""
  echo "▶ Phase 3/4: Fixing review findings..."
  echo "  Skill: superpowers:receiving-code-review"
  echo ""

  if grep -q "NO_ISSUES_FOUND" "$REVIEW_FILE" 2>/dev/null; then
    echo "✓ No issues found — skipping fix phase"
  else
    claude --dangerously-skip-permissions -p "
    Invoke the superpowers:receiving-code-review skill and follow it exactly.

    The review findings are in: $REVIEW_FILE

    The receiving-code-review skill defines:
    1. READ: Read the complete review from $REVIEW_FILE without reacting
    2. UNDERSTAND: Restate each finding in your own words
    3. VERIFY: Check each finding against the actual codebase — is it technically correct?
    4. EVALUATE: Does the suggestion make sense for THIS codebase?
       - If a finding is WRONG: note why and skip it
       - If a finding is CORRECT: implement it
    5. IMPLEMENT: Fix one item at a time, test each:
       - First: CRITICAL items (blocking)
       - Then: IMPORTANT items
       - Then: SUGGESTION items only if trivial (< 2 lines)
    6. After all fixes: run TypeScript check fresh

    Commit fixes with: fix(pitch): address review findings for batch $batch_num
    Include Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

    RULES from the skill:
    - No performative agreement — just fix or push back with reasoning
    - Verify each finding against codebase before implementing
    - Do NOT refactor beyond what the review asks
    - Do NOT add features
    "

    echo "✓ Phase 3 complete — Fixes applied"
  fi

  sleep 2

  # ── Phase 4: Verify (superpowers:verification-before-completion) ─
  echo ""
  echo "▶ Phase 4/4: Final verification..."
  echo "  Skill: superpowers:verification-before-completion"
  echo ""

  claude --dangerously-skip-permissions -p "
  Invoke the superpowers:verification-before-completion skill.

  You are verifying that Batch $batch_num (Tasks $task_range) is complete.

  The Iron Law: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

  1. Run FRESH TypeScript check: npx tsc --noEmit --pretty 2>&1 | grep -v node_modules | head -50
     - Read FULL output, check exit code
  2. Run tests if they exist: npm test -- --run 2>&1 | tail -20
  3. Check git status: no unstaged changes should remain
  4. Re-read the plan ($PLAN_FILE), find Tasks $task_range
  5. Create a checklist: for each task, verify the expected files exist and contain the expected code
  6. Report actual state WITH evidence — not 'should work' but 'verified: X passes, Y exists'

  Write the verification result to the end of: batch-progress.log
  Format: YYYY-MM-DD HH:MM — Batch N (Tasks X-Y): description — VERIFIED/FAILED
  Include evidence summary.
  " > /dev/null

  echo "✓ Phase 4 complete"

  # Clean up temp file
  rm -f "$REVIEW_FILE"

  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo "  BATCH $batch_num COMPLETE ✓"
  echo "══════════════════════════════════════════════════════════"

  sleep 5
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ALL BATCHES COMPLETE                                    ║"
echo "║  Progress log: $PROGRESS_FILE                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
