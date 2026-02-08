#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# RALPH: Full Lifecycle Runner (Multi-Tool Pipeline)
#
#   1/4  Plan    — Claude Code     — Backlog → Ready
#   2/4  Work    — Codex           — Ready → In Review
#   3/4  Review  — Copilot         — Code Review
#   4/4  Fix     — Copilot         — Findings → Done
#
# Jeder Step nutzt das beste Tool für die Aufgabe.
# ─────────────────────────────────────────────────────────────

COPILOT_MODEL="github-copilot/claude-opus-4.5"

# --- Logging ---
BLUE='\033[0;34m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log()     { echo -e "${BLUE}[RALPH]${NC} $1"; }
phase()   { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
success() { echo -e "${GREEN}  ✓${NC} $1"; }
fail()    { echo -e "${RED}  ✗${NC} $1"; exit 1; }

run_checks() {
  local all_pass=true
  for cmd in "npm run typecheck" "npm run test:run" "npm run lint" "npm run format:check"; do
    if $cmd > /dev/null 2>&1; then
      success "$cmd"
    else
      echo -e "${RED}  ✗${NC} $cmd"; all_pass=false
    fi
  done
  $all_pass
}

# ─────────────────────────────────────────────────────────────
# Pre-flight
# ─────────────────────────────────────────────────────────────
phase "Pre-flight"

[[ -n $(git status --porcelain) ]] && fail "Working tree not clean."
success "Working tree clean"
log "Branch: $(git branch --show-current)"

RALPH_CONTEXT="Previous RALPH commits:
$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "None")"

# ─────────────────────────────────────────────────────────────
# 1/4 — Plan (Claude Code)
# ─────────────────────────────────────────────────────────────
phase "1/4 — Plan via Claude Code (Backlog → Ready)"

claude -p \
  --dangerously-skip-permissions \
  "$(cat plans/prompts/plan.md)

$RALPH_CONTEXT"

success "Plan abgeschlossen"

# ─────────────────────────────────────────────────────────────
# 2/4 — Work (Codex)
# ─────────────────────────────────────────────────────────────
phase "2/4 — Work via Codex (Ready → In Review)"

codex exec --full-auto - < plans/prompts/work.md

success "Work abgeschlossen"

# ─────────────────────────────────────────────────────────────
# 3/4 — Review (Copilot)
# ─────────────────────────────────────────────────────────────
phase "3/4 — Review via Copilot"

opencode run @plans/prompts/review.md "$RALPH_CONTEXT" --model="$COPILOT_MODEL"

success "Review abgeschlossen"

# ─────────────────────────────────────────────────────────────
# 4/4 — Fix (Copilot)
# ─────────────────────────────────────────────────────────────
phase "4/4 — Fix via Copilot (In Review → Done)"

opencode run @plans/prompts/fix.md "$RALPH_CONTEXT" --model="$COPILOT_MODEL"

success "Fix abgeschlossen"

# ─────────────────────────────────────────────────────────────
# Finalize
# ─────────────────────────────────────────────────────────────
phase "Finalize"

if run_checks; then
  success "Alle Checks bestanden"
else
  fail "Finale Checks fehlgeschlagen!"
fi

echo ""
log "Letzte RALPH-Commits:"
git log --grep="RALPH" -n 5 --oneline

echo ""
success "RALPH Lifecycle abgeschlossen."
