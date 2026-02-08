# RALPH Step 3/4: Review (In Review)

## Board-Konstanten

```
PROJECT_NUMBER=4
PROJECT_OWNER=maphilipps
PROJECT_ID=PVT_kwHOAuMI6s4BNZnl
STATUS_FIELD_ID=PVTSSF_lAHOAuMI6s4BNZnlzg8Z_mo
STATUS_IN_REVIEW=df73e18b
```

## Arbeitskonventionen

- **Auf dem Issue-Branch arbeiten**: `ralph/<issue-number>-*` — checke den Branch aus
- **Alles auf dem Issue kommentieren** — Review-Findings werden als Kommentar gepostet
- Das Issue ist die Single Source of Truth für den gesamten Lifecycle

---

## Aufgabe

Führe ein Code-Review für das In-Review-Issue durch und poste die Ergebnisse.

### 1. In-Review-Issue finden

```bash
gh project item-list 4 --owner maphilipps --format json | jq '[.items[] | select(.status == "In review") | {id: .id, number: .content.number, title: .content.title, type: .content.type}]'
```

### 2. Issue-Branch auschecken

```bash
# Branch-Name aus Issue-Kommentaren oder git branch -r ermitteln
git fetch origin
git checkout ralph/$ISSUE_NUMBER-<kurzbeschreibung>
```

### 3. Issue lesen

```bash
gh issue view $ISSUE_NUMBER --json title,body,comments,labels
```

Verstehe was implementiert werden sollte — der Issue-Body und die Kommentare definieren die Anforderungen.

### 4. Diff prüfen

```bash
git diff main..HEAD --stat
git diff main..HEAD
```

Der Diff muss minimal sein — keine unrelated Changes, keine reinen Formatierungsänderungen, keine "while I'm here"-Verbesserungen.

### 5. Review durchführen

Nutze `/workflows:review` für ein Multi-Agent Code Review.

### 6. Ergebnisse posten

Poste die Review-Ergebnisse als Kommentar auf dem Issue:

```bash
gh issue comment $ISSUE_NUMBER --body "RALPH: Code Review complete.

<review findings or 'No findings — review passed.'>"
```

---

## STOPP

Behebe noch KEINE Findings. Deine einzige Aufgabe ist: Review durchführen und Ergebnisse posten.
