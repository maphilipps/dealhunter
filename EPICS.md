# Dealhunter - Feature Epics

Übersicht der Haupt-Feature-Bereiche für die AI-gestützte BD-Entscheidungsplattform.

---

## EPIC-001: Smart Upload & AI-Extraktion

**Beschreibung:**
Mixed-Format Document Upload mit AI-basierter Extraktion strukturierter Anforderungen.

**Features:**
- Multi-Format Upload (PDF, CRM, Freitext, E-Mail)
- Optional: DSGVO-konforme Dokumentbereinigung (PII-Entfernung)
- AI-Extraktion strukturierter Felder (Customer, Project, Tech, Budget, Timeline)
- User Confirmation/Correction Flow
- Confidence Scoring

**Entities:**
- `BidOpportunity` (inputType, rawInput, extractedRequirements)
- `ExtractedRequirements` Schema
- `CleaningResult` (für DSGVO-Bereinigung)

**Agents:**
- Extraction Agent

**Dependencies:**
- Vercel AI SDK (streamText, tools)
- PDF Parsing Library
- PII Detection/Anonymization

---

## EPIC-002: Bit/No Bit Entscheidung

**Beschreibung:**
Multi-Agent Evaluation System für fundierte Bit/No Bit Empfehlung mit vollständiger Transparenz.

**Features:**
- Multi-Agent Parallel Execution (Tech, Legal Quick, Commercial, Competition, Reference)
- Coordinator Agent für Synthese
- Entscheidungsbaum-Visualisierung (interaktiv, klickbare Nodes)
- Red Flag Detection (Budget, Timeline, Legal, Technical)
- Risk Assessment (Multi-dimensional)
- Vertragstyp-Erkennung & Risikobewertung
- Zuschlagskriterien Deep Analysis
- Alternative Recommendation (bei No Bit)
- Full Chain-of-Thought Transparency

**Entities:**
- `BitDecision` (decision, confidence, reasoning, decisionTree, riskAssessment)
- `DecisionNode` (für Entscheidungsbaum)
- `ContractAnalysis` (Vertragstyp, Risikofaktoren)
- `AwardCriteriaAnalysis` (Zuschlagskriterien)
- `RedFlagAnalysis` (Budget, Timeline, Legal, Technical)
- `RiskAssessment` (Technical, Legal, Commercial, Org, Timeline)

**Agents:**
- Tech Agent
- Legal Agent (Quick Check für BD-Level)
- Commercial Agent
- Competition Agent
- Reference Agent
- Coordinator Agent

**UI Components:**
- Agent Activity Stream (Live Updates)
- Decision Tree Visualization (ShadCN-basiert)
- Risk Assessment Dashboard
- Red Flag Alerts
- Confidence Indicators

**Dependencies:**
- Vercel AI SDK (generateText, generateObject, tools)
- ShadCN UI (Chart, Tree, Badge, Alert)
- Master Data DBs (References, Competencies, Competitors)

---

## EPIC-003: Company Analysis (Two-Phase)

**Beschreibung:**
Zweiphasige Website/Company-Analyse: Quick Scan (für BD) + Deep Migration Analysis (für BL).

**Phase 1: Quick Scan (2-5 Minuten)**
- Tech Stack Detection (CMS, Frameworks, Hosting)
- Content Volume Analysis (Sitemap, Pages)
- Features & Integrations (Forms, E-Commerce, APIs)
- BL Recommendation (AI-basiert)

**Phase 2: Deep Migration Analysis (10-30 Minuten, Background)**
- Content Architecture Mapping (Page Types → Content Types, Components → Paragraphs)
- Migration Complexity Assessment
- Accessibility Audit (WCAG 2.1 Level AA)
- PT-Schätzung basierend auf CMS-Baseline

**Entities:**
- `QuickScan` (status, result: QuickScanResult)
- `QuickScanResult` (techStack, contentVolume, features, blRecommendation)
- `DeepMigrationAnalysis` (status, progress, targetTechnologyId, result)
- `DeepMigrationResult` (contentArchitecture, migrationComplexity, accessibility, estimation)

**Agents:**
- Quick Scan Agent
- Deep Analysis Agent

**Trigger:**
- Phase 1: Nach Upload (automatisch)
- Phase 2: Nach Bit + BL-Zuweisung (Background Job)

**UI Components:**
- Quick Scan Results (Tech Stack Badge, Content Stats)
- Deep Analysis Dashboard (Progress, Architecture, Complexity, A11y)
- PT Estimation with Baseline Comparison

**Dependencies:**
- Web Scraping/Crawling Tools
- CMS Detection Libraries
- Accessibility Testing Tools (axe-core)
- CMS Baselines DB (Drupal adessoCMS, Ibexa, Magnolia, etc.)

---

## EPIC-004: BL-Routing & Team Assignment

**Beschreibung:**
AI-basiertes Routing zu Business Lines und intelligente Team-Zusammenstellung.

**Features:**
- AI-basierte BL-Empfehlung (basierend auf Quick Scan Tech Stack)
- BD kann BL-Override mit Begründung durchführen
- BL-spezifische CMS-Technologie-Zuordnung
- Erweiterte Auswertung für BL (Szenario-basierte Kalkulation)
- AI-Vorschlag für optimales Team (Skills, Verfügbarkeit, Erfahrung)
- Feste Rollen (PM, Architect, Lead Dev, Dev, Consultant, Analyst, QA)
- Team-Größe variabel (2-15+)

**Entities:**
- `BusinessLine` (name, leaderId, technologies, keywords)
- `Technology` (name, baselineHours, baselineName, baselineEntities)
- `ExtendedEvaluation` (scenarioAnalysis, skillMatchScore, recommendedTeamSize)
- `FinancialProjection` (Best, Expected, Worst)
- `Employee` (skills, roles, isAvailable)
- `TeamAssignment` (bidOpportunityId, employeeId, role)
- `AuditTrailEntry` (für BL-Override Tracking)

**Agents:**
- Routing Agent (Teil des Coordinator)

**UI Components:**
- BL Inbox (Opportunities mit Status)
- Extended Evaluation Dashboard (Szenario Cards, Skills Gap)
- Team Builder (Drag & Drop)
- Target CMS Selection

**Dependencies:**
- NLP/Matching Engine
- Employee/Skills Database
- CMS Baselines

---

## EPIC-005: Master Data Management

**Beschreibung:**
Zentrale Datenbanken für Referenzen, Kompetenzen und Wettbewerber - Crowdsourced mit Admin-Validierung.

**Features:**

### Referenzen
- Vergangene Projekte mit Kriterien dokumentieren
- Auto-Matching zu neuen Opportunities
- Jeder BD kann hinzufügen, Admin validiert
- Contact Person, Highlights

### Kompetenzen
- Technologien, Methodiken, Branchen, Soft Skills
- Experten zuordnen (Employee IDs)
- Zertifizierungen tracken
- Projekt-Count automatisch

### Wettbewerber
- Stärken/Schwächen dokumentieren
- Tech-Schwerpunkte, Branchen
- Encounters loggen (gewonnen/verloren gegen)
- Price Level Tracking

**Entities:**
- `Reference` (projectName, customer, tech, scope, outcome)
- `Competency` (name, category, level, experts)
- `Competitor` (name, strengths, weaknesses, recentEncounters)
- `MatchingResult` (references, competencies, competitors)

**UI Components:**
- Master Data Tables (CRUD)
- Validation Workflow (Admin)
- Matching Results Display
- Search/Filter

**Dependencies:**
- Database (PostgreSQL)
- Search Engine (für Matching)

---

## EPIC-006: Legal & Compliance

**Beschreibung:**
Zwei-Stufen Legal Agent: Quick Check (BD-Level) + Umfassende Prüfung (BL-Level).

**BD-Level (Quick Check):**
- Kritische Red Flags (Haftung, Pönalen, IP)
- Compliance Hints
- Requires Detailed Review Flag

**BL-Level (Umfassend):**
- Vollständige Vertragsprüfung
- Vergaberecht (VoB, VgV, UVgO, EU-Schwellenwerte)
- Rahmenverträge (Call-Off Rules)
- Subunternehmer-Regelungen

**Entities:**
- `ContractAnalysis` (contractType, riskLevel, riskFactors)
- `LegalQuickCheck` (criticalFlags, complianceHints)
- `ComplianceCheck` (procurementLaw, frameworkAgreement, subcontractor)
- `LegalRedFlag` (category, severity, description, clauseReference)

**Agents:**
- Legal Agent (zwei Modi: Quick/Full)

**UI Components:**
- Legal Red Flag Alerts
- Compliance Checklist
- Contract Type Badge
- Risk Severity Indicators

**Dependencies:**
- Legal Document Analysis (NLP)
- Compliance Rules DB

---

## EPIC-007: Notifications & Handoff

**Beschreibung:**
Automatische E-Mail-Benachrichtigungen an Team-Mitglieder mit PDF-Attachment.

**Features:**
- E-Mail Template für Team-Benachrichtigungen
- PDF Generation (Kundeninfo, Projekt, Scope, Timeline, Team, Next Steps)
- BL-Benachrichtigung bei Deep Analysis Completion
- Team-Benachrichtigungs-Tracking (notifiedAt)

**Entities:**
- `TeamAssignment` (notifiedAt)
- `BidOpportunity` (teamNotifiedAt)

**Email Template:**
```
Betreff: [Dealhunter] Angebotsteam für {CustomerName}

Hallo {Name},

du wurdest von {BL-Name} in das Angebotsteam für {CustomerName} aufgenommen.

Deine Rolle: {Role}

Im Anhang findest du alle wichtigen Informationen zum Projekt.

Beste Grüße,
{BL-Name}
```

**UI Components:**
- Notify Button (BL View)
- Notification Status Indicator

**Dependencies:**
- Email Service (z.B. Nodemailer, Resend)
- PDF Generation Library (z.B. Puppeteer, React-PDF)

---

## EPIC-008: Admin & Analytics

**Beschreibung:**
Admin Panel für System-Konfiguration und Analytics Dashboard für Management Insights.

**Admin Features:**
- Business Lines CRUD (Name, Leader, Technologies, Keywords)
- Technologies CRUD (CMS mit Baselines: Hours, Entities)
- Employees CRUD (Skills, Roles, Availability)
- Master Data Validation (Referenzen, Kompetenzen, Wettbewerber)
- Audit Trail Viewer (Overrides, Status Changes)

**Analytics Features:**
- Bit Rate (% Bit vs No Bit)
- Time to Decision (Durchschnitt)
- Per BL Stats (Verteilung)
- Source Distribution (Reactive vs Proactive)
- Stage Distribution (Cold/Warm/RFP)
- Pipeline Funnel (Draft → Bit → Assigned → Notified)

**Entities:**
- `BusinessLine`, `Technology`, `Employee`
- `AuditTrailEntry`
- Analytics Aggregation Queries

**UI Components:**
- Admin Tables (ShadCN Data Table)
- Charts (ShadCN Chart: Pie, Bar, Line, Funnel)
- Stats Cards (Badge, Progress)
- Audit Trail Table

**Dependencies:**
- Database Aggregations
- ShadCN UI (Data Table, Charts)
- Recharts (via ShadCN)

---

## EPIC-009: Account Management

**Beschreibung:**
Kunden-Hierarchie für bessere Opportunities-Verwaltung.

**Features:**
- Account erstellen/bearbeiten/löschen
- Opportunities einem Account zuordnen
- Account-Detail View (alle Opportunities eines Kunden)
- Account-basierte Dashboard-Ansicht
- Industry, Website, Notes tracking

**Entities:**
- `Account` (name, industry, website, opportunities)

**UI Components:**
- Account List (ShadCN Table)
- Account Detail (Card mit Opportunities)
- Account Selector (bei Bid Creation)
- Dashboard: Gruppierung nach Account

**Dependencies:**
- Database Relations (Account ↔ BidOpportunity)

---

## EPIC-010: Agent Native Transparency

**Beschreibung:**
Vollständige Sichtbarkeit aller AI-Aktionen basierend auf Agent Native Prinzipien.

**Features:**
- Full Chain-of-Thought Display
- Real-time Agent Activity Stream
- Tool Call Transparency (Input/Output sichtbar)
- Confidence Level Indicators (High/Medium/Low)
- Abort-Mechanismus (graceful shutdown)
- Expandable Thought Bubbles
- Multi-Agent Progress Tracking

**Entities:**
- `AgentActivityEvent` (type: thought/tool_call/tool_result/decision/error)

**UI Components:**
- Agent Activity Log (Live Stream)
- Agent Thought Bubble (Expandable)
- Confidence Indicator (Color-coded)
- Abort Button (graceful shutdown)
- Multi-Agent Progress Bars

**AI SDK Elements:**
- `<Conversation>` - Agent Activity Stream
- `<Message>` - Individual Agent Outputs
- `<Reasoning>` - Chain-of-Thought Display
- `<Sources>` - Referenced Data
- `<Loader>` - Processing States

**Dependencies:**
- Vercel AI SDK UI (`@ai-sdk/react`)
- SSE (Server-Sent Events) für Live Updates

---

## Implementation Priority (Empfohlen)

1. **EPIC-001** - Smart Upload & AI-Extraktion (Foundation)
2. **EPIC-005** - Master Data Management (benötigt für Matching)
3. **EPIC-002** - Bit/No Bit Entscheidung (Core Feature)
4. **EPIC-004** - BL-Routing & Team Assignment
5. **EPIC-003** - Company Analysis (Two-Phase)
6. **EPIC-006** - Legal & Compliance
7. **EPIC-007** - Notifications & Handoff
8. **EPIC-009** - Account Management
9. **EPIC-008** - Admin & Analytics
10. **EPIC-010** - Agent Native Transparency (parallel zu allen)

---

## Tech Stack Overview

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **AI Core** | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) |
| **UI System** | ShadCN UI (Sidebar, Charts, Tables, Forms, Dialogs) |
| **AI UI** | AI SDK Elements (Conversation, Message, Reasoning) |
| **Styling** | Tailwind CSS v4 |
| **Database** | Drizzle ORM (PostgreSQL) |
| **Queue** | BullMQ (Background Jobs) |
| **Cache** | Redis |
| **Charts** | Recharts (via ShadCN) |
| **Email** | Nodemailer / Resend |
| **PDF** | Puppeteer / React-PDF |

---

**Status**: Ready for Implementation Planning
**Last Updated**: 2026-01-16
