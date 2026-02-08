# RALPH Step 1/4: Plan (Backlog → Ready)

## Board-Konstanten

```
PROJECT_NUMBER=4
PROJECT_OWNER=maphilipps
PROJECT_ID=PVT_kwHOAuMI6s4BNZnl
STATUS_FIELD_ID=PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo
STATUS_BACKLOG=f75ad846
STATUS_READY=61e4505c
```

## Status ändern

```bash
ITEM_ID=$(gh project item-list 4 --owner maphilipps --format json | jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "STATUS_OPTION_ID"
```

---

## Aufgabe

Wähle ein Backlog-Issue, erstelle einen Implementierungsplan und schiebe es auf Ready.

### 1. Issue auswählen

Hole Backlog-Issues:

```bash
gh project item-list 4 --owner maphilipps --format json | jq '[.items[] | select(.status == "Backlog") | {id: .id, number: .content.number, title: .content.title, type: .content.type}]'
```

Falls kein Backlog-Issue existiert, prüfe offene Issues ohne Board-Status:

```bash
gh issue list --state open --json number,title,labels,body --limit 30
```

### Priorisierung

1. **P0** Issues zuerst (kritisch)
2. **P1** Issues (hoch)
3. **P2** Issues (normal)
4. Issues ohne Priority-Feld — behandle als P2

Innerhalb gleicher Priorität: niedrigere Issue-Nummern zuerst (ältere zuerst).

Überspringe Issues, die von anderen Issues abhängen (Body enthält "depends on #X", "blocked by #X", oder Sub-Issue-Abhängigkeiten).

Wenn alle Issues erledigt oder blockiert sind: `<promise>COMPLETE</promise>`

Du bekommst die letzten RALPH-Commits mitgeliefert. Prüfe diese um zu verstehen, welche Arbeit bereits erledigt wurde.

### 2. Issue vollständig lesen

```bash
gh issue view $ISSUE_NUMBER --json title,body,comments,labels
```

1. Vollständiger Issue-Body — jede Zeile, Checkbox, Codeblock, Akzeptanzkriterien
2. **Alle Kommentare lesen** — neuere Kommentare haben Vorrang über ältere und über den Body
3. Kommentare können Anforderungen ändern, präzisieren oder ergänzen
4. Identifiziere betroffene Dateien — komplett lesen
5. Suche nach bestehenden Patterns im Codebase
6. Prüfe CLAUDE.md für Projektkonventionen

### 3. Plan erstellen

Nutze `/workflows:plan` um einen Implementierungsplan zu erstellen.

### 4. Plan posten

```bash
gh issue comment $ISSUE_NUMBER --body "RALPH: Refinement complete. Implementation plan:

<plan summary>"
```

### 5. Status → Ready

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "61e4505c"
```

---

## STOPP

Implementiere noch NICHTS. Deine einzige Aufgabe ist: Issue auswählen, Plan erstellen, auf Ready setzen.
