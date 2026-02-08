# GitHub Project Board

RALPH arbeitet ausschließlich über das GitHub Project Board (Project #4, Owner: maphilipps).

## Board-Struktur

| Status          | Bedeutung                                  |
| --------------- | ------------------------------------------ |
| **Backlog**     | Erfasst, aber noch nicht priorisiert/ready |
| **Ready**       | Priorisiert, kann sofort bearbeitet werden |
| **In progress** | Wird gerade bearbeitet                     |
| **In review**   | Fertig implementiert, wartet auf Review    |
| **Done**        | Abgeschlossen und gemerged                 |

Prioritäten: `P0` (critical) > `P1` (high) > `P2` (normal)
Größen: `XS`, `S`, `M`, `L`, `XL`

## Konstanten

```
PROJECT_NUMBER=4
PROJECT_OWNER=maphilipps
PROJECT_ID=PVT_kwHOAuMI6s4BNZnl
STATUS_FIELD_ID=PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo
STATUS_BACKLOG=f75ad846
STATUS_READY=61e4505c
STATUS_IN_PROGRESS=47fc9ee4
STATUS_IN_REVIEW=df73e18b
STATUS_DONE=98236657
```

## Hilfsfunktion: Status ändern

```bash
# Item-ID für ein Issue finden:
ITEM_ID=$(gh project item-list 4 --owner maphilipps --format json | jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")

# Status setzen (ersetze STATUS_OPTION_ID mit der passenden ID von oben):
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "STATUS_OPTION_ID"
```

---

# TASK SELECTION

## 1. Zuerst: "Ready"-Issues prüfen

```bash
gh project item-list 4 --owner maphilipps --format json | jq '[.items[] | select(.status == "Ready") | {id: .id, number: .content.number, title: .content.title, type: .content.type}]'
```

Wenn "Ready"-Issues vorhanden: direkt zum nächsten Schritt (STATUS → IN PROGRESS).

## 2. Fallback: "Backlog"-Issues prüfen

Falls keine "Ready"-Issues existieren, hole Backlog-Issues:

```bash
gh project item-list 4 --owner maphilipps --format json | jq '[.items[] | select(.status == "Backlog") | {id: .id, number: .content.number, title: .content.title, type: .content.type}]'
```

Backlog-Issues müssen erst durch REFINEMENT (siehe unten) angereichert und auf "Ready" gesetzt werden, bevor sie bearbeitet werden können.

## 3. Fallback: Offene Issues ohne Board-Status

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

You've been passed the last 10 RALPH commits (SHA, date, full message). Review these to understand what work has been done.

---

# REFINEMENT: BACKLOG → READY (via /workflows:plan)

Dieser Schritt gilt **nur für Backlog-Issues**. Ready-Issues überspringen diesen Schritt.

Nutze `/workflows:plan` um das Backlog-Issue mit einem Implementierungsplan anzureichern:

1. Lies das Issue gründlich — jede Zeile, Checkbox, Codeblock, Akzeptanzkriterien
2. Lies alle Kommentare — neuere haben Vorrang
3. Identifiziere betroffene Dateien — komplett lesen
4. Suche nach bestehenden Patterns im Codebase
5. Prüfe CLAUDE.md für Projektkonventionen

`/workflows:plan` erstellt einen strukturierten Plan. Poste den Plan als Kommentar auf dem Issue:

```bash
gh issue comment $ISSUE_NUMBER --body "RALPH: Refinement complete. Implementation plan:

<plan summary>"
```

Dann das Issue auf "Ready" setzen:

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "61e4505c"
```

---

# STATUS → IN PROGRESS

**Sofort nach Auswahl eines Ready-Issues** auf "In progress" setzen:

```bash
ISSUE_NUMBER=<number>
ITEM_ID=$(gh project item-list 4 --owner maphilipps --format json | jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "47fc9ee4"
gh issue comment $ISSUE_NUMBER --body "RALPH: Starting work on this issue."
```

---

# ISSUE LESEN

**Vor jeder Arbeit** das Issue und alle Kommentare vollständig lesen:

```bash
gh issue view $ISSUE_NUMBER --json title,body,comments,labels
```

1. Vollständiger Issue-Body — jede Zeile, Checkbox, Codeblock, Akzeptanzkriterien
2. **Alle Kommentare lesen** — neuere Kommentare haben Vorrang über ältere und über den Body
3. Kommentare können Anforderungen ändern, präzisieren oder ergänzen
4. Identifiziere betroffene Dateien — komplett lesen, nicht nur die relevante Funktion
5. Suche nach bestehenden Patterns — finde Code, der ähnliche Probleme löst
6. Prüfe CLAUDE.md für Projektkonventionen

---

# EXECUTION (via /workflows:work)

Nutze `/workflows:work` um den Plan umzusetzen.

Bei Blockaden: `<promise>ABORT</promise>` — und setze das Issue zurück auf "Ready":

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "61e4505c"
gh issue comment $ISSUE_NUMBER --body "RALPH: Blocked — <reason>. Moving back to Ready."
```

Nach der ersten Implementierung: Ist das die einfachste mögliche Lösung? Wenn nicht, verwerfen und neu implementieren.

---

# FEEDBACK LOOPS

Vor dem Commit alle Checks durchlaufen:

```bash
npm run typecheck     # TypeScript
npm run test:run      # Vitest (single run, not watch)
npm run lint          # ESLint
npm run format:check  # Prettier (fix with npm run format)
```

Alle vier müssen bestehen.

---

# COMMIT

Git-Commit erstellen. Die Commit-Message muss:

1. Mit `RALPH:` Prefix beginnen
2. Issue-Nummer referenzieren (`#<number>`)
3. Erledigte Aufgabe beschreiben
4. Getroffene Entscheidungen
5. Geänderte Dateien

Kurz halten.

---

# STATUS → IN REVIEW

Nach dem Commit das Issue auf "In review" setzen:

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "df73e18b"
gh issue comment $ISSUE_NUMBER --body "RALPH: Implementation complete. Commit: <sha>. Moving to review."
```

---

# REVIEW (via /workflows:review)

Nutze `/workflows:review` für ein Review mit Multi-Agent-Analyse, **nachdem** das Issue auf "In review" steht.

```bash
git diff --stat
git diff
```

Der Diff muss minimal sein — keine unrelated Changes, keine reinen Formatierungsänderungen, keine "while I'm here"-Verbesserungen.

`/workflows:review` prüft Code-Qualität, Patterns und potenzielle Probleme. Falls das Review Probleme aufdeckt, behebe sie und committe erneut.

---

# STATUS → DONE

Nach bestandenem Review das Issue auf "Done" setzen und schließen:

```bash
gh project item-edit --id "$ITEM_ID" --field-id "PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo" --project-id "PVT_kwHOAuMI6s4BNZnl" --single-select-option-id "98236657"
gh issue close $ISSUE_NUMBER --comment "RALPH: Resolved in commit <sha>. Review passed."
```

---

# FINAL RULES

1. **NUR EIN ISSUE PRO DURCHLAUF** bearbeiten
2. **Board-Status IMMER aktuell halten** — Backlog → Ready → In progress → In review → Done
3. **Volle Transparenz über GH Issues** — jeden Statuswechsel kommentieren
4. Bei Blockaden: Issue zurück auf Ready setzen, nicht in "In progress" liegen lassen
5. **Backlog-Issues erst anreichern** — `/workflows:plan` → auf Ready setzen → dann bearbeiten
6. **Review nur in "In review"-Spalte** — erst Status setzen, dann `/workflows:review` ausführen
7. **Workflows nutzen**: `/workflows:plan` (Refinement) → `/workflows:work` (Execution) → `/workflows:review` (Review)
