# PRD: Phase 2 - Deep Analysis & BL Decision Workflow

**Epic:** DEA-Phase-2
**Status:** Draft
**Erstellt:** 2026-01-21
**Autor:** Marc Philipps (Solutions Lead)

---

## Problem Statement

Business Developer (BD) haben in Phase 1 ein RFP durch Quick Scan analysiert und einer Business Unit (BU) zugewiesen. Jetzt benötigt der **Bereichsleiter (BL)** tiefgreifende Informationen, um eine fundierte **BID/NO-BID Entscheidung** zu treffen.

Aktuell fehlt:
- **Automatischer Deep-Scan** nach BU-Zuweisung
- **Umfassende Website-Analyse** (Tech Stack, Content Architecture, Performance, Accessibility)
- **PT-Schätzung** basierend auf Baseline-Projekten
- **CMS-Matching** mit Feature-Scoring
- **Reference Project Matching** für Glaubwürdigkeit
- **Strukturiertes BL-Interface** zur Entscheidungsfindung

Der BL muss manuell recherchieren, was zu **inkonsistenten Entscheidungen** und **verzögertem Workflow** führt.

---

## Solution

**Phase 2: Deep Analysis & BL Decision** erweitert den Workflow um:

1. **Automatische Lead-Erstellung** bei RFP → BU Routing (Status: `routed`)
2. **Multi-Agent Deep-Scan** im Hintergrund:
   - Full-Scan Agent (Website Crawling, Tech Stack Detection)
   - Content Architecture Agent (Page Count, Content Types, Navigation)
   - Migration Complexity Agent (Complexity Score, Risk Assessment)
   - Accessibility Audit Agent (WCAG Compliance, Fix Hours)
3. **Agent-Orchestration**: Full-Scan zuerst → dann Rest parallel
4. **Dedicated Leads-Bereich** im Dashboard (separater Raum von RFPs)
5. **BL Review Interface**:
   - Übersicht über alle Deep-Scan Ergebnisse
   - PT Estimation mit Phasen-Breakdown
   - CMS-Match Ranking
   - Reference Project Matches
   - Einfaches BID/NO-BID Vote mit Confidence Score + Reasoning
6. **Status-Tracking**: `routed` → `full_scanning` → `bl_reviewing` → `bid_voted` → `archived` (bei NO-BID)

**Ergebnis:** BL erhält **datengetriebene Entscheidungsgrundlage** in einem **eigenen Lead-Workspace**, vergleichbar mit den Website Audits aus `/audits/audit_lucarnofestival.ch/`.

---

## User Stories

### Lead Creation & Routing

1. Als **Business Developer** möchte ich, dass nach BU-Zuweisung automatisch ein Lead erstellt wird, sodass ich nicht manuell konvertieren muss
2. Als **Business Developer** möchte ich sehen, dass mein RFP erfolgreich an den BL weitergeleitet wurde, sodass ich den Status nachverfolgen kann
3. Als **System** möchte ich beim Lead-Übergang alle relevanten RFP-Daten (customerName, industry, websiteUrl, projectDescription, budget, requirements, decisionMakers, quickScan) übernehmen, sodass keine Informationen verloren gehen
4. Als **System** möchte ich die Business Unit ID und den Quick Scan Reference beim Lead speichern, sodass der Kontext erhalten bleibt

### Deep-Scan Automation

5. Als **BL** möchte ich, dass der Deep-Scan automatisch startet, wenn ein Lead meinem Bereich zugewiesen wird, sodass ich nicht manuell triggern muss
6. Als **System** möchte ich zuerst den Full-Scan Agent starten (Tech Stack Detection), dann parallel Content/Migration/A11y Agents, sodass Abhängigkeiten korrekt aufgelöst werden
7. Als **BL** möchte ich den Scan-Status sehen (pending/running/completed/failed), sodass ich weiß, wann Ergebnisse verfügbar sind
8. Als **System** möchte ich Scan-Fehler robust behandeln und im Lead-Status dokumentieren, sodass Probleme sichtbar werden
9. Als **BL** möchte ich bei Scan-Abschluss benachrichtigt werden (optional), sodass ich schnell reagieren kann

### Full-Scan Agent (Website Crawling & Tech Stack)

10. Als **Full-Scan Agent** möchte ich die Website crawlen (max 10 Seiten), sodass ich repräsentative Daten erhalte
11. Als **Full-Scan Agent** möchte ich CMS, Framework, Hosting, Server detektieren, sodass Tech Stack bekannt ist
12. Als **Full-Scan Agent** möchte ich Performance Metrics erfassen (Core Web Vitals: LCP, FID, CLS, TTFB), sodass Performance-Bottlenecks identifiziert werden
13. Als **Full-Scan Agent** möchte ich Screenshots der Homepage speichern, sodass BL visuelle Referenz hat
14. Als **Full-Scan Agent** möchte ich Ergebnisse in `websiteAudits` table speichern, sodass Daten strukturiert vorliegen
15. Als **Full-Scan Agent** möchte ich bei Crawl-Fehlern (Timeout, 404, etc.) graceful degradieren, sodass Teil-Ergebnisse trotzdem gespeichert werden

### Content Architecture Agent

16. Als **Content Architecture Agent** möchte ich Page Count schätzen, sodass Content-Volumen bekannt ist
17. Als **Content Architecture Agent** möchte ich Content Types identifizieren (News, Blog, Product, etc.), sodass Architektur verstanden wird
18. Als **Content Architecture Agent** möchte ich Navigation Structure analysieren (Depth, Breadth), sodass Komplexität erfasst wird
19. Als **Content Architecture Agent** möchte ich Site Tree als hierarchische Struktur speichern, sodass BL Sitemap sieht
20. Als **Content Architecture Agent** möchte ich Content Volume analysieren (Bilder, Videos, Dokumente), sodass Migrations-Aufwand geschätzt werden kann

### Migration Complexity Agent

21. Als **Migration Complexity Agent** möchte ich Complexity Score (0-100) berechnen basierend auf Tech Stack, Content Volume, Custom Features, sodass Risiko quantifiziert wird
22. Als **Migration Complexity Agent** möchte ich Migration Complexity Category (low/medium/high/very_high) zuweisen, sodass BL schnell einordnen kann
23. Als **Migration Complexity Agent** möchte ich Complexity Factors dokumentieren (Custom Modules, Integrations, etc.), sodass Begründung nachvollziehbar ist
24. Als **Migration Complexity Agent** möchte ich Migration Risks identifizieren (Data Loss, Downtime, etc.), sodass Risiken transparent sind

### Accessibility Audit Agent

25. Als **Accessibility Audit Agent** möchte ich WCAG 2.1 Level AA Compliance prüfen, sodass rechtliche Anforderungen erfüllt werden
26. Als **Accessibility Audit Agent** möchte ich Accessibility Score (0-100) berechnen, sodass A11y-Status quantifiziert ist
27. Als **Accessibility Audit Agent** möchte ich A11y Violations mit Severity (critical/serious/moderate) kategorisieren, sodass Prioritäten klar sind
28. Als **Accessibility Audit Agent** möchte ich Estimated Fix Hours schätzen, sodass Aufwand für WCAG-Compliance bekannt ist
29. Als **Accessibility Audit Agent** möchte ich Axe-core Integration nutzen, sodass Standard-konforme Checks durchgeführt werden

### PT Estimation (Baseline-basiert)

30. Als **PT Estimation Module** möchte ich Baseline-Projekt für detektiertes CMS/Tech Stack finden, sodass realistische Schätzung möglich ist
31. Als **PT Estimation Module** möchte ich Delta zur Baseline berechnen (Content Types, Features, Custom Modules), sodass Additional PT geschätzt wird
32. Als **PT Estimation Module** möchte ich Total PT (Baseline + Additional) berechnen, sodass Gesamt-Aufwand bekannt ist
33. Als **PT Estimation Module** möchte ich Phasen-Breakdown erstellen (Discovery, Development, Migration, Testing), sodass Timeline planbar ist
34. Als **PT Estimation Module** möchte ich Discipline Matrix erstellen (Architect, Developer, Designer, QA), sodass Rollen-Verteilung klar ist
35. Als **PT Estimation Module** möchte ich Risk Buffer (%) hinzufügen, sodass Unsicherheiten abgedeckt sind
36. Als **PT Estimation Module** möchte ich Confidence Level (low/medium/high) angeben, sodass Schätz-Qualität transparent ist

### CMS/Technology Matching

37. Als **CMS Matching Module** möchte ich Top 3 CMS-Empfehlungen ranken, sodass BL Alternativen sieht
38. Als **CMS Matching Module** möchte ich Feature-Scoring durchführen (Feature Match %), sodass technische Passung bewertet wird
39. Als **CMS Matching Module** möchte ich Industry Fit bewerten, sodass branchenspezifische Anforderungen berücksichtigt werden
40. Als **CMS Matching Module** möchte ich Size/Budget Score berechnen, sodass Wirtschaftlichkeit bewertet wird
41. Als **CMS Matching Module** möchte ich Migration Score berechnen (Aufwand für Wechsel), sodass Migrations-Komplexität berücksichtigt wird
42. Als **CMS Matching Module** möchte ich Reasoning für jede Empfehlung liefern, sodass Entscheidung nachvollziehbar ist

### Reference Project Matching

43. Als **Reference Matching Module** möchte ich gegen validierte References matchen (Tech Stack + Industry), sodass Erfolgs-Nachweise vorliegen
44. Als **Reference Matching Module** möchte ich Tech Stack Score (60% Weight) berechnen, sodass technische Ähnlichkeit bewertet wird
45. Als **Reference Matching Module** möchte ich Industry Score (40% Weight) berechnen, sodass Branchen-Expertise bewertet wird
46. Als **Reference Matching Module** möchte ich Top 5 Reference Matches ranken, sodass BL relevante Projekte sieht
47. Als **Reference Matching Module** möchte ich Matched Technologies + Industries auflisten, sodass Overlap transparent ist

### BL Review Interface (Leads-Bereich)

48. Als **BL** möchte ich einen dedizierten Leads-Bereich sehen (getrennt von RFPs), sodass ich nur relevante Leads für meinen Bereich sehe
49. Als **BL** möchte ich Lead Overview mit Status-Badge sehen, sodass ich Workflow-Status auf einen Blick erkenne
50. Als **BL** möchte ich Website URL mit "Öffnen" Button sehen, sodass ich Website schnell prüfen kann
51. Als **BL** möchte ich Screenshots der Website sehen, sodass ich visuellen Eindruck habe
52. Als **BL** möchte ich Tech Stack Summary sehen (CMS, Framework, Hosting), sodass ich technische Basis verstehe
53. Als **BL** möchte ich Performance Metrics sehen (Core Web Vitals mit Ampel-Farben), sodass Performance-Status klar ist
54. Als **BL** möchte ich Content Architecture Summary sehen (Page Count, Content Types), sodass ich Umfang einschätzen kann
55. Als **BL** möchte ich Migration Complexity Score + Category sehen, sodass ich Risiko einschätzen kann
56. Als **BL** möchte ich Accessibility Score + WCAG Level sehen, sodass ich Compliance-Status kenne
57. Als **BL** möchte ich PT Estimation mit Phasen-Breakdown sehen, sodass ich Timeline planen kann
58. Als **BL** möchte ich CMS-Match Ranking sehen (Top 3 mit Scores), sodass ich Technologie-Optionen abwägen kann
59. Als **BL** möchte ich Reference Matches sehen (Top 5), sodass ich Erfolgs-Nachweise habe
60. Als **BL** möchte ich Decision Makers Liste sehen (aus Quick Scan 2.0), sodass ich Stakeholder kenne

### BID/NO-BID Decision

61. Als **BL** möchte ich einfaches BID/NO-BID Vote abgeben können, sodass Entscheidung klar dokumentiert ist
62. Als **BL** möchte ich Confidence Score (0-100%) angeben können, sodass meine Sicherheit quantifiziert ist
63. Als **BL** möchte ich Text Reasoning eingeben können, sodass Begründung für Team nachvollziehbar ist
64. Als **BL** möchte ich Entscheidung speichern und Status auf `bid_voted` setzen, sodass Workflow fortgesetzt wird
65. Als **BL** möchte ich bei NO-BID Lead automatisch archivieren (Status: `archived`), sodass Pipeline sauber bleibt
66. Als **BL** möchte ich bei BID den Lead für Phase 3 (Team Staffing) freigeben, sodass nächster Workflow-Schritt startet

### Request More Info (Optional)

67. Als **BL** möchte ich "Mehr Infos anfordern" können, wenn Daten unzureichend sind, sodass BD zusätzliche Details liefern kann
68. Als **BL** möchte ich Notes für Info-Request eingeben können, sodass BD weiß, was fehlt
69. Als **BL** möchte ich Timestamp für Request sehen, sodass Nachverfolgung möglich ist
70. Als **System** möchte ich BD über Info-Request benachrichtigen (optional), sodass schnelle Reaktion möglich ist

### Background Job Management

71. Als **System** möchte ich Background Jobs für Deep-Scan Agents tracken (status, progress, errors), sodass Monitoring möglich ist
72. Als **System** möchte ich Job-Status in Lead-Status reflektieren, sodass BL aktuellen Stand sieht
73. Als **System** möchte ich bei Job-Failures Retry-Logic haben (max 3 Versuche), sodass temporäre Fehler kompensiert werden
74. Als **System** möchte ich Error Messages in Lead speichern, sodass Fehlerdiagnose möglich ist
75. Als **Developer** möchte ich Background Job Logs sehen können, sodass Debugging möglich ist

### Audit Trail

76. Als **Admin** möchte ich alle BL-Entscheidungen in `auditTrails` loggen (BID/NO-BID, Reasoning, Timestamp), sodass Compliance gewährleistet ist
77. Als **Admin** möchte ich Status-Changes tracken (routed → full_scanning → bl_reviewing → bid_voted), sodass Workflow-History sichtbar ist
78. Als **Admin** möchte ich BL Overrides tracken (falls BL von AI-Empfehlung abweicht), sodass Abweichungen analysiert werden können

### Analytics & Reporting

79. Als **Admin** möchte ich BID/NO-BID Rate pro BL sehen, sodass Entscheidungs-Patterns analysiert werden können
80. Als **Admin** möchte ich Durchschnittliche Lead Time (Phase 2) sehen, sodass Performance optimiert werden kann
81. Als **Admin** möchte ich Top Rejection Reasons sehen, sodass Pattern erkennbar sind
82. Als **Admin** möchte ich Scan Success Rate sehen (completed vs failed), sodass Agent-Qualität überwacht wird

---

## Implementation Decisions

### Architektur & Datenmodell

**Lead-Entity als zentrale Phase 2 Entität:**
- `leads` table ist bereits im Schema vorhanden
- Status-Enum: `routed | full_scanning | bl_reviewing | bid_voted | archived`
- Denormalisierte Daten vom RFP (customerName, industry, websiteUrl, projectDescription, budget, requirements) für schnellen Zugriff
- Foreign Keys: `rfpId` (Source), `businessUnitId` (Routing), `blVotedByUserId` (Decision Maker)

**Agent Output Tables:**
- `websiteAudits` - Full-Scan Results (Tech Stack, Performance, Screenshots)
- `ptEstimations` - PT Schätzung mit Phasen/Disziplinen
- `cmsMatchResults` - CMS Ranking mit Scores
- `referenceMatches` - Reference Project Matches
- Alle mit Foreign Key `leadId` verknüpft

**Workflow-Status Transitions:**
```
RFP (status: routed)
  ↓ [Automatische Lead-Erstellung]
Lead (status: routed)
  ↓ [Deep-Scan Agents starten]
Lead (status: full_scanning)
  ↓ [Agents abgeschlossen]
Lead (status: bl_reviewing)
  ↓ [BL trifft Entscheidung]
Lead (status: bid_voted) → BID → Phase 3
  ↓ [NO-BID]
Lead (status: archived)
```

### Agent Implementation

**Full-Scan Agent:**
- Wiederverwendung von `lib/full-scan/actions.ts` (bereits implementiert)
- `crawlWebsite()` für Website Crawling (max 10 Seiten)
- Tech Stack Detection via `tech-stack-detection.ts`
- Ergebnisse in `websiteAudits` table
- Async Execution mit Progress Tracking

**Content Architecture Agent:**
- Neue Implementierung in `lib/agents/content-architecture-agent.ts`
- Nutzt Full-Scan Ergebnisse (crawledPages) als Input
- Analysiert Navigation Structure, Content Types, Site Tree
- Schätzt Page Count basierend auf Sitemap/Crawl-Daten
- Speichert in `websiteAudits` table (contentTypes, navigationStructure, siteTree, pageCount)

**Migration Complexity Agent:**
- Neue Implementierung in `lib/agents/migration-complexity-agent.ts`
- Input: Tech Stack (von Full-Scan), Content Volume (von Content Architecture)
- Berechnet Complexity Score (0-100) basierend auf:
  - CMS Complexity (WordPress: 20, Drupal: 40, Custom: 80)
  - Content Volume (Pages, Assets)
  - Custom Features (detected via Tech Stack)
- Kategorisiert: low (0-30), medium (31-60), high (61-85), very_high (86-100)
- Speichert in `websiteAudits` table (migrationComplexity, complexityScore, complexityFactors, migrationRisks)

**Accessibility Audit Agent:**
- Neue Implementierung in `lib/agents/accessibility-audit-agent.ts`
- Nutzt Playwright + Axe-core für WCAG 2.1 AA Checks
- Generiert Accessibility Score (0-100)
- Kategorisiert Violations (critical/serious/moderate)
- Schätzt Fix Hours basierend auf Violation Count
- Speichert in `websiteAudits` table (accessibilityScore, wcagLevel, a11yViolations, a11yIssueCount, estimatedFixHours)

**Agent Orchestration:**
1. Lead erstellt → Status `routed`
2. Full-Scan Agent startet → Status `full_scanning`
3. Full-Scan completed → Content/Migration/A11y Agents parallel starten
4. Alle Agents completed → Status `bl_reviewing`
5. Fehlerhandling: Einzelne Agent-Failures führen nicht zu Gesamt-Failure (graceful degradation)

### BL Review Interface

**Leads-Bereich (separater Raum):**
- Route: `/leads` (Liste aller Leads für BL's BU)
- Route: `/leads/[id]` (Lead Overview)
- Route: `/leads/[id]/website-audit` (Detaillierte Website Audit Ansicht)
- Route: `/leads/[id]/estimation` (PT Estimation Breakdown)
- Route: `/leads/[id]/decision` (BID/NO-BID Voting Interface)

**UI Components:**
- `LeadStatusBadge` - Status-Anzeige mit Farben (routed: gray, full_scanning: blue, bl_reviewing: yellow, bid_voted: green, archived: red)
- `WebsiteAuditCard` - Zusammenfassung Tech Stack, Performance, A11y
- `PTEstimationChart` - Phasen-Breakdown als Stacked Bar Chart (ShadCN `chart-bar-stacked`)
- `CMSMatchMatrix` - Tabelle mit Feature-Scoring (ähnlich wie `cms-evaluation-matrix`)
- `ReferenceMatchList` - Top 5 References als Cards (ShadCN `card`)
- `BIDDecisionForm` - Vote + Confidence Slider + Reasoning Textarea

**Datenfluss:**
```
Server Component (Lead Page)
  ↓ [db.select() joins]
Lead + WebsiteAudit + PTEstimation + CMSMatches + ReferenceMatches
  ↓ [Props]
Client Components (Cards + Charts)
  ↓ [User Interaction: BID/NO-BID Vote]
Server Action (updateLeadDecision)
  ↓ [db.update()]
Lead (status: bid_voted, blVote, blReasoning, blConfidenceScore)
  ↓ [Redirect]
Phase 3 oder Archive
```

### PT Estimation Logic

**Baseline Matching:**
- `technologies` table enthält `baselineHours` und `baselineEntityCounts`
- Matching: CMS aus Full-Scan → Technology Record
- Baseline nicht gefunden → Fallback auf Default (z.B. Drupal Standard Baseline)

**Delta Calculation:**
```typescript
interface DeltaCalculation {
  deltaContentTypes: number; // detected - baseline
  deltaParagraphs: number;
  deltaTaxonomies: number;
  deltaViews: number;
  deltaCustomModules: number;
}

additionalPT =
  deltaContentTypes * 20h +
  deltaParagraphs * 8h +
  deltaTaxonomies * 5h +
  deltaViews * 15h +
  deltaCustomModules * 40h;

totalPT = baselineHours + additionalPT;
```

**Phasen-Breakdown (Standard-Verteilung):**
- Discovery & Planning: 10%
- Infrastructure Setup: 8%
- Content Architecture: 20%
- Theme Development: 18%
- Custom Development: 25%
- Migration: 15%
- Testing & QA: 12%
- Training & Handover: 7%

**Discipline Matrix (Standard-Verteilung):**
- Architect: 15%
- Senior Developer: 40%
- Junior Developer: 25%
- Designer/UX: 10%
- QA: 10%

### CMS Matching Logic

**Scoring-Gewichtung:**
- Feature Score: 40%
- Industry Score: 20%
- Size Score: 15%
- Budget Score: 15%
- Migration Score: 10%

**Feature Matching:**
- Required Features aus RFP Requirements extrahieren
- Pro CMS: Feature-Support aus `technologies.features` abrufen
- Feature Match % = (Supported Features / Required Features) * 100

**Industry Matching:**
- Industry aus Lead extrahieren
- Pro CMS: `targetAudiences` aus `technologies` table
- Industry Fit = Fuzzy Match Score (0-100)

### Background Job Tracking

**Verwendung von `backgroundJobs` table:**
- `jobType`: `'deep-analysis'`
- `rfpId`: Lead ID (für Rückwärtskompatibilität)
- `status`: `pending | running | completed | failed`
- `progress`: 0-100 (%)
- `currentStep`: "Full-Scan läuft..." / "Content Architecture läuft..." etc.
- `result`: JSON mit Agent Outputs
- `errorMessage`: Fehler-Details bei Failure

**Job-Update Flow:**
```typescript
// 1. Job erstellen
const job = await db.insert(backgroundJobs).values({
  jobType: 'deep-analysis',
  rfpId: leadId,
  userId: session.user.id,
  status: 'pending',
  progress: 0
});

// 2. Full-Scan Start
await db.update(backgroundJobs).set({
  status: 'running',
  currentStep: 'Full-Scan Agent läuft...',
  progress: 10
});

// 3. Full-Scan Complete
await db.update(backgroundJobs).set({
  currentStep: 'Content/Migration/A11y Agents laufen...',
  progress: 50
});

// 4. Alle Agents Complete
await db.update(backgroundJobs).set({
  status: 'completed',
  progress: 100,
  result: JSON.stringify({ websiteAuditId, ptEstimationId })
});
```

### Testing Strategy

**Unit Tests (Vitest):**
- Agent Logic isoliert testen (Content Architecture, Migration Complexity, A11y)
- PT Estimation Calculations testen (Delta, Phasen, Disziplinen)
- CMS Matching Score Berechnung testen

**Integration Tests:**
- Full-Scan Agent mit Mock Website testen
- Lead Creation + Agent Orchestration testen
- BL Decision Flow testen (BID/NO-BID)

**E2E Tests (Playwright):**
- Lead Overview Page laden
- Website Audit Card prüfen
- PT Estimation Chart prüfen
- BID/NO-BID Vote durchführen
- Status-Transition verifizieren (bl_reviewing → bid_voted)

**Test Data:**
- Mock Website für Crawling (lokaler HTTP Server)
- Mock Technology Records mit Baseline-Daten
- Mock Reference Projects für Matching

---

## Testing Decisions

**Gute Tests für Phase 2:**
- Testen **externe Behavior**, nicht interne Implementation
- Fokus auf **Agent Outputs** (WebsiteAudit, PTEstimation, CMSMatch), nicht wie Agents intern arbeiten
- **Status-Transitions** verifizieren (routed → full_scanning → bl_reviewing → bid_voted)
- **BL Decision Logic** testen (Vote speichern, Confidence validieren, Reasoning required)

**Modules die getestet werden:**
1. **Agent Orchestrator** (`lib/agents/orchestrator.ts`)
   - Startet Full-Scan, dann Content/Migration/A11y parallel
   - Fehlerhandling bei Agent Failures
   - Status-Updates in Lead

2. **PT Estimation Module** (`lib/estimations/pt-calculator.ts`)
   - Baseline Matching
   - Delta Calculation
   - Phasen/Disziplinen Breakdown

3. **CMS Matching Module** (`lib/cms-matching/matcher.ts`)
   - Feature Scoring
   - Industry Matching
   - Ranking Logic

4. **BL Decision Actions** (`lib/leads/decision-actions.ts`)
   - Vote Validation (BID/NO-BID, Confidence 0-100)
   - Reasoning Required Check
   - Status Update (bid_voted oder archived)
   - Audit Trail Logging

**Prior Art:**
- `__tests__/lib/full-scan/website-crawler.test.ts` - Website Crawling Tests
- `__tests__/lib/cms-matching/actions.test.ts` - CMS Matching Tests
- `__tests__/e2e/rfp-detail-view.spec.ts` - E2E Tests für RFP Detail View (als Vorlage für Lead View)

**Test Coverage Ziel:** 80%+ für neue Module

---

## Out of Scope

### Phase 2 Scope NICHT enthalten:

1. **Team Staffing (Phase 3)**
   - Automatische Team-Zuweisung
   - Skill Matching gegen Employee Pool
   - Team Notifications
   → Wird in separatem Epic behandelt

2. **Advanced Decision Tree**
   - Multi-Stakeholder Approval
   - Kriterien-basiertes Scoring (mit Gewichtung)
   - Decision Workflows mit Approvals
   → Simple BID/NO-BID Vote ist ausreichend für MVP

3. **Real-time Agent Streaming UI**
   - Live Agent Activity Stream
   - Reasoning Display während Agent läuft
   - Tool Call Visualization
   → Background Job mit Progress Updates ist einfacher und robuster

4. **Competitive Intelligence**
   - Competitor Matching gegen Lead (bereits im Schema, aber nicht implementiert)
   - Web Search für Wettbewerber
   → Zu aufwendig für Phase 2, kann später ergänzt werden

5. **Advanced Baseline Comparison**
   - `baselineComparisons` table existiert, aber detaillierte Comparison UI fehlt
   - Granulare Entity-Level Deltas (Content Types, Paragraphs, Taxonomies, Views)
   → PT Estimation nutzt vereinfachte Delta-Logik für MVP

6. **Legal Compliance Audit**
   - GDPR Compliance Check
   - Cookie Banner Analysis
   - Impressum/Datenschutz Prüfung
   → `websiteAudits.legalCompliance` field existiert, aber Agent nicht implementiert

7. **SEO Audit**
   - Meta Tags Analyse
   - Sitemap Check
   - PageSpeed Insights Integration
   → `websiteAudits.seoScore` field existiert, aber Agent nicht implementiert

8. **Custom Migration Strategy**
   - Content Migration Skripte generieren
   - Redirect Mapping erstellen
   - Data Validation Checks
   → Migration Complexity wird geschätzt, aber keine Implementierungs-Details

9. **Cost Estimation**
   - 5-Jahres TCO Berechnung
   - Hosting Cost Estimation
   - License Cost Tracking
   → PT Estimation liefert Hours, aber keine Euro-Beträge

10. **Interactive Decision Support**
    - "Request More Info" Flow (Schema vorhanden, aber UI nicht implementiert)
    - Back-and-forth Chat mit BD
    - Conditional Questions basierend auf Scan Results
    → Einfacher One-Shot Decision Flow für MVP

---

## Further Notes

### Technische Abhängigkeiten

**Existierende Implementierung nutzen:**
- `lib/full-scan/actions.ts` - Full-Scan Agent (DEA-39 implementiert)
- `lib/full-scan/website-crawler.ts` - Website Crawling
- `lib/full-scan/tech-stack-detection.ts` - Tech Stack Detection
- `lib/cms-matching/actions.ts` - CMS Evaluation (teilweise implementiert)
- `components/bids/cms-evaluation-matrix.tsx` - CMS Matrix UI (für Leads anpassbar)

**Neue Module benötigt:**
- `lib/agents/content-architecture-agent.ts` - Content Architecture Analysis
- `lib/agents/migration-complexity-agent.ts` - Migration Complexity Scoring
- `lib/agents/accessibility-audit-agent.ts` - WCAG Compliance Check
- `lib/agents/orchestrator.ts` - Agent Orchestration Logic
- `lib/estimations/pt-calculator.ts` - PT Estimation mit Baseline Matching
- `lib/leads/actions.ts` - Lead CRUD + Decision Actions
- `lib/leads/conversion.ts` - RFP → Lead Conversion Logic

**UI Routes benötigt:**
- `app/(dashboard)/leads/page.tsx` - Lead List (gefiltert nach BL's BU)
- `app/(dashboard)/leads/[id]/page.tsx` - Lead Overview (bereits vorhanden, erweitern)
- `app/(dashboard)/leads/[id]/website-audit/page.tsx` - Website Audit Details
- `app/(dashboard)/leads/[id]/estimation/page.tsx` - PT Estimation Breakdown
- `app/(dashboard)/leads/[id]/decision/page.tsx` - BID/NO-BID Voting Interface

### Performance Überlegungen

**Background Job Optimierung:**
- Agents parallel starten (Content/Migration/A11y) spart ~30% Zeit vs. sequentiell
- Crawling auf 10 Seiten limitieren (Trade-off: Schnelligkeit vs. Genauigkeit)
- Redis Caching für Tech Stack Detection Results (gleiche Website mehrfach scannen)
- Timeout für Agents setzen (max 5 Minuten pro Agent)

**Database Queries:**
- Eager Loading: Lead + WebsiteAudit + PTEstimation + CMSMatches in einem Query (JOIN)
- Index auf `leads.businessUnitId` + `leads.status` für BL-Filtered Queries
- Index auf `websiteAudits.leadId` für schnelles Lookup

**UI Performance:**
- Server Components für Lead Overview (kein JavaScript für statische Daten)
- Client Components nur für Interactive Parts (BID/NO-BID Form, Charts)
- Streaming UI mit Suspense für langsame Daten (Screenshots, Large JSONs)

### Migration Path

**Phase 2 Roll-out:**
1. **Week 1-2:** Agent Implementation (Content, Migration, A11y)
2. **Week 3:** Agent Orchestration + Background Jobs
3. **Week 4:** PT Estimation + CMS Matching
4. **Week 5-6:** BL Review UI (Leads-Bereich)
5. **Week 7:** BID/NO-BID Decision Flow
6. **Week 8:** Testing + Bug Fixes
7. **Week 9:** Production Deployment

**Backwards Compatibility:**
- Bestehende RFPs unverändert (Phase 1 funktioniert weiter)
- Lead-Erstellung optional (nur bei BU-Assignment)
- Alte `rfps.status = 'routed'` migrieren zu neuem Lead-Flow (Data Migration Script)

### Monitoring & Observability

**Key Metrics:**
- Deep-Scan Success Rate (completed / total)
- Average Scan Duration (per Agent)
- BL Decision Time (Lead created → Decision made)
- BID/NO-BID Ratio per BL
- PT Estimation Accuracy (später: Actual vs. Estimated)

**Alerts:**
- Deep-Scan Failure Rate > 10%
- Agent Timeout Rate > 5%
- BL Decision Time > 7 Tage (SLA Breach)
- Background Job Queue Length > 20

### Beispiel-Output (Referenz)

**Website Audit ähnlich zu `/audits/audit_lucarnofestival.ch/AUDIT_SUMMARY.md`:**
- Executive Summary mit Budget/Timeline
- Tech Stack (Magnolia CMS 6.3 → Drupal 11)
- Content Architecture (23 Content Types, 35 Components, 12.000 Nodes)
- Performance Audit (Core Web Vitals)
- Accessibility Audit (WCAG 2.1 AA, 75/100 Score)
- PT Estimation (1.870h mit Baseline)
- CMS Comparison (Drupal vs Umbraco vs Magnolia)
- Migration Strategy (Hybrid: Automated + Manual)

**Phase 2 liefert ähnliche Tiefe**, aber strukturiert in DB statt Markdown, und konsumiert von BL UI.

---

**Status:** ✅ PRD komplett - Ready für Implementation Planning
**Nächster Schritt:** Epic in Linear erstellen + Tasks breakdown
