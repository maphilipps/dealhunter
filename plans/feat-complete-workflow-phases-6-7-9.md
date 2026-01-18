# feat: Complete Workflow Phases 6, 7, 9 - Baseline, Planning, Notification

## Overview

Implementierung der fehlenden Workflow-Phasen aus WORKFLOW.md:
- **Phase 6: Baseline-Vergleich** - Vergleich der analysierten Website mit adesso-Baseline
- **Phase 7: Projekt-Planung** - Timeline-Generierung mit Disziplinen-Matrix
- **Phase 9: Team-Benachrichtigung** - E-Mail + PDF an Team-Mitglieder

---

## Verifizierter Implementierungsstand (2026-01-18)

| Phase | Name | Status | Dateien |
|-------|------|--------|---------|
| 1 | Upload & Extraktion | ✅ 100% | `lib/bids/`, `components/bids/extraction-preview.tsx`, `upload-bid-form.tsx` |
| 2 | Quick Scan | ✅ 100% | `lib/quick-scan/` (agent, schema, actions, tools), `quick-scan-results.tsx` |
| 3 | Bit/No Bit Bewertung | ✅ 100% | `lib/bit-evaluation/` (6 Agents), `decision-card.tsx`, `low-confidence-dialog.tsx` |
| 4 | BL-Routing | ✅ 100% | `bl-routing-card.tsx`, `lib/notifications/email.ts` (BL-Leader E-Mail) |
| 5 | Full Website Scan | ✅ 100% | `lib/deep-analysis/` (4 Agents), `deep-analysis-card.tsx` |
| 6 | Baseline-Vergleich | ❌ 0% | Keine Dateien |
| 7 | Projekt-Planung | ❌ 0% | Keine Dateien |
| 8 | Team Assignment | ✅ 100% | `lib/team/` (agent, schema, actions), `team-builder.tsx` |
| 9 | Team-Benachrichtigung | ⚠️ 20% | `lib/notifications/email.ts` existiert (nur BL-Leader), keine PDF, keine Team-E-Mails |

**Workflow-Completion: ~75%** (6.2/9 Phasen)

---

## Problem Statement

Der Dealhunter-Workflow stoppt nach dem Team Assignment (Phase 8). Die folgenden kritischen Funktionen fehlen:

1. **Baseline-Vergleich fehlt komplett** - BL kann nicht sehen, was aus der Baseline kommt vs. was neu entwickelt werden muss
2. **Projekt-Planung fehlt komplett** - Keine automatische Timeline-Generierung mit Disziplinen-Zuordnung
3. **Team-Benachrichtigung unvollständig** - `lib/notifications/email.ts` sendet nur an BL-Leader, nicht an Team-Mitglieder. Keine PDF-Generierung.

### Status-Flow Gap

**Aktuelles Schema (`lib/db/schema.ts:37-48`):**
```
draft → extracting → reviewing → quick_scanning → evaluating → bit_decided → routed → team_assigned → analysis_complete
```

**WORKFLOW.md Definition:**
```
draft → extracting → quick_scanning → evaluating → bit_decided
                                                      │
                                          ┌───────────┴───────────┐
                                          ▼                       ▼
                                     archived               routing
                                     (NO BIT)               (BIT)
                                                               │
                                                               ▼
                                                        full_scanning
                                                               │
                                                               ▼
                                                         bl_reviewing
                                                               │
                                                               ▼
                                                        team_assigned
                                                               │
                                                               ▼
                                                          notified
                                                               │
                                                               ▼
                                                          handed_off
```

**Fehlende Status:**
- `full_scanning` (Deep Analysis läuft)
- `bl_reviewing` (BL prüft Ergebnisse)
- `notified` (Team wurde benachrichtigt)
- `handed_off` (Workflow abgeschlossen)
- `archived` (NO BIT Entscheidungen)

---

## Proposed Solution

### Phase 6: Baseline-Vergleich

**Agent:** `BaselineComparisonAgent` in `lib/baseline-comparison/agent.ts`
- Vergleicht Deep Analysis `contentArchitecture` mit Baseline-Daten aus `technologies.baselineEntityCounts`
- Kategorisiert Features in "Vorhanden" vs "Neu zu entwickeln"
- Berechnet Baseline-Abdeckung in Prozent

**Datenquelle:** `technologies`-Tabelle hat bereits:
- `baselineHours: integer`
- `baselineName: text`
- `baselineEntityCounts: text (JSON)`

**UI-Komponente:** `components/bids/baseline-comparison-card.tsx`
- Zwei-Spalten-Layout (Vorhanden | Neu)
- Coverage-Meter mit Prozentanzeige
- Kategorien: Content Types, Paragraphs, Navigation, Features, Integrationen

### Phase 7: Projekt-Planung

**Agent:** `ProjectPlanningAgent` in `lib/project-planning/agent.ts`
- Generiert Timeline basierend auf Deep Analysis `ptEstimation`
- Berechnet Phasen-Dauer (Discovery, Design, Development, QA, Go-Live)
- Ordnet Disziplinen pro Phase zu (PL, CON, UI/UX, DEV, SEO, QA)
- Erstellt Rollen-Matrix mit Involvement-Levels

**UI-Komponente:** `components/bids/project-planning-card.tsx`
- Gantt-ähnliche Timeline-Visualisierung (horizontal bars)
- Disziplinen-Matrix pro Phase
- Editierbare Phasen-Dauer

### Phase 9: Team-Benachrichtigung (Erweiterung)

**Bestehendes:** `lib/notifications/email.ts` mit `sendBLAssignmentEmail()`

**Neu benötigt:**
1. `sendTeamNotificationEmail()` - Personalisierte E-Mail an jedes Team-Mitglied
2. `generateProjectPDF()` - PDF mit Projekt-Zusammenfassung (react-pdf)
3. `NotificationCard` - UI zum Versenden und Tracken

**UI-Komponente:** `components/bids/notification-card.tsx`
- Preview der E-Mail vor Versand
- PDF-Download Button
- Versand-Status pro Team-Mitglied
- Bulk-Versand Button

---

## Technical Approach

### Database Schema Erweiterungen

```typescript
// lib/db/schema.ts - Status Enum erweitern
status: text('status', {
  enum: [
    'draft',
    'extracting',
    'reviewing',
    'quick_scanning',
    'evaluating',
    'bit_decided',
    'archived',        // NEU: NO BIT
    'routed',
    'full_scanning',   // NEU: Deep Analysis läuft
    'bl_reviewing',    // NEU: BL prüft
    'team_assigned',
    'notified',        // NEU: Team benachrichtigt
    'handed_off'       // NEU: Abgeschlossen
  ]
})

// Neue Felder in bidOpportunities
baselineComparisonResult: text('baseline_comparison_result'),     // JSON
baselineComparisonCompletedAt: integer('baseline_comparison_completed_at', { mode: 'timestamp' }),
projectPlanningResult: text('project_planning_result'),           // JSON
projectPlanningCompletedAt: integer('project_planning_completed_at', { mode: 'timestamp' }),
teamNotifications: text('team_notifications'),                    // JSON Array
```

### Datei-Struktur (zu erstellen)

```
lib/
├── baseline-comparison/
│   ├── agent.ts              # BaselineComparisonAgent
│   ├── actions.ts            # Server Actions
│   └── schema.ts             # Zod Schemas
├── project-planning/
│   ├── agent.ts              # ProjectPlanningAgent
│   ├── actions.ts            # Server Actions
│   └── schema.ts             # Zod Schemas
├── notifications/
│   ├── email.ts              # ✅ EXISTIERT - erweitern
│   ├── pdf-generator.tsx     # NEU: react-pdf Template
│   └── actions.ts            # NEU: Server Actions

components/bids/
├── baseline-comparison-card.tsx   # NEU
├── project-planning-card.tsx      # NEU
└── notification-card.tsx          # NEU
```

---

## Implementation Phases

### Phase 1: Schema & Status Flow (Basis)

**1.1 Schema Migration**
- [ ] Status Enum in `lib/db/schema.ts` erweitern (6 neue Status)
- [ ] Neue Felder hinzufügen (`baselineComparisonResult`, `projectPlanningResult`, `teamNotifications`)
- [ ] `npm run db:push` ausführen

**1.2 Status Badge Update**
- [ ] `StatusBadge` in `app/(dashboard)/bids/[id]/page.tsx` erweitern
- [ ] Neue Status-Labels und Farben

### Phase 2: Baseline-Vergleich (Priorität 1)

**2.1 Schema & Types**
- [ ] `lib/baseline-comparison/schema.ts` erstellen
  - `BaselineItem` (name, category, available)
  - `BaselineComparisonResult` (available, missing, coverage)

**2.2 Agent Implementation**
- [ ] `lib/baseline-comparison/agent.ts` erstellen
- [ ] Input: `deepMigrationAnalysis.contentArchitecture` + `technology.baselineEntityCounts`
- [ ] Output: Kategorisierte Liste + Coverage-Prozentsatz

**2.3 Server Actions**
- [ ] `lib/baseline-comparison/actions.ts`
  - `triggerBaselineComparison(bidId)`
  - `getBaselineComparisonResult(bidId)`

**2.4 UI Component**
- [ ] `components/bids/baseline-comparison-card.tsx`
- [ ] Zwei-Spalten-Layout mit Icons (✅ / ❌)
- [ ] Coverage-Progress-Bar
- [ ] Collapsible Kategorien

**2.5 Integration**
- [ ] In `bid-detail-client.tsx` nach Deep Analysis einbinden
- [ ] Auto-Trigger nach Deep Analysis Complete

### Phase 3: Projekt-Planung (Priorität 2)

**3.1 Schema & Types**
- [ ] `lib/project-planning/schema.ts` erstellen
  - `ProjectPhase` (name, startWeek, endWeek, disciplines)
  - `Discipline` (code, name, involvement)
  - `ProjectPlan` (phases, totalWeeks, teamSize)

**3.2 Agent Implementation**
- [ ] `lib/project-planning/agent.ts` erstellen
- [ ] Input: `deepMigrationAnalysis.ptEstimation` + `baselineComparison.coverage`
- [ ] Output: 5 Phasen mit Wochen-Zuordnung + Disziplinen-Matrix

**3.3 Server Actions**
- [ ] `lib/project-planning/actions.ts`
  - `generateProjectPlan(bidId)`
  - `updateProjectPhase(bidId, phaseIndex, updates)`

**3.4 UI Components**
- [ ] `components/bids/project-planning-card.tsx`
- [ ] Timeline mit horizontalen Balken (CSS Grid)
- [ ] Disziplinen-Matrix-Tabelle
- [ ] Inline-Editing für Phasen-Dauer

**3.5 Integration**
- [ ] In `bid-detail-client.tsx` nach Baseline-Vergleich einbinden

### Phase 4: Team-Benachrichtigung (Priorität 3)

**4.1 Dependencies**
- [ ] `npm install @react-pdf/renderer` (PDF-Generierung)
- [ ] Resend bereits vorhanden

**4.2 Email Erweiterung**
- [ ] `lib/notifications/email.ts` erweitern
- [ ] `sendTeamNotificationEmail(input)` hinzufügen
- [ ] Team-spezifisches E-Mail-Template

**4.3 PDF Generator**
- [ ] `lib/notifications/pdf-generator.tsx` erstellen
- [ ] Projekt-Zusammenfassung (Kunde, Scope, Technologien)
- [ ] Timeline-Visualisierung
- [ ] Team-Übersicht mit Rollen
- [ ] Nächste Schritte

**4.4 Server Actions**
- [ ] `lib/notifications/actions.ts` erstellen
  - `sendTeamNotifications(bidId)`
  - `previewEmail(bidId, employeeId)`
  - `generateProjectPDF(bidId)`

**4.5 UI Component**
- [ ] `components/bids/notification-card.tsx`
- [ ] Team-Liste mit Checkboxen
- [ ] E-Mail-Preview Modal
- [ ] PDF-Download Button
- [ ] Versand-Status pro Mitglied (Pending/Sent/Failed)

**4.6 Integration**
- [ ] In `bid-detail-client.tsx` nach Team Assignment einbinden
- [ ] Status auf `notified` setzen nach erfolgreichem Versand

### Phase 5: BL Review Page

**5.1 Page Implementation**
- [ ] `app/(dashboard)/bl-review/page.tsx` vollständig implementieren
- [ ] Filter: Nur Bids für eigene Business Line
- [ ] Tabs: Pending Review | In Progress | Completed

**5.2 BL-spezifische Ansicht**
- [ ] Deep Analysis Zusammenfassung
- [ ] Baseline-Vergleich
- [ ] Projekt-Planung
- [ ] Team-Builder
- [ ] Notification-Versand

---

## Acceptance Criteria

### Functional Requirements

- [ ] Baseline-Vergleich zeigt korrekt was aus Baseline kommt vs. neu entwickelt werden muss
- [ ] Coverage-Prozentsatz wird korrekt berechnet (>90% Accuracy)
- [ ] Projekt-Timeline wird automatisch basierend auf PT-Schätzung generiert
- [ ] Disziplinen-Matrix zeigt Involvement pro Phase korrekt
- [ ] Phasen-Dauer ist vom BL inline editierbar
- [ ] Team-Mitglieder erhalten personalisierte E-Mail mit Rolle
- [ ] PDF enthält alle relevanten Projekt-Informationen
- [ ] Status-Flow entspricht WORKFLOW.md Definition
- [ ] NO BIT Entscheidungen werden auf `archived` Status gesetzt

### Non-Functional Requirements

- [ ] Baseline-Vergleich < 30 Sekunden
- [ ] Projekt-Planung < 30 Sekunden
- [ ] E-Mail-Versand < 5 Sekunden pro Empfänger
- [ ] PDF-Generierung < 10 Sekunden
- [ ] Alle UI-Komponenten responsive (Mobile-ready)

### Quality Gates

- [ ] TypeScript strict mode ohne Errors
- [ ] Alle neuen Funktionen haben Server Actions (keine direkten DB-Calls in Components)
- [ ] Zod Validation für alle AI-generierten Outputs
- [ ] Error Boundaries für Agent-Failures
- [ ] Loading States für alle async Operations

---

## Success Metrics

| Metrik | Target |
|--------|--------|
| Workflow Completion | 100% (alle 9 Phasen) |
| Baseline-Vergleich Accuracy | >90% korrekte Kategorisierung |
| Timeline-Generierung Akzeptanz | >80% ohne manuelle Anpassung |
| E-Mail Delivery Rate | >99% |
| PDF Generation Success | 100% |

---

## Dependencies & Prerequisites

- [x] Deep Analysis implementiert (`lib/deep-analysis/`)
- [x] Team Assignment implementiert (`lib/team/`)
- [x] Technologies-Tabelle mit Baseline-Feldern (`baselineEntityCounts`)
- [x] Resend für E-Mail (`lib/notifications/email.ts`)
- [ ] `@react-pdf/renderer` für PDF-Generierung (zu installieren)

---

## Risk Analysis & Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Baseline-Daten unvollständig | Mittel | Hoch | Fallback: Alles als "Neu zu entwickeln" markieren |
| E-Mail-Versand blockiert | Niedrig | Mittel | Alternative: PDF-Download only Mode |
| PT-Schätzung ungenau | Mittel | Mittel | BL kann Timeline manuell anpassen |
| PDF-Generierung langsam | Niedrig | Niedrig | Background Job mit Polling |
| Schema-Migration Fehler | Niedrig | Hoch | Migration testen, Backup vor Push |

---

## References

### Internal References
- `WORKFLOW.md` - Vollständige Workflow-Definition
- `lib/db/schema.ts:37-48` - Aktuelles Status Enum
- `lib/deep-analysis/` - Deep Analysis Implementation (Input für Phase 6/7)
- `lib/team/` - Team Assignment Implementation (Input für Phase 9)
- `lib/notifications/email.ts` - Bestehendes E-Mail-System
- `components/bids/team-builder.tsx` - Team Assignment UI

### External References
- [Resend Documentation](https://resend.com/docs)
- [react-pdf Documentation](https://react-pdf.org/)
- [Vercel AI SDK generateObject](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)

---

## Implementierungs-Hinweise

### Vercel AI SDK Skills nutzen

Bei der Implementierung MÜSSEN folgende MCP-Tools und Skills verwendet werden:

**Für AI Agents:**
- `Context7 MCP` für AI SDK Dokumentation abrufen (`resolve-library-id`, `query-docs`)
- AI SDK v5/v6 Patterns für `generateObject` / `streamText`
- Bestehende Agent-Patterns aus `lib/bit-evaluation/` als Referenz

**Für UI Components:**
- `ShadCN MCP` für Komponenten-Suche und Examples
- `npx shadcn@latest add <component>` für Installation
- `Chrome DevTools MCP` für Visual Verification nach jeder UI-Änderung

**Für Next.js Integration:**
- `Next.js DevTools MCP` für Server-Diagnostics und Error-Checking
- Server Actions Pattern wie in `lib/team/actions.ts`

**Workflow:**
```
1. Context7 MCP → AI SDK Docs für Agent-Pattern
2. ShadCN MCP → UI-Komponenten finden
3. Implementieren
4. Chrome DevTools MCP → Screenshot zur Verifikation
5. Next.js DevTools MCP → Error Check
```

---

**Plan erstellt:** 2026-01-18
**Verifiziert durch:** Direkte Codebase-Analyse
