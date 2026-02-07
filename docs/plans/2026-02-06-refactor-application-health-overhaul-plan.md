---
title: 'refactor: Application Health Overhaul'
type: refactor
date: 2026-02-06
source: docs/brainstorms/2026-02-06-application-health-brainstorm.md
---

# refactor: Application Health Overhaul

## Overview

Umfassende Bereinigung und Modernisierung der DealHunter-Anwendung in 4 Phasen: Cleanup/Rename-Abschluss, Agent-Native Architecture, UI-Vereinheitlichung und Best-Practices-Audits. 14 Issues, priorisiert nach Abhängigkeiten.

## Problem Statement

Die Anwendung hat durch schnelles Feature-Building technische Schulden angesammelt:

- **Inkonsistente Benennung**: `pre-qualification` vs. `qualification` vs. `lead` — DB-Tabelle heißt `pre_qualifications`, Routes heißen `/qualifications/`, Agent-Tools heißen `preQualification.*`
- **201+ stale Referenzen** auf alte Naming-Patterns
- **Admin-Configs** die Agenten übernehmen sollten (BIT Weights, CMS Scoring, Routing)
- **Unvollständiger Export** (kein echtes PDF, kein Excel)
- **Scan-spezifische UI** statt generischer Agent-Activity-Ansicht
- **8% Tool-Naming Anti-Patterns** (camelCase statt snake_case)

## Architektur-Entscheidungen

### E1: Naming-Entscheidung

**Entscheidung:** Die DB-Tabelle `pre_qualifications` bleibt als `pre_qualifications`. Keine weitere DB-Rename-Migration. Drizzle-Export bleibt `preQualifications`.

**Begründung:** Die Tabelle wurde erst kürzlich von `rfps` → `pre_qualifications` umbenannt (Migration 0005). Ein erneutes Rename auf `qualifications` würde 323+ Referenzen in Agent-Tools allein betreffen und ist unverhältnismäßig. Die URL-Routes (`/qualifications/`) und Komponenten-Ordner (`components/qualifications/`) bleiben wie sie sind — das ist die benutzerfreundliche Kurzform.

**Konvention:** DB/Code = `preQualification(s)`, URL/UI = `qualification(s)`.

### E2: Admin-Config-Strategie

**Entscheidung:** Die `configs` DB-Tabelle bleibt. Agent-Tools werden für CRUD auf Configs erstellt. Das Admin-UI wird vorerst beibehalten aber als "Advanced" markiert. Agenten können Configs lesen und Empfehlungen machen, aber nicht eigenständig ändern.

**Begründung:** Unkontrolliertes Selbst-Tuning von Scoring-Weights ist gefährlich. Human-in-the-Loop bleibt Pflicht für Business-Rules.

### E3: Export-Strategie

**Entscheidung:** Echte PDF-Generierung via `@react-pdf/renderer` oder Puppeteer. Excel via `exceljs`. Scope: Qualification-Scan-Ergebnisse (nicht Audit-Scan, das kommt später).

---

## Implementation Phases

### Phase 1: Foundation Cleanup (Issues 9, 10, 12, 1, 11)

**Ziel:** Saubere Codebasis als Grundlage für alles Weitere.

#### Task 1.1: Korrupte Dateien löschen (Issue 9)

- Löschen: `app/(dashboard)/master-data/competitors/new/.!33150!page.tsx`
- Löschen: `app/(dashboard)/master-data/competitors/new/.!33408!page.tsx`
- Verifizieren: `page.tsx` in diesem Verzeichnis existiert und ist korrekt

#### Task 1.2: Backup-Dateien löschen (Issue 10)

- Status: **Bereits erledigt** — `section-page-template.tsx.backup` ist nicht mehr auf Disk
- Verifizieren: Kein `.backup` oder `.bak` File im Repo

#### Task 1.3: Dead-File-Referenzen bereinigen (Issue 12)

- Deprecated Aliases entfernen aus `lib/db/schema.ts`:
  - `export const leadScans = qualificationScans;` (Zeile ~660)
  - `export const quickScans = qualificationScans;` (Alias)
  - `'quick-scan'` aus Enum-Kommentar
- Deprecated Aliases entfernen aus `lib/json-render/qualifications-scan-catalog.ts`:
  - `export const quickScanCatalogSchema = ...`
  - `export const quickScanComponentDescriptions = ...`
- TypeScript-Fehler die dadurch entstehen fixen (stale Imports aufdecken)
- Obsolete Test-Datei prüfen: `tests/e2e/quick-scan.spec.ts`
- `npx tsc --noEmit` muss clean sein

#### Task 1.4: Rename-Konsistenz verifizieren (Issue 1/11)

**Vorbedingung:** Task 1.3 (Aliases entfernt → TypeScript deckt stale Refs auf)

- Agent-Tool-File `lib/agent-tools/tools/pre-qualification.ts`:
  - Exports bleiben `preQualification.*` (folgt DB-Naming)
  - Prüfen ob alle Tools korrekt registriert sind
- Agent-Tool-File `lib/agent-tools/tools/qualification.ts`:
  - Prüfen ob Duplikate mit `pre-qualification.ts` existieren → konsolidieren
- API-Routes unter `app/api/qualifications/` prüfen:
  - Alle Imports zeigen auf existierende Module
  - Kein Import auf gelöschte `pre-qualifications/` Pfade
- Komponenten unter `components/qualifications/` prüfen:
  - Alle Imports korrekt
- `app/api/qualifications/[id]/quick-scan/stream/route.ts`:
  - Import von `leadScans` → `qualificationScans` fixen
- Middleware-Redirects verifizieren
- `npx tsc --noEmit` + `npm test` + `next build` müssen clean sein

#### Task 1.5: Tool-Naming Anti-Patterns fixen

- Referenz: `docs/agent-tool-naming-audit.md`
- camelCase → snake_case für Multi-Word-Operations:
  - `notification.sendTeamAlert` → `notification.send_team_alert`
  - `notification.scheduleReminder` → `notification.schedule_reminder`
  - `analysis.getCmsMatch` → `analysis.get_cms_match`
  - `analysis.getPtEstimation` → `analysis.get_pt_estimation`
  - etc. (8% der 153 Tools)
- Deprecated Tools mit `@deprecated` JSDoc markieren

**Akzeptanzkriterien Phase 1:**

- [ ] `npx tsc --noEmit` — 0 Errors
- [ ] `npm test` — alle Tests grün
- [ ] `next build` — Build erfolgreich
- [ ] Keine `.backup`, `.bak`, `.!*!` Dateien im Repo
- [ ] Keine Imports auf gelöschte Pfade
- [ ] Tool-Naming 100% konform mit CLAUDE.md

---

### Phase 2: Agent-Native Architecture (Issues 8, 5, 4)

**Ziel:** Jede UI-Aktion hat ein Agent-Äquivalent.

#### Task 2.1: UI-zu-Agent Paritäts-Matrix erstellen (Issue 8)

Dokumentation in `docs/agent-native-parity-matrix.md`:

| UI Action           | Route/Component                | Agent Tool                            | Status |
| ------------------- | ------------------------------ | ------------------------------------- | ------ |
| Upload Bid          | `upload-bid-form.tsx`          | `preQualification.createFromFreetext` | ✅     |
| List Qualifications | `qualifications/page.tsx`      | `preQualification.list`               | ✅     |
| View Detail         | `qualifications/[id]/page.tsx` | `preQualification.get`                | ✅     |
| Make Decision       | `decision-form.tsx`            | `preQualification.makeDecision`       | ✅     |
| Route to BU         | `routing-form.tsx`             | `preQualification.route`              | ✅     |
| Start Qual-Scan     | Auto-trigger                   | `qualificationsScan.start`            | ✅     |
| Start Audit-Scan    | Button                         | `auditScan.start`                     | ✅     |
| Export Results      | `export-button.tsx`            | —                                     | ❌ NEU |
| Edit Config         | `/admin/configs`               | —                                     | ❌ NEU |
| View Progress       | SSE endpoint                   | —                                     | ❌ NEU |

#### Task 2.2: Fehlende Agent-Tools erstellen

Neue Tools (folgt CLAUDE.md Naming):

- `qualificationsScan.export` — Export als Word/PDF/Excel
- `config.list` — Alle Configs auflisten
- `config.get` — Config nach Key lesen
- `config.update` — Config-Wert ändern (mit Validierung)
- `progress.get` — Scan-Progress abfragen

Datei: `lib/agent-tools/tools/config.ts`, `lib/agent-tools/tools/export.ts`

#### Task 2.3: Technology Self-Maintenance (Issue 4)

Neue Tools:

- `technology.discover_features` — Web-Recherche für Features einer Technologie
- `technology.update_version` — Aktuelle Version + EOL-Daten aktualisieren
- `technology.check_eol` — EOL-Status prüfen

Scheduled Job (Inngest):

- Wöchentlicher Cron: `technology.auto_discovery` — iteriert über alle Technologies, ruft `discover_features` + `update_version` auf

Datei: `lib/inngest/functions/technology-maintenance.ts`

#### Task 2.4: Admin-Config UI als "Advanced" markieren (Issue 5)

- Navigation: `/admin/configs` → unter "Advanced Settings" gruppieren
- Sidebar: Warnung "Agenten nutzen diese Werte. Änderungen wirken sich auf Scoring aus."
- Config-Tools (Task 2.2) ermöglichen Read-Access für Agenten
- Audit-Trail für Config-Änderungen (wer, wann, alter/neuer Wert)

**Akzeptanzkriterien Phase 2:**

- [ ] Paritäts-Matrix dokumentiert und vollständig
- [ ] Alle fehlenden Agent-Tools implementiert
- [ ] Technology-Maintenance Inngest-Job konfiguriert
- [ ] Admin-Configs mit "Advanced" Badge und Audit-Trail
- [ ] `npx tsc --noEmit` + `npm test` clean

---

### Phase 3: UI & Visualisierung (Issues 2, 3, 6, 7)

**Ziel:** Einheitliche Agent-Activity-UI, vollständige JSON-Render-Registry, Export.

#### Task 3.1: Agent Activity UI generalisieren (Issue 2)

**Problem:** `AgentActivityView` ist auf `QualificationsScanPhase` getypt.

**Lösung:**

- Generisches `AgentPhase` Interface extrahieren aus `QualificationsScanPhase` und `AuditScanPhase`
- `AgentActivityView` refactoren: generische Props statt scan-spezifisch
- 4 Tabs: Queue, Reasoning, Tasks, Tools
- Wiederverwendbar für: Qualification-Scan, Audit-Scan, BIT-Evaluation, CMS-Matching

Dateien:

- `components/ai-elements/types.ts` — generische Phase/Event Types
- `components/ai-elements/agent-activity-view.tsx` — Refactoring
- `components/ai-elements/tabs/queue-tab.tsx`
- `components/ai-elements/tabs/reasoning-tab.tsx`
- `components/ai-elements/tabs/tasks-tab.tsx`
- `components/ai-elements/tabs/tools-tab.tsx`

#### Task 3.2: JSON Render Registry vervollständigen (Issue 3)

- Bestandsaufnahme: Welche Sections haben keine Render-Komponente?
- `components/json-render/qualifications-scan-registry.tsx` prüfen und ergänzen
- Alle Scan-Result-Typen müssen eine visuelle Darstellung haben
- Einheitliches Design über alle Komponenten

#### Task 3.3: Export implementieren (Issue 7)

**Word (.docx):** Bestehend, prüfen und verbessern

- `lib/qualifications-scan/export/markdown-builder.ts` → Vollständigkeit aller Sections

**PDF:** Echte PDF-Generierung

- Package: `@react-pdf/renderer` oder Puppeteer-basiert
- API-Route: `app/api/qualifications/[id]/qualifications-scan/export/route.ts` erweitern
- Format-Parameter: `?format=pdf|docx|xlsx`

**Excel (.xlsx):**

- Package: `exceljs`
- Tabular-Aufbereitung der Scan-Ergebnisse
- Sheets: Zusammenfassung, Technologie-Analyse, Content-Analyse, Empfehlungen

Agent-Tool: `qualificationsScan.export` (aus Task 2.2)

#### Task 3.4: UX Quick-Wins (Issue 6)

- Empty States für alle Listen-Seiten prüfen
- Konsistente Loading-States (Skeleton statt Spinner)
- Breadcrumbs überall korrekt
- Mobile Responsiveness Spot-Check

**Akzeptanzkriterien Phase 3:**

- [ ] Agent Activity View funktioniert für alle Scan-Typen
- [ ] JSON Render Registry vollständig
- [ ] Export: Word, PDF (echt), Excel funktionieren
- [ ] UX Quick-Wins umgesetzt
- [ ] `npx tsc --noEmit` + `npm test` clean

---

### Phase 4: Best Practices Audits (Issues 13, 14)

**Ziel:** Code entspricht AI SDK und Vercel React Standards.

#### Task 4.1: AI SDK Best Practices Audit (Issue 13)

Skill: `/ai-sdk`

Prüfen:

- `streamText` / `generateText` korrekt eingesetzt?
- Structured Outputs (`generateObject`) statt manuelles JSON-Parsing?
- Tool-Calling Patterns aktuell (AI SDK v5)?
- Error Handling nach SDK-Patterns?
- `maxSteps` für Agent-Loops richtig konfiguriert?

Referenz: `docs/VERCEL_AI_SDK_V5_RESEARCH.md`

#### Task 4.2: Vercel React Best Practices Audit (Issue 14)

Skill: `/react-best-practices`

Prüfen:

- Server Components vs. Client Components korrekt aufgeteilt?
- Suspense Boundaries richtig gesetzt?
- Dynamic Imports für schwere Komponenten?
- Data Fetching: Server Actions vs. Route Handlers?
- Caching-Strategie (unstable_cache, revalidation)?

**Akzeptanzkriterien Phase 4:**

- [ ] AI SDK Audit Report erstellt, Findings umgesetzt
- [ ] React Audit Report erstellt, Findings umgesetzt
- [ ] Keine Critical/High Findings offen

---

## Dependencies & Risks

### Dependency Graph

```
Phase 1 (Foundation)
├── Task 1.1-1.3 (Cleanup) — parallel
├── Task 1.4 (Rename verify) — nach 1.3
└── Task 1.5 (Tool naming) — nach 1.4
        |
        v
Phase 2 (Architecture)
├── Task 2.1 (Parity matrix) — zuerst
├── Task 2.2 (Agent tools) — nach 2.1
├── Task 2.3 (Tech maintenance) — parallel zu 2.2
└── Task 2.4 (Admin UI) — nach 2.2
        |
        v
Phase 3 (UI)
├── Task 3.1 (Agent Activity) — zuerst
├── Task 3.2 (JSON Render) — parallel zu 3.1
├── Task 3.3 (Export) — parallel zu 3.1
└── Task 3.4 (UX) — parallel
        |
        v
Phase 4 (Audits) — parallel zu Phase 3
├── Task 4.1 (AI SDK)
└── Task 4.2 (React)
```

### Risiken

| Risiko                                        | Wahrscheinlichkeit | Impact | Mitigation                                          |
| --------------------------------------------- | ------------------ | ------ | --------------------------------------------------- |
| Alias-Entfernung bricht mehr als erwartet     | Mittel             | Hoch   | `tsc --noEmit` nach jedem Schritt                   |
| Export-Packages inkompatibel mit Edge Runtime | Niedrig            | Mittel | Server-only Route Handler nutzen                    |
| Agent-Tool-Rename bricht bestehende Agents    | Mittel             | Hoch   | Deprecated-Pattern beibehalten, parallel neue Namen |
| Phase 2+3 Scope Creep                         | Hoch               | Mittel | Strict Scoping, Issues 6 (UX) minimal halten        |

---

## Quality Gates

Jede Phase muss diese Gates bestehen:

1. `npx tsc --noEmit` — 0 Errors
2. `npm test` — alle Tests grün
3. `next build` — Build erfolgreich
4. Code Review mit `react-best-practices` + `ai-sdk` + `code-simplifier` Skills

## References

### Internal

- Rename-Plan: `docs/plans/2026-01-24-rename-rfp-lead-terminology.md`
- Tool-Naming-Audit: `docs/agent-tool-naming-audit.md`
- AI SDK Research: `docs/VERCEL_AI_SDK_V5_RESEARCH.md`
- Deep Scan v2 MVP: `docs/plans/2026-01-30-deep-scan-v2-mvp.md`
- Brainstorm: `docs/brainstorms/2026-02-06-application-health-brainstorm.md`

### Key Files

- DB Schema: `lib/db/schema.ts`
- Agent Tools: `lib/agent-tools/tools/*.ts` (28 files, 153 tools)
- Agent Activity: `components/ai-elements/agent-activity-view.tsx`
- Export: `app/api/qualifications/[id]/qualifications-scan/export/route.ts`
- Admin Configs: `app/(dashboard)/admin/configs/page.tsx`
- Middleware: `middleware.ts`
- Navigation: `lib/pitches/navigation-config.ts`

### Conventions

- Tool Naming: CLAUDE.md → Agent Tool Naming Conventions
- React: `react-best-practices` Skill
- AI SDK: `ai-sdk` Skill
