# PRD: Pitchdeck-Assembly nach BID-Entscheidung

## Problem Statement

Nach einer positiven BID-Entscheidung (Status: `bid_voted` mit `blVote: 'BID'`) gibt es keinen strukturierten Prozess für die Pitchdeck-Erstellung. Die folgenden Aktivitäten müssen manuell koordiniert werden:

1. **Team-Zusammenstellung** - Wer ist Angebotsmanager, Solutions Lead, wer arbeitet zu? Aktuell keine automatische Zuweisung basierend auf Skills und Verfügbarkeit
2. **Deliverable-Tracking** - Was muss bis wann geliefert werden? Die aus dem RFP extrahierten `requiredDeliverables` haben keine internen Meilensteine
3. **Staffing-Koordination** - Mitarbeiter müssen manuell angefragt und eingeplant werden, ohne Sicht auf Verfügbarkeit
4. **Lösungs-Skizzierung** - Kein AI-gestützter Startpunkt für Angebotskapitel, Präsentationen oder technische Konzepte

Das führt zu:

- Verzögerungen beim Pitchdeck-Start (wer macht was?)
- Verpassten internen Deadlines (keine Rückwärtsplanung von RFP-Deadline)
- Redundanter Arbeit (Deep Scan Erkenntnisse werden nicht wiederverwendet)
- Stress kurz vor Abgabe (kein Frühwarnsystem für kritische Deadlines)

---

## Solution

Ein **Pitchdeck-Assembly Workflow**, der automatisch nach BID-Entscheidung startet:

### 1. Automatische Team-Zuweisung

- **Staffing Agent** matched Skills aus PT-Estimation mit verfügbaren Mitarbeitern (Employees-Tabelle)
- Rollen basierend auf Projekt-Anforderungen: PM, UX, Frontend, Backend, DevOps, QA
- BL muss Vorschläge bestätigen bevor Team informiert wird

### 2. Timeline-Berechnung

- Rückwärtsplanung von RFP-Deadline mit Puffern für Reviews
- Interne Meilensteine pro Deliverable
- Visuelle Warnung bei überschrittenen internen Deadlines (keine aktive Eskalation)

### 3. AI-gestützte Lösungs-Skizzen

- **Pitchdeck Agent** generiert pro Deliverable:
  - Strukturierte Gliederung (Kapitel, Kernpunkte)
  - Volltext-Entwurf als Startpunkt
  - Talking Points + Grafik-Ideen für Präsentationen
- Datenquellen: RAG (alle Agent-Outputs), Deep Scan, Web Research (Referenzen, Best Practices)
- Read-Only mit Regenerate-Option (kein Inline-Edit)

### 4. Neuer Lead-Tab "Pitchdeck"

- Erscheint nur bei Leads mit `blVote: 'BID'`
- Deliverable-Liste mit Status-Tracking (offen → in Arbeit → Review → fertig)
- Team-Übersicht mit Rollen und Kontaktdaten
- Timeline mit internen Meilensteinen

### 5. E-Mail-Benachrichtigungen

- Team-Mitglieder werden per E-Mail über Zuweisung informiert
- Link zur Lead-Seite mit Projektdetails und Deadlines

---

## Dependencies

- **DEA-138** (Lead Detail Page Redesign) - Navigation-Integration
- **DEA-148** (Staffing Timeline Gantt-Chart) - Wiederverwendung
- **DEA-109** (RAG-Integration) ✅ Done - Basis für Solution Agent

---

## Out of Scope

- Inline-Editing von Lösungs-Skizzen (Read-Only + Regenerate)
- Aktive Eskalation (nur visuelle Anzeige)
- Slack-Integration (nur E-Mail)
- Pitchdeck-Liste/Dashboard (nur Tab im Lead)
- Versionierung von Skizzen
- Kollaboration / Multi-User-Editing
- Export-Funktionen (PDF/Word)
