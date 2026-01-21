#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

BRANCH="test-coverage"
WORKTREE_DIR="../dealhunter-tests"
ORIGINAL_DIR=$(pwd)

# Setup: Worktree erstellen oder verwenden
echo "=== Setting up Git Worktree ==="

# Prüfen ob wir im Hauptrepo sind
if [ ! -d ".git" ]; then
  echo "Error: Must be run from the main repository directory"
  exit 1
fi

# Branch erstellen falls nicht existiert
if ! git show-ref --verify --quiet refs/heads/$BRANCH; then
  echo "Creating branch $BRANCH from main..."
  git branch $BRANCH main
fi

# Worktree erstellen falls nicht existiert
if [ ! -d "$WORKTREE_DIR" ]; then
  echo "Creating worktree at $WORKTREE_DIR..."
  git worktree add "$WORKTREE_DIR" $BRANCH
else
  echo "Worktree already exists at $WORKTREE_DIR"
fi

# In Worktree wechseln
cd "$WORKTREE_DIR"
WORKTREE_FULL_PATH=$(pwd)
echo "Working in: $WORKTREE_FULL_PATH"

# Dependencies installieren falls nötig
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Sync mit main
echo "Syncing with main..."
git pull origin main --no-edit 2>/dev/null || true

echo ""

# Funktion für finalen Merge
merge_and_cleanup() {
  echo ""
  echo "=== Merging $BRANCH into main ==="
  cd "$ORIGINAL_DIR"
  git fetch . $BRANCH:$BRANCH 2>/dev/null || true
  git merge $BRANCH --no-edit -m "Merge $BRANCH: Add test coverage"
  echo "Tests merged into main."
  echo ""
  echo "To remove worktree:"
  echo "  git worktree remove $WORKTREE_DIR"
  echo "  git branch -d $BRANCH"
}

for ((i=1; i<=$1; i++)); do
  echo "=== Iteration $i of $1 (Test Coverage in Worktree) ==="

  # Sync mit main vor jeder Iteration
  git pull origin main --no-edit 2>/dev/null || true

  result=$(claude --dangerously-skip-permissions --settings ~/.claude/settings-glm.json -p "
  **TEST COVERAGE WORKFLOW:**

  Du arbeitest in einem Git Worktree auf Branch '$BRANCH'.
  Working Directory: $WORKTREE_FULL_PATH

  1. **Skill laden:** Invoke /vercel-react-best-practices für React/Next.js Testing Guidelines

  2. **Coverage analysieren:** Führe aus:
     npm run test:coverage 2>&1 | tail -50
     - Prüfe welche Dateien niedrige oder keine Coverage haben
     - Ignoriere node_modules/, tests/, *.d.ts, *.config.*, drizzle/

  3. **Untested Files finden:** Suche nach Dateien ohne Tests:
     - Prüfe lib/**/*.ts gegen lib/**/__tests__/*.test.ts
     - Priorität auf kritische Business-Logik:
       * lib/bids/ - Bid-Management
       * lib/extraction/ - RFP-Extraktion
       * lib/timeline/ - Timeline Agent
       * lib/bit-evaluation/ - Bid/No-Bid Evaluation
       * lib/cms-matching/ - CMS-Matching
       * lib/estimations/ - PT-Kalkulationen
       * lib/auth/ - Authentication
       * lib/utils/ - Utility-Funktionen

  4. **Test schreiben:** Wähle EINE Datei ohne Tests:
     - Erstelle __tests__/[filename].test.ts im gleichen Verzeichnis
     - Nutze Vitest Best Practices:
       * describe/it Blöcke
       * Mock externe Dependencies (DB, APIs, AI) mit vi.mock()
       * Teste Edge Cases und Error Handling
       * Mindestens 3-5 Test Cases pro Funktion

  5. **Tests ausführen:**
     npm run test:run 2>&1
     - Alle Tests müssen grün sein
     - Bei Fehlern: Fix anwenden und erneut testen

  6. **Progress Log:** Append zu progress.txt:
     - Datei die getestet wurde
     - Anzahl neuer Test Cases

  7. **Commit:** Wenn Tests grün:
     git add -A && git commit -m 'test: Add unit tests for [module-name]'

  **WICHTIGE REGELN:**
  - IMMER nur EINE Datei pro Iteration testen
  - IMMER Tests ausführen und grün machen vor Commit
  - Wenn alle kritischen Module getestet sind (>80% Coverage), output: <promise>COMPLETE</promise>
  ")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "=== Test coverage goal reached after $i iterations ==="
    merge_and_cleanup
    exit 0
  fi

  # Short pause between iterations to avoid rate limits
  sleep 2
done

echo ""
echo "=== Completed $1 iterations ==="
merge_and_cleanup
