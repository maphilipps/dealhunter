# Product Audit — Browser-basierte Code-Analyse

**Datum**: 2026-02-06
**Methode**: Code-Review aller Page-Komponenten, Sidebar, Breadcrumbs, Navigation
**Hinweis**: Kein direkter Browser-Zugang (MCP Browser-Tools nicht verfügbar), daher statische Code-Analyse.

---

## Seite: / (Dashboard / Root)

**Code**: `app/(dashboard)/page.tsx`
**Verhalten**: Redirect zu `/qualifications`

**Probleme**:

- [x] Kein eigenständiges Dashboard — Root redirected direkt zu /qualifications (Severity: LOW)

**Naming-Issues**: Keine

---

## Seite: /qualifications (Leads-Übersicht)

**Code**: `app/(dashboard)/qualifications/page.tsx`
**Funktion**: Listet `getBids()` Daten auf — das sind die Pre-Qualification/Lead-Daten aus der `preQualifications` Tabelle.

**Probleme**:

- [ ] **Funktion heißt `BidsPage` statt `LeadsPage` oder `QualificationsPage`** — interner Funktionsname passt nicht zum Route-Pfad (Severity: LOW)
- [ ] **Interface heißt `PreQualificationsPageProps`** — Naming-Mix (Severity: LOW)
- [ ] **"Neuer Lead" Button ist vorhanden** (Zeile 55-60) und linkt korrekt zu `/qualifications/new` — KEIN Problem, entgegen User-Meldung. Möglicherweise war Button vorher nicht sichtbar aufgrund eines Rendering-Fehlers (Severity: INFO)
- [ ] **`DeleteQualificationButton` hat Prop `preQualificationId`** — inkonsistentes Naming (Severity: LOW)
- [ ] **Stage-Mapping zeigt "Lead" für `pre-qualification`** — eventuell verwirrend: Stage `pre-qualification` wird als "Lead" angezeigt (Severity: MEDIUM)

**Naming-Issues**:

- Aktuell: Funktionsname `BidsPage` → Sollte: `QualificationsPage` oder `LeadsPage`
- Aktuell: `PreQualificationsPageProps` → Sollte: `QualificationsPageProps`
- Aktuell: `getBids()` → Daten kommen aber korrekt aus preQualifications-Tabelle

**Daten**: Korrekt — `getBids()` holt Daten aus der preQualifications-Tabelle. **KEIN** Problem mit falschen Daten.

---

## Seite: /qualifications/new (Neuen Lead erstellen)

**Code**: `app/(dashboard)/qualifications/new/page.tsx`

**Probleme**:

- [ ] Funktionsname `NewBidPage` statt `NewLeadPage` (Severity: LOW)
- [ ] Titel "Neuer Lead" ist korrekt
- [ ] Nutzt `UploadBidForm` — Komponenten-Name passt nicht zum neuen Naming (Severity: LOW)

**Naming-Issues**:

- Aktuell: `NewBidPage` → Sollte: `NewQualificationPage` oder `NewLeadPage`
- Aktuell: `UploadBidForm` → Sollte: `UploadLeadForm` oder `UploadQualificationForm`

---

## Seite: /qualifications/[id] (Lead Detail-Übersicht)

**Code**: `app/(dashboard)/qualifications/[id]/page.tsx`

**Probleme**:

- [ ] Titel zeigt `summary?.headline || 'Lead Übersicht'` — korrekt (Severity: NONE)
- [ ] Nutzt `getCachedPreQualificationWithRelations` — korrekte Datenquelle
- [ ] `ExportButton` und `DashboardPDFExport` vorhanden

**Naming-Issues**: Keine wesentlichen auf dieser Seite.

---

## Seite: /qualifications/[id] Layout (Sidebar-Navigation)

**Code**: `app/(dashboard)/qualifications/[id]/layout.tsx`

**Probleme**:

- [ ] **Kein Subsection-Routing gefunden** — `app/(dashboard)/qualifications/[id]/*/page.tsx` Glob findet KEINE Dateien! (Severity: HIGH)
  - Es gibt keine Subsection-Seiten unter `/qualifications/[id]/` wie z.B. `/qualifications/[id]/facts`, `/qualifications/[id]/tech` etc.
  - Die rechte Sidebar (`PreQualificationSidebarRight`) zeigt Navigation-Items an, die vermutlich zu nicht-existenten Routen führen
- [ ] Sidebar-Label sagt "Lead Details" (Zeile 50) — OK
- [ ] Layout-Funktionsname `PreQualificationDashboardLayout` — altes Naming (Severity: LOW)

**Naming-Issues**:

- Aktuell: `PreQualificationDashboardLayout` → Sollte: `QualificationDetailLayout`

---

## Seite: /pitches (Pitches-Übersicht)

**Code**: `app/(dashboard)/pitches/page.tsx`

**Probleme**:

- [ ] **Titel sagt "Qualifications"** statt "Pitches" (Severity: HIGH) — Zeile 43: `<h1>Qualifications</h1>`
- [ ] **Beschreibung sagt "Qualifications aus dem Pre-Qualification-Qualifizierungsprozess"** — Totaler Naming-Salat (Severity: HIGH)
- [ ] **Funktionsname ist `QualificationsPage`** obwohl es die Pitches-Route ist (Severity: HIGH)
- [ ] **Import: `DeleteQualificationButton` von `pitches/delete-pitch-button`** — Alias-Verwirrung (Severity: MEDIUM)
- [ ] **Import: `QualificationsEmptyStateClient` von `pitches/pitches-empty-state-client`** — Naming-Mix (Severity: MEDIUM)
- [ ] **Card-Titel: "Alle Qualifications"** statt "Alle Pitches" (Severity: HIGH)
- [ ] **Links gehen zu `/pitches/${lead.id}`** — korrekt für Pitches-Seite
- [ ] BD-User werden zu `/qualifications` weitergeleitet — korrektes Verhalten
- [ ] **Tabelle zeigt `getLeads()` Daten** — Datenquelle heißt `getLeads` statt `getPitches` (Severity: MEDIUM)

**Naming-Issues**:

- Aktuell: Page Title "Qualifications" → Sollte: "Pitches"
- Aktuell: Beschreibung "Qualifications aus dem Pre-Qualification-Qualifizierungsprozess" → Sollte: "Pitches für Ihre Business Unit"
- Aktuell: Funktionsname `QualificationsPage` → Sollte: `PitchesPage`
- Aktuell: "Alle Qualifications" → Sollte: "Alle Pitches"
- Aktuell: "Klicken Sie auf eine Qualification" → Sollte: "Klicken Sie auf einen Pitch"

---

## Seite: /accounts/[id] (Account Detail)

**Code**: `app/(dashboard)/accounts/[id]/page.tsx`

**Probleme**:

- [ ] Opportunities verlinken zu `/qualifications/${opp.id}` — korrekt (Severity: NONE)
- [ ] Stage-Map hat noch `preQualification: 'Pre-Qualification'` — altes Label (Severity: LOW)

**Naming-Issues**: Keine wesentlichen.

---

## Seite: /bl-review (BL Review)

**Code**: `app/(dashboard)/bl-review/page.tsx`

**Probleme**:

- [ ] **Titel: "BL Review"** — korrekt
- [ ] **Beschreibung: "Prüfen und genehmigen Sie Pre-Qualifications für Ihren Bereich"** — sollte "Leads" oder "Qualifications" sagen (Severity: MEDIUM)
- [ ] **Card-Labels verwenden durchgängig "Pre-Qualifications"** (Zeilen 119, 162, 221-222, 285, 288) (Severity: HIGH)
  - "Pre-Qualifications warten auf Review"
  - "Zu prüfende Pre-Qualifications"
  - "Weitere Pre-Qualifications"
  - "Keine Pre-Qualifications zugewiesen"
  - "Es wurden noch keine Pre-Qualifications an Ihren Bereich weitergeleitet"

**Naming-Issues**:

- Aktuell: "Pre-Qualifications" (überall) → Sollte: "Leads" oder "Qualifications"
- Aktuell: Variablen heißen `assignedBids`, `bid` → Sollte: `assignedLeads`, `lead`

---

## Sidebar-Navigation

**Code**: `components/app-sidebar.tsx`

**Probleme**:

- [ ] Sidebar zeigt "Leads" für `/qualifications` und "Pitches" für `/pitches` — **Inkonsistenz**: Sidebar sagt "Leads" aber Route/Breadcrumb sagt "Qualifications" (Severity: HIGH)

**Naming-Issues**:

- Sidebar: "Leads" → Route: `/qualifications` → Breadcrumb: "Qualifications" → Page Title: "Leads" — **3 verschiedene Begriffe für dieselbe Sache!**

---

## Breadcrumbs

**Code**: `components/dynamic-breadcrumb.tsx`

**Probleme**:

- [ ] `qualifications: 'Qualifications'` — Breadcrumb sagt "Qualifications" (Severity: MEDIUM)
- [ ] `bids: 'Leads'` — Alter Route-Pfad hat noch ein Mapping (Severity: LOW)
- [ ] Root-Breadcrumb zeigt "Leads" (Zeile 53) — bei `/` wird "Leads" angezeigt

**Naming-Issues**:

- Breadcrumb für /qualifications zeigt "Qualifications" — Sidebar sagt "Leads" — Page-Title sagt "Leads"

---

## Zusammenfassung der Schwerwiegendsten Probleme

### CRITICAL / HIGH

| #   | Problem                                                                                      | Seite                | Severity |
| --- | -------------------------------------------------------------------------------------------- | -------------------- | -------- |
| 1   | **Pitches-Seite zeigt "Qualifications" als Titel und überall im Text**                       | /pitches             | HIGH     |
| 2   | **Keine Subsection-Routen unter /qualifications/[id]/** — Sidebar-Navigation führt ins Leere | /qualifications/[id] | HIGH     |
| 3   | **BL-Review nutzt überall "Pre-Qualifications" statt "Leads"**                               | /bl-review           | HIGH     |
| 4   | **Naming-Chaos: Sidebar="Leads", Breadcrumb="Qualifications", Route="/qualifications"**      | Global               | HIGH     |

### MEDIUM

| #   | Problem                                             | Seite           | Severity |
| --- | --------------------------------------------------- | --------------- | -------- |
| 5   | Stage `pre-qualification` wird als "Lead" angezeigt | /qualifications | MEDIUM   |
| 6   | Delete-Button Props heißen `preQualificationId`     | /qualifications | MEDIUM   |
| 7   | `getLeads()` für Pitches statt `getPitches()`       | /pitches        | MEDIUM   |

### LOW

| #   | Problem                                                             | Seite               | Severity |
| --- | ------------------------------------------------------------------- | ------------------- | -------- |
| 8   | Diverse Funktionsnamen (BidsPage, NewBidPage) passen nicht zum Pfad | Mehrere             | LOW      |
| 9   | Interface-Namen inkonsistent (PreQualificationsPageProps)           | /qualifications     | LOW      |
| 10  | UploadBidForm Komponentenname                                       | /qualifications/new | LOW      |

---

## Empfehlung: Einheitliches Naming

**Empfohlene Terminologie:**

- **Leads** = Pre-Qualifications / Qualifications (BD-Workflow) → Route: `/qualifications` oder besser `/leads`
- **Pitches** = Weitergeleitete Leads für BL-Workflow → Route: `/pitches`

**Konkreter Vorschlag:** Entweder

1. Route `/qualifications` → `/leads` umbenennen und überall "Leads" verwenden, ODER
2. Überall konsistent "Qualifications" verwenden (Sidebar, Breadcrumb, Page Title)

Aktuell ist es ein Mix aus beidem, was sehr verwirrend ist.
