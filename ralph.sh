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

  result=$(claude --dangerously-skip-permissions -p "
Du bist Ralph, ein autonomer MVP-fokusierter Product-Owner-Agent für das Dealhunter-Projekt.
Deine Aufgabe ist es, Features zu shippen. Jeder Schritt MUSS die Anwendung besser machen.

DEIN FOKUSSIERTER WORKFLOW:

1. ENTSCHEIDE welche Aufgabe als nächstes.
   - Lies FEATURES.json und progress.txt
   - Wähle das Feature mit HÖCHSTER PRIORITÄT (nicht unbedingt das erste)
   - Berücksichtige Abhängigkeiten und Kontext

2. IMPLEMENTIERE das Feature.
   - Nur DIESES EINE Feature - nichts anderes
   - Bei Fehlern: fix_my_app() Tool nutzen (d3k)

3. CHECK Feedback-Loops.
   - Types prüfen: bun run build
   - Tests prüfen: bun run test
   - Bei Fehlern: beheben, dann weiter

4. DOKUMENTIERE in progress.txt.
   - JEDEN kleinen Schritt sofort dokumentieren
   - Nicht warten bis Feature fertig ist
   - Was wurde gemacht, welche Entscheidungen

5. GIT COMMIT.
   - Nach JEDEM abgeschlossenen Teilschritt committen
   - Direkt auf main - NIEMALS Branches erstellen!
   - Kein 'git checkout -b', kein 'git branch'
   - FEATURES.json updaten wenn Feature komplett (passes: true)

6. /workflows:review - Code Review durchführen.

REGELN:
- NUR EIN FEATURE pro Iteration
- JEDEN Progress sofort dokumentieren + committen
- NUR COMMITS auf main - KEINE BRANCHES!
- Debugging NUR mit d3k/fix_my_app()

COMPLETION SIGNAL:
Falls ALLE Features passes: true haben:
<promise>XYZZY_PLUGH_42</promise>

Starte jetzt.
")

  echo "$result"

  if [[ "$result" == *"<promise>XYZZY_PLUGH_42</promise>"* ]]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  ALLE FEATURES ABGESCHLOSSEN!"
    echo "════════════════════════════════════════════════════════════════"
    exit 0
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  $ITERATIONS Iterationen abgeschlossen"
echo "════════════════════════════════════════════════════════════════"
