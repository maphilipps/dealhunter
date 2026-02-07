# Naming-Analyse: Leads / Qualifications / PreQualifications / Bids / Pitches

## Domänen-Konzept (IST-Zustand)

Die App hat **zwei Haupt-Entitäten** mit einem klaren Lifecycle:

1. **PreQualification** (Phase 1): BD Manager erfasst Anfrage → AI analysiert → BID/NO-BID → weiterleiten
2. **Pitch** (Phase 2): BL bekommt weiterleiteten Lead → Audit Scan → BID/NO-BID Finale

### Naming pro Layer

| Layer                   | Phase 1 (BD)                                         | Phase 2 (BL)             |
| ----------------------- | ---------------------------------------------------- | ------------------------ |
| **DB-Tabelle**          | `pre_qualifications`                                 | `pitches`                |
| **Drizzle Export**      | `preQualifications`                                  | `pitches`                |
| **TypeScript Type**     | `PreQualification`                                   | `Pitch`                  |
| **UI-Route**            | `/qualifications`                                    | `/pitches`               |
| **Sidebar Label**       | "Leads"                                              | "Pitches"                |
| **H1 Heading**          | "Leads"                                              | "Qualifications" ❌      |
| **Breadcrumb Label**    | "Qualifications" ❌                                  | "Pitches"                |
| **Server Actions File** | `lib/bids/actions.ts` ❌                             | `lib/pitches/actions.ts` |
| **Function Names**      | `getBids()`, `uploadPdfBid()` ❌                     | `getLeads()` ❌          |
| **API Routes**          | `/api/qualifications/[id]/*`                         | `/api/pitches/[id]/*`    |
| **Components Dir**      | `components/qualifications/` + `components/bids/` ❌ | `components/pitches/`    |

## Mapping-Tabelle (Vollständig)

| Kontext                         | Aktueller Name                                                    | Wo                                                                | Idealer Name                                    | Priorität |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | --------- |
| DB table                        | `pre_qualifications`                                              | `lib/db/schema.ts:133`                                            | Bleiben (breaking change)                       | —         |
| DB table                        | `qualification_scans`                                             | `lib/db/schema.ts:582`                                            | Bleiben                                         | —         |
| DB table                        | `audit_scan_runs`                                                 | `lib/db/schema.ts:1923`                                           | Bleiben                                         | —         |
| Sidebar label                   | "Leads" → `/qualifications`                                       | `components/app-sidebar.tsx:45`                                   | ✅ OK                                           | —         |
| Sidebar label                   | "Pitches" → `/pitches`                                            | `components/app-sidebar.tsx:50`                                   | ✅ OK                                           | —         |
| Page H1                         | "Leads"                                                           | `qualifications/page.tsx:50`                                      | ✅ OK                                           | —         |
| **Page H1**                     | **"Qualifications"**                                              | `pitches/page.tsx:41`                                             | **→ "Pitches"**                                 | 🔴 HIGH   |
| Page subtitle                   | "Qualifications aus dem Pre-Qualification-Qualifizierungsprozess" | `pitches/page.tsx:43`                                             | → "Pitches aus dem Lead-Qualifizierungsprozess" | 🔴 HIGH   |
| Card title                      | "Alle Qualifications"                                             | `pitches/page.tsx:87`                                             | → "Alle Pitches"                                | 🔴 HIGH   |
| Card desc                       | "Klicken Sie auf eine Qualification"                              | `pitches/page.tsx:88`                                             | → "Klicken Sie auf einen Pitch"                 | 🔴 HIGH   |
| Breadcrumb                      | `qualifications: 'Qualifications'`                                | `dynamic-breadcrumb.tsx:17`                                       | → `qualifications: 'Leads'`                     | 🟡 MED    |
| Breadcrumb                      | `bids: 'Leads'`                                                   | `dynamic-breadcrumb.tsx:16`                                       | Entfernen (alte Route)                          | 🟡 MED    |
| Dashboard redirect              | `redirect('/qualifications')`                                     | `app/(dashboard)/page.tsx:4`                                      | ✅ OK                                           | —         |
| **Actions file**                | **`lib/bids/actions.ts`**                                         | Dateiname                                                         | **→ `lib/leads/actions.ts`**                    | 🟡 MED    |
| Function                        | `getBids()`                                                       | `lib/bids/actions.ts:28`                                          | → `getLeads()`                                  | 🟡 MED    |
| Function                        | `uploadPdfBid()`                                                  | `lib/bids/actions.ts:145`                                         | → `uploadPdfLead()`                             | 🟡 MED    |
| Function                        | `uploadFreetextBid()`                                             | `lib/bids/actions.ts:244`                                         | → `uploadFreetextLead()`                        | 🟡 MED    |
| Function                        | `uploadEmailBid()`                                                | `lib/bids/actions.ts:300`                                         | → `uploadEmailLead()`                           | 🟡 MED    |
| Function                        | `uploadCombinedBid()`                                             | `lib/bids/actions.ts:532`                                         | → `uploadCombinedLead()`                        | 🟡 MED    |
| Function                        | `createPendingPreQualification()`                                 | `lib/bids/actions.ts:759`                                         | → `createPendingLead()`                         | 🟡 MED    |
| Function                        | `startPreQualProcessing()`                                        | `lib/bids/actions.ts:939`                                         | → `startLeadProcessing()`                       | 🟡 MED    |
| Function                        | `makeBitDecision()`                                               | `lib/bids/actions.ts:1116`                                        | → `makeLeadDecision()`                          | 🟡 MED    |
| Helper                          | `canAccessBid()`                                                  | `lib/bids/actions.ts:21`                                          | → `canAccessLead()`                             | 🟡 MED    |
| Variables                       | `bidOpportunity`, `bids`                                          | `lib/bids/actions.ts` (überall)                                   | → `lead`, `leads`                               | 🟡 MED    |
| **Pitches actions**             | **`getLeads()`**                                                  | `lib/pitches/actions.ts:19` (import)                              | **→ `getPitches()`**                            | 🟡 MED    |
| Component                       | `DeleteQualificationButton`                                       | `components/qualifications/delete-qualification-button.tsx`       | → `DeleteLeadButton`                            | 🟢 LOW    |
| Component                       | `QualificationsEmptyStateClient`                                  | `components/qualifications/qualifications-empty-state-client.tsx` | → `LeadsEmptyStateClient`                       | 🟢 LOW    |
| Component prop                  | `preQualificationId`                                              | `components/qualifications/delete-qualification-button.tsx`       | → `leadId`                                      | 🟢 LOW    |
| Nav config const                | `QUALIFICATION_NAVIGATION_SECTIONS`                               | `lib/pitches/navigation-config.ts:43`                             | → `LEAD_NAVIGATION_SECTIONS`                    | 🟢 LOW    |
| Nav config type                 | `LeadNavigationSection`                                           | `lib/pitches/navigation-config.ts:12`                             | ✅ OK (already Lead)                            | —         |
| Schema alias                    | `leadScans = qualificationScans`                                  | `lib/db/schema.ts:661`                                            | Deprecated → remove                             | 🟢 LOW    |
| Schema alias                    | `pitchScanRuns = auditScanRuns`                                   | `lib/db/schema.ts:1986`                                           | Deprecated → remove                             | 🟢 LOW    |
| Schema alias                    | `quickScans = qualificationScans`                                 | `lib/db/schema.ts:2289`                                           | Deprecated → remove                             | 🟢 LOW    |
| `lib/qualifications/actions.ts` | `deletePreQualificationHard()`                                    | Funktionsname                                                     | → `deleteLeadHard()`                            | 🟡 MED    |
| `lib/qualifications/actions.ts` | Import `leadScans`                                                | schema import                                                     | → `qualificationScans`                          | 🟢 LOW    |
| Section notes FK                | `qualificationId`                                                 | `lib/db/schema.ts:2255`                                           | OK (internal, refers to preQualifications)      | —         |

## Inkonsistenzen (Priorisiert)

### 🔴 P1: Sichtbare UI-Fehler (User-facing)

1. **Pitches-Seite hat falsche Überschrift "Qualifications"** statt "Pitches"
   - `pitches/page.tsx:41` — H1 sagt "Qualifications"
   - `pitches/page.tsx:43` — Subtitle sagt "Qualifications aus dem Pre-Qualification-Qualifizierungsprozess"
   - `pitches/page.tsx:87-88` — Card title/description sagen "Qualifications"
   - **Fix**: Alle auf "Pitches" ändern

2. **Function `getLeads()` in pitches/actions holt Pitches, nicht Leads**
   - `pitches/page.tsx:33` ruft `getLeads()` auf — verwirrend, da es eigentlich Pitches holt
   - **Fix**: `getLeads()` → `getPitches()` in `lib/pitches/actions.ts`

### 🟡 P2: Code-Naming-Inkonsistenzen (Developer-facing)

3. **`lib/bids/actions.ts` verwendet durchgehend "bid" Terminology**
   - `getBids()`, `uploadPdfBid()`, `canAccessBid()`, `bidOpportunity` variable
   - Sidebar zeigt "Leads", Route ist `/qualifications`, aber Code sagt "bids"
   - **Fix**: `lib/bids/` → `lib/leads/`, alle Funktions-/Variablennamen umbennen

4. **Breadcrumb zeigt "Qualifications" statt "Leads" für `/qualifications`**
   - `dynamic-breadcrumb.tsx:17` — `qualifications: 'Qualifications'`
   - Sidebar sagt "Leads", Breadcrumb sagt "Qualifications"
   - **Fix**: → `qualifications: 'Leads'`

5. **`components/bids/` Verzeichnis existiert neben `components/qualifications/`**
   - Beide enthalten Komponenten für Phase 1 (Leads)
   - `components/bids/upload-bid-form.tsx` wird von `/qualifications/new` verwendet
   - **Fix**: Zusammenführen nach `components/leads/`

6. **Doppelte Leere-Zustands-Komponenten**
   - `components/qualifications/qualifications-empty-state-client.tsx`
   - `components/pitches/pitches-empty-state-client.tsx`
   - Pitches-Version heißt intern `QualificationsEmptyStateClient`

### 🟢 P3: Technische Schulden (Aufräumen)

7. **Deprecated Schema-Aliase sollten entfernt werden**
   - `leadScans`, `quickScans`, `pitchScanRuns`, `pitchScanResults`, `pitchAuditResults`
   - Alle als `@deprecated` markiert, können bei nächstem Refactoring entfernt werden

8. **Navigation-Config Constant Name**: `QUALIFICATION_NAVIGATION_SECTIONS`
   - Typen heißen schon `LeadNavigationSection` — der Constant-Name passt nicht
   - → `LEAD_NAVIGATION_SECTIONS`

9. **`lib/qualifications/actions.ts`** verwendet `leadScans` (deprecated alias)
   - → Direkt `qualificationScans` verwenden

## Empfohlene Naming-Konvention

| Konzept                  | UI Label (DE)         | Route                                      | Code/Variable               | DB                    |
| ------------------------ | --------------------- | ------------------------------------------ | --------------------------- | --------------------- |
| Phase 1 Entity           | "Lead"                | `/qualifications`                          | `lead` / `preQualification` | `pre_qualifications`  |
| Phase 1 Scan             | "Qualifications Scan" | `/qualifications/[id]/qualifications-scan` | `qualificationScan`         | `qualification_scans` |
| Phase 2 Entity           | "Pitch"               | `/pitches`                                 | `pitch`                     | `pitches`             |
| Phase 2 Scan             | "Audit Scan"          | `/pitches/[id]/audit-scan`                 | `auditScan`                 | `audit_scan_runs`     |
| Server Actions (Phase 1) | —                     | —                                          | `lib/leads/actions.ts`      | —                     |
| Server Actions (Phase 2) | —                     | —                                          | `lib/pitches/actions.ts`    | —                     |
| Components (Phase 1)     | —                     | —                                          | `components/leads/`         | —                     |
| Components (Phase 2)     | —                     | —                                          | `components/pitches/`       | —                     |

## Zusammenfassung

**Kern-Problem**: Die App wurde historisch mit "Bids" gestartet, dann zu "Pre-Qualifications" refactored, dann UI-seitig zu "Leads" umbenannt. Gleichzeitig wurde Phase 2 als "Pitches" eingeführt, aber mit "Qualifications" Labels versehen. Ergebnis: 4 verschiedene Begriffe für 2 Konzepte.

**Ziel-Zustand**:

- **Phase 1 = Lead** (UI) / `preQualification` (Code) / `pre_qualifications` (DB)
- **Phase 2 = Pitch** (UI) / `pitch` (Code) / `pitches` (DB)
- **Kein "bid" und kein "qualification" mehr in UI-facing Code** (außer DB-Schema)
