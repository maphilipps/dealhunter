#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# RALPH: Full Lifecycle Runner
#
# Phasen:
#   1. Pre-flight  — Clean tree, Context sammeln
#   2. Execute     — Hauptworkflow inkl. Review-Loop (bis Done)
#   3. Verify      — Finale Checks
#   4. Finalize    — Abschluss
#
# Beendet sich erst, wenn Review-Findings gelöst sind.
# ─────────────────────────────────────────────────────────────

# --- Config ---
PROJECT_NUMBER=4
PROJECT_OWNER=maphilipps
MAX_CYCLES=5
MODEL="github-copilot/claude-opus-4.5"

# --- Logging ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${BLUE}[RALPH]${NC} $1"; }
phase()   { echo -e "\n${CYAN}━━━ Phase $1 ━━━${NC}"; }
success() { echo -e "${GREEN}  ✓${NC} $1"; }
warn()    { echo -e "${YELLOW}  !${NC} $1"; }
fail()    { echo -e "${RED}  ✗${NC} $1"; }

# --- Helpers ---
get_board_issues() {
  local status="$1"
  gh project item-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json 2>/dev/null \
    | jq -r "[.items[] | select(.status == \"$status\") | .content.number] | sort | .[]" 2>/dev/null || true
}

run_checks() {
  local all_pass=true
  for cmd in "npm run typecheck" "npm run test:run" "npm run lint" "npm run format:check"; do
    if $cmd > /dev/null 2>&1; then
      success "$cmd"
    else
      fail "$cmd"
      all_pass=false
    fi
  done
  $all_pass
}

board_snapshot() {
  local has_any=false
  for status in "Ready" "In progress" "In review" "Done"; do
    issues=$(get_board_issues "$status")
    if [[ -n "$issues" ]]; then
      log "  $status: $(echo $issues | tr '\n' ' ')"
      has_any=true
    fi
  done
  $has_any || log "  (Board leer)"
}

# ─────────────────────────────────────────────────────────────
# Phase 1: Pre-flight
# ─────────────────────────────────────────────────────────────
phase "1: Pre-flight"

if [[ -n $(git status --porcelain) ]]; then
  fail "Working tree not clean. Commit or stash first."
  git status --short
  exit 1
fi
success "Working tree clean"

log "Branch: $(git branch --show-current)"

ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

log "Board-Status vor Start:"
board_snapshot

# ─────────────────────────────────────────────────────────────
# Phase 2: Execute — Loop bis Issue auf Done steht
# ─────────────────────────────────────────────────────────────
phase "2: Execute (Implementation + Review bis Done)"

cycle=0
while true; do
  cycle=$((cycle + 1))

  if [[ $cycle -gt $MAX_CYCLES ]]; then
    fail "Max Zyklen ($MAX_CYCLES) erreicht. Board-Status:"
    board_snapshot
    exit 1
  fi

  # Was muss noch passieren?
  in_progress=$(get_board_issues "In progress")
  in_review=$(get_board_issues "In review")
  ready=$(get_board_issues "Ready")

  # Fertig wenn nichts mehr offen ist
  if [[ -z "$in_progress" && -z "$in_review" && -z "$ready" ]]; then
    success "Keine offenen Issues mehr. Weiter zu Verify."
    break
  fi

  log "Zyklus $cycle/$MAX_CYCLES"

  # Bestimme was opencode tun soll
  if [[ $cycle -eq 1 ]]; then
    # Erster Durchlauf: voller Workflow aus prompt.md
    log "Starte Hauptworkflow..."
    opencode run @plans/prompt.md \
      "Previous RALPH commits: $ralph_commits

       WICHTIG: Der Lifecycle ist erst komplett wenn:
       1. Implementation committet ist
       2. Alle Checks bestehen (typecheck, test, lint, format)
       3. /workflows:review durchgeführt wurde
       4. ALLE Review-Findings behoben und committet sind
       5. Ein Re-Review bestätigt hat dass alles sauber ist
       6. Das Issue auf 'Done' steht und geschlossen ist

       Beende NICHT vor Schritt 6." \
      --model="$MODEL"
  else
    # Folgezyklus: gezielt aufräumen was noch offen ist
    context=""
    [[ -n "$in_progress" ]] && context="Issues in 'In progress': $in_progress. Implementierung abschließen, committen, Review durchführen."
    [[ -n "$in_review" ]]   && context="$context Issues in 'In review': $in_review. Review-Findings beheben, Re-Review bestätigen."
    [[ -n "$ready" ]]       && context="$context Issues in 'Ready': $ready. Nur bearbeiten falls In-Progress/In-Review leer sind."

    warn "Zyklus $cycle — es gibt noch offene Issues."
    log "$context"

    opencode run \
      "$context

       Für JEDES offene Issue den Lifecycle zu Ende bringen:
       1. Implementierung committen (falls noch nicht geschehen)
       2. Checks: npm run typecheck, npm run test:run, npm run lint, npm run format:check — alle müssen bestehen
       3. /workflows:review durchführen
       4. ALLE Findings beheben und committen
       5. Re-Review: /workflows:review nochmal — muss sauber sein
       6. Board-Status auf 'Done' setzen, Issue schließen

       Beende NICHT bevor alle Issues auf 'Done' stehen.
       Previous RALPH commits: $ralph_commits" \
      --model="$MODEL"
  fi

  # Nach jedem Zyklus: Checks prüfen
  if ! run_checks; then
    warn "Checks fehlgeschlagen nach Zyklus $cycle — wird im nächsten Zyklus behoben."
  fi
done

# ─────────────────────────────────────────────────────────────
# Phase 3: Verify — Finale Checks
# ─────────────────────────────────────────────────────────────
phase "3: Verify"

if run_checks; then
  success "Alle Checks bestanden"
else
  fail "Finale Checks fehlgeschlagen!"
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# Phase 4: Finalize
# ─────────────────────────────────────────────────────────────
phase "4: Finalize"

log "Board-Status nach Durchlauf:"
board_snapshot

echo ""
log "Letzte RALPH-Commits:"
git log --grep="RALPH" -n 5 --oneline

echo ""
success "RALPH Lifecycle abgeschlossen."
