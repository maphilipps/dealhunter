#!/bin/bash
# ralph.sh - Autonomous Feature Implementation Loop
# Usage: ./ralph.sh <iterations>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ITERATIONS=$1

for ((i=1; i<=$ITERATIONS; i++)); do
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  RALPH ITERATION $i/$ITERATIONS"
  echo "════════════════════════════════════════════════════════════════"
  echo ""

  claude --dangerously-skip-permissions -p "
/lfg

Iteration $i/$ITERATIONS

Lies FEATURES.json und progress.txt. Wähle das nächste sinnvolle Feature.
Erstelle einen eigenen Branch (feat/...), implementiere, committe.
Nach dem Commit: zurück zu main.
"

done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  $ITERATIONS Iterationen abgeschlossen"
echo "════════════════════════════════════════════════════════════════"
