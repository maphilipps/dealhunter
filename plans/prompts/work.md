# RALPH Step 2/4: Work (Ready → In Progress → In Review)

## Board-Konstanten

```
PROJECT_NUMBER=4
PROJECT_OWNER=maphilipps
PROJECT_ID=PVT_kwHOAuMI6s4BNZnl
STATUS_FIELD_ID=PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo
STATUS_READY=61e4505c
STATUS_IN_PROGRESS=47fc9ee4
STATUS_IN_REVIEW=df73e18b
```

## Status ändern

```bash
ITEM_ID=$(gh project item-list 4 --owner maphilipps --format json | jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "STATUS_OPTION_ID"
```

---

## Aufgabe

Nimm ein Ready-Issue, implementiere es und schiebe es in Review.

### 1. Ready-Issue finden

```bash
gh project item-list 4 --owner maphilipps --format json | jq '[.items[] | select(.status == "Ready") | {id: .id, number: .content.number, title: .content.title, type: .content.type}]'
```

Priorisierung: P0 > P1 > P2, innerhalb gleicher Priorität niedrigere Issue-Nummern zuerst.

### 2. Status → In Progress

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "47fc9ee4"
gh issue comment $ISSUE_NUMBER --body "RALPH: Starting work on this issue."
```

### 3. Issue + Plan lesen

```bash
gh issue view $ISSUE_NUMBER --json title,body,comments,labels
```

1. Vollständiger Issue-Body — jede Zeile, Checkbox, Codeblock, Akzeptanzkriterien
2. **Alle Kommentare lesen** — neuere Kommentare haben Vorrang über ältere und über den Body
3. Der letzte RALPH-Kommentar enthält den Implementierungsplan — folge diesem Plan
4. Identifiziere betroffene Dateien — komplett lesen, nicht nur die relevante Funktion
5. Suche nach bestehenden Patterns — finde Code, der ähnliche Probleme löst
6. Prüfe CLAUDE.md für Projektkonventionen

### 4. Implementierung

Nutze `/workflows:work` um den Plan umzusetzen.

Bei Blockaden: `<promise>ABORT</promise>` — und setze das Issue zurück auf "Ready":

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "61e4505c"
gh issue comment $ISSUE_NUMBER --body "RALPH: Blocked — <reason>. Moving back to Ready."
```

Nach der ersten Implementierung: Ist das die einfachste mögliche Lösung? Wenn nicht, verwerfen und neu implementieren.

### 5. Checks

Vor dem Commit alle Checks durchlaufen:

```bash
npm run typecheck     # TypeScript
npm run test:run      # Vitest (single run, not watch)
npm run lint          # ESLint
npm run format:check  # Prettier (fix with npm run format)
```

Alle vier müssen bestehen.

### 6. Commit

Git-Commit erstellen. Die Commit-Message muss:

1. Mit `RALPH:` Prefix beginnen
2. Issue-Nummer referenzieren (`#<number>`)
3. Erledigte Aufgabe beschreiben
4. Getroffene Entscheidungen
5. Geänderte Dateien

Kurz halten.

### 7. Status → In Review

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "df73e18b"
gh issue comment $ISSUE_NUMBER --body "RALPH: Implementation complete. Commit: <sha>. Moving to review."
```

---

## STOPP

Führe KEIN Review durch. Deine Aufgabe endet nach dem Commit und der Transition nach In Review.
