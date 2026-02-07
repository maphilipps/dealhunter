# Feature-Gap-Analyse DealHunter

Stand: 2026-02-06

---

## Funktionierende Features

### Qualifications (Phase 1 — BD Manager)

- [x] **Lead erstellen** — `/qualifications/new` existiert mit UploadBidForm (PDF/Excel/Word/Freitext)
- [x] **Lead-Übersicht** — `/qualifications/[id]` mit Overview-Page
- [x] **Qualification Sidebar-Navigation** — `qualification-sidebar-right.tsx` mit dynamischen Sections basierend auf Data-Availability
- [x] **Lead-Liste** — `/qualifications` mit Übersichtsseite
- [x] **Budget-Seite** — `/qualifications/[id]/budget`
- [x] **Timing-Seite** — `/qualifications/[id]/timing`
- [x] **Verträge-Seite** — `/qualifications/[id]/contracts`
- [x] **Leistungsumfang-Seite** — `/qualifications/[id]/deliverables`
- [x] **Referenzen-Seite** — `/qualifications/[id]/references`
- [x] **Zuschlagskriterien** — `/qualifications/[id]/award-criteria`
- [x] **Angebotsstruktur** — `/qualifications/[id]/offer-structure`
- [x] **CMS Matrix** — `/qualifications/[id]/routing/cms-matrix`
- [x] **BID/NO-BID Routing** — `/qualifications/[id]/routing` (Entscheidung + Weiterleitung)
- [x] **Legal-Seite** — `/qualifications/[id]/legal`
- [x] **Tech-Seite** — `/qualifications/[id]/tech`
- [x] **Facts-Seite** — `/qualifications/[id]/facts` (inkl. Screenshot-Gallery)
- [x] **Kontakte-Seite** — `/qualifications/[id]/contacts`
- [x] **Error/Loading Boundaries** — error.tsx + loading.tsx vorhanden

### Pitches (Phase 2 — Business Line)

- [x] **Pitch-Übersicht** — `/pitches/[id]` mit Overview
- [x] **Pitch-Liste** — `/pitches`
- [x] **Audit Scan Hub** — `/pitches/[id]/audit-scan` mit Start-Funktion und Section-Rendering
- [x] **Audit Scan Subsections** — `/pitches/[id]/audit-scan/[sectionId]` (13 Phasen)
- [x] **Qualifications Scan** — `/pitches/[id]/qualifications-scan` (zeigt Quick-Scan-Daten vom Lead)
- [x] **adCalc** — `/pitches/[id]/calc-sheet` mit Features/Tasks/Roles/Risks Unterseiten
- [x] **BID/NO-BID Decision** — `/pitches/[id]/decision` mit Decision-Form
- [x] **Interview** — `/pitches/[id]/interview` mit Chat-Client
- [x] **RAG Data** — `/pitches/[id]/rag-data` (Debug-Ansicht)
- [x] **Estimation** — `/pitches/[id]/estimation`
- [x] **Website Audit** — `/pitches/[id]/website-audit`
- [x] **Staffing** — `/pitches/[id]/staffing`
- [x] **Pitchdeck** — `/pitches/[id]/pitchdeck`
- [x] **Error/Loading Boundaries** — error.tsx + loading.tsx vorhanden

### BL-Review

- [x] **BL-Review Übersicht** — `/bl-review` und `/bl-review/[id]`
- [x] **10-Questions Tab** — BU Matching + Ten Questions Tabs im Review
- [x] **BU Matching Tab** — Business Unit Zuordnung

### API-Routes

- [x] **Qualification APIs** — 22 Routes (extraction, evaluation, scan, deep-analysis, sections, visualization, etc.)
- [x] **Pitch APIs** — 30+ Routes (audit-scan, chat, progress, runs, sections, pitchdeck, documents, etc.)
- [x] **Qualifications Scan Export** — `/api/qualifications/[id]/qualifications-scan/export`
- [x] **Qualifications Scan Rescan** — `/api/qualifications/[id]/qualifications-scan/rescan`

---

## Teilweise funktionierende Features

- [~] **Navigation-Config vs. Seiten-Mismatch** — `navigation-config.ts` definiert `zusammenfassung` als Route, aber es existiert **keine** `/pitches/[id]/zusammenfassung/page.tsx`. Route führt zu 404.
- [~] **Pitch Summary** — `/pitches/[id]/summary` existiert als Seite, ist aber NICHT in der navigation-config referenziert. Orphan-Page ohne Navigation.
- [~] **Legacy Pitch-Seiten** — Folgende Seiten existieren im Dateisystem, sind aber NICHT mehr in der navigation-config:
  - `/pitches/[id]/technology` — Orphan
  - `/pitches/[id]/website-analysis/*` (4 Unterseiten) — Orphan
  - `/pitches/[id]/target-architecture/*` (5 Unterseiten) — Orphan
  - `/pitches/[id]/cms-comparison` — Orphan
  - `/pitches/[id]/hosting/*` (3 Unterseiten) — Orphan
  - `/pitches/[id]/integrations` — Orphan
  - `/pitches/[id]/migration/*` (3 Unterseiten) — Orphan
  - `/pitches/[id]/project-org/*` (3 Unterseiten) — Orphan
  - `/pitches/[id]/costs/*` (3 Unterseiten) — Orphan
  - `/pitches/[id]/legal` — Orphan
    → Diese waren vermutlich Teil der alten Pitch-Scan-Architektur und wurden durch den Audit Scan ersetzt, aber die Seiten wurden nicht gelöscht.
- [~] **Qualifications Sidebar** — Sidebar unter `/qualifications/[id]` zeigt nur Ausschreibungs-Sections (Budget, Timing, etc.) + CMS Matrix + Routing. **Kein Link** zum Qualifications Scan, Facts, Tech, Legal, Contacts — obwohl diese Seiten existieren. User muss URL manuell eingeben.

---

## Fehlende Features

- [ ] **Zusammenfassung-Seite** — In navigation-config definiert (`route: 'zusammenfassung'`), Seite fehlt. (Aufwand: **S**)
- [ ] **Qualifications Sidebar: Fehlende Navigation-Items** — Facts, Tech, Legal, Contacts existieren als Seiten aber sind nicht in der Sidebar. (Aufwand: **S**)
- [ ] **Pitch Dashboard: Keine KPI-Übersicht** — `/pitches` zeigt nur Liste, kein Dashboard mit Pipeline-Metriken. (Aufwand: **M**)
- [ ] **Lead-Scan Start von Qualifications** — Kein dedizierter "Scan starten" Button direkt in `/qualifications/[id]`. User muss über Background-Job API gehen. (Aufwand: **S**)
- [ ] **Audit-Scan Follow-up Chat** — API-Route `/api/pitches/[id]/audit-scan/chat` existiert, aber kein UI dafür sichtbar in der Audit-Scan-Seite. (Aufwand: **M**)
- [ ] **Export-Funktion für Scan-Ergebnisse** — API existiert (`qualifications-scan/export`), aber kein Export-Button in der UI. (Aufwand: **S**)
- [ ] **Rescan-Funktion im UI** — API existiert (`qualifications-scan/rescan`), aber kein Rescan-Button in der UI. (Aufwand: **S**)
- [ ] **Duplicate Check UI** — API existiert (`/api/qualifications/[id]/duplicate-check`), unklar ob UI vorhanden. (Aufwand: **S**)

---

## Broken Links / Tote Routen

| Route                                 | Problem                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `/pitches/[id]/zusammenfassung`       | In navigation-config definiert, Seite existiert nicht → **404** |
| `/pitches/[id]/summary`               | Seite existiert, aber kein Navigation-Link → **Orphan**         |
| `/pitches/[id]/technology`            | Legacy-Seite ohne Navigation → **Orphan**                       |
| `/pitches/[id]/website-analysis/*`    | 4 Legacy-Seiten ohne Navigation → **Orphan**                    |
| `/pitches/[id]/target-architecture/*` | 5 Legacy-Seiten ohne Navigation → **Orphan**                    |
| `/pitches/[id]/cms-comparison`        | Legacy-Seite ohne Navigation → **Orphan**                       |
| `/pitches/[id]/hosting/*`             | 3 Legacy-Seiten ohne Navigation → **Orphan**                    |
| `/pitches/[id]/integrations`          | Legacy-Seite ohne Navigation → **Orphan**                       |
| `/pitches/[id]/migration/*`           | 3 Legacy-Seiten ohne Navigation → **Orphan**                    |
| `/pitches/[id]/project-org/*`         | 3 Legacy-Seiten ohne Navigation → **Orphan**                    |
| `/pitches/[id]/costs/*`               | 3 Legacy-Seiten ohne Navigation → **Orphan**                    |
| `/pitches/[id]/legal`                 | Legacy-Seite ohne Navigation → **Orphan**                       |
| `/pitches/[id]/audit/[...slug]`       | Alte Audit-Route, unklar ob noch genutzt neben neuem audit-scan |

---

## Empfohlene Prioritäten für MVP

### P0 — Sofort fixen (broken)

1. **Zusammenfassung 404 beheben** — Entweder Seite erstellen oder Route aus navigation-config entfernen
2. **Qualifications Sidebar erweitern** — Facts, Tech, Legal, Contacts in Sidebar aufnehmen (Seiten existieren bereits!)

### P1 — Kurzfristig (User-Flows vervollständigen)

3. **Export-Button** in Qualifications-Scan-Ergebnis einbauen (API existiert)
4. **Rescan-Button** in Qualifications-Scan einbauen (API existiert)
5. **Legacy-Seiten aufräumen** — ~25 Orphan-Seiten unter `/pitches/[id]/` löschen oder entscheiden ob sie in die neue Audit-Scan-Navigation integriert werden

### P2 — Mittelfristig (UX-Verbesserungen)

6. **Audit-Scan Follow-up Chat** im UI verfügbar machen
7. **Scan-Start-Button** direkt auf Qualifications-Übersicht
8. **Summary-Seite** entweder in Navigation aufnehmen oder in Zusammenfassung umbenennen

### P3 — Nice-to-have

9. **Pipeline-Dashboard** für Pitches mit KPI-Metriken
10. **Duplicate-Check UI** sichtbar machen

---

## Zwei-Welten-Problem

Die App hat aktuell **zwei parallele Navigationsstrukturen**:

1. **Qualifications Sidebar** (`lib/qualifications/navigation.ts`) — Statische Items mit Data-Availability-Checks. Zeigt nur Ausschreibungs-Sections.
2. **Pitch/Lead Navigation** (`lib/pitches/navigation-config.ts`) — Dynamische Sections mit RAG-Query-Templates. Zeigt Audit-Scan-Sections.

Die Pitch-Navigation wird im `pitches/[id]/layout.tsx` über `LeadSidebarRight` gerendert und nutzt die `navigation-config.ts`. Die Qualification-Navigation nutzt eine **komplett andere** Konfiguration aus `lib/qualifications/navigation.ts`.

→ Empfehlung: Langfristig zu einer einheitlichen Navigation-Config zusammenführen.
