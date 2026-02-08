# RALPH Step 4/4: Fix (In Review → Done)

## Board-Konstanten

```
PROJECT_NUMBER=4
PROJECT_OWNER=maphilipps
PROJECT_ID=PVT_kwHOAuMI6s4BNZnl
STATUS_FIELD_ID=PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo
STATUS_IN_REVIEW=df73e18b
STATUS_DONE=98236657
```

## Status ändern

```bash
ITEM_ID=$(gh project item-list 4 --owner maphilipps --format json | jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "STATUS_OPTION_ID"
```

## Arbeitskonventionen

- **Auf dem Issue-Branch arbeiten**: `ralph/<issue-number>-*` — checke den Branch aus
- **Alles auf dem Issue kommentieren** — Fix-Fortschritt und Abschluss als Kommentar posten
- Das Issue ist die Single Source of Truth für den gesamten Lifecycle

---

## Aufgabe

Behebe alle Review-Findings und schließe das Issue ab.

### 1. In-Review-Issue finden

```bash
gh project item-list 4 --owner maphilipps --format json | jq '[.items[] | select(.status == "In review") | {id: .id, number: .content.number, title: .content.title, type: .content.type}]'
```

### 2. Issue-Branch auschecken

```bash
git fetch origin
git checkout ralph/$ISSUE_NUMBER-<kurzbeschreibung>
```

### 3. Review-Findings lesen

```bash
gh issue view $ISSUE_NUMBER --json title,body,comments,labels
```

Der letzte RALPH-Kommentar enthält die Review-Ergebnisse. Das sind die Findings, die behoben werden müssen.

### 4. Findings beheben

Wenn das Review Findings enthält:

1. Behebe **ALLE** Findings
2. Stelle sicher dass alle Checks bestehen:

```bash
npm run typecheck     # TypeScript
npm run test:run      # Vitest (single run, not watch)
npm run lint          # ESLint
npm run format:check  # Prettier (fix with npm run format)
```

3. Committe die Fixes:

Die Commit-Message muss:

- Mit `RALPH:` Prefix beginnen
- Issue-Nummer referenzieren (`#<number>`)
- "fix review findings" oder ähnlich beschreiben

4. Push die Fixes:

```bash
git push
```

Wenn das Review keine Findings hat ("review passed"), überspringe diesen Schritt.

### 5. Status → Done

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "98236657"
gh issue close $ISSUE_NUMBER --comment "RALPH: Resolved in commit <sha>. Branch: \`ralph/$ISSUE_NUMBER-<kurzbeschreibung>\`. Review passed."
```
