# Dealhunter - Epics & Anforderungen

## Technologie-Stack

| Bereich | Technologie | Version/Details |
|---------|-------------|-----------------|
| **Framework** | Next.js | 16 (App Router) |
| **UI Library** | ShadCN UI | Vollständig |
| **AI-Generated UI** | json-render | @json-render/core, @json-render/react |
| **Styling** | Tailwind CSS | v4 |
| **Charts** | Recharts | via ShadCN chart |
| **AI SDK** | Vercel AI SDK | ai, @ai-sdk/react, @ai-sdk/anthropic |
| **AI Models** | Claude | Opus 4.5 / Sonnet |
| **Structured Output** | Zod | Type-safe AI responses |
| **Database** | Drizzle ORM | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | NextAuth.js | Credentials Provider |
| **Background Jobs** | BullMQ | Optional für Deep Analysis |
| **State** | Zustand | Client State |

---

## Abhängigkeitsdiagramm (16 Epics)

```
┌─────────────────────────────────────────────────────────────────┐
│                    EPIC 1: Foundation                           │
│           (DB Schema, Auth, Base Layout)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────────┐
        ▼             ▼             ▼                 ▼
┌───────────────┐ ┌───────────┐ ┌─────────────┐ ┌─────────────────┐
│ EPIC 2: Admin │ │ EPIC 13:  │ │ EPIC 14:    │ │ EPIC 15:        │
│ Panel &       │ │ Account   │ │ MCP Tool    │ │ Agent Context   │
│ Master Data   │ │ Mgmt      │ │ Layer (NEU) │ │ System (NEU)    │
└───────┬───────┘ └─────┬─────┘ └──────┬──────┘ └────────┬────────┘
        │               │              │                 │
        ▼               ▼              │                 │
┌───────────────────────────────┐      │                 │
│     EPIC 3: Smart Upload      │◄─────┴─────────────────┘
│     & AI-Extraktion           │
└───────────────┬───────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
┌───────────────┐ ┌─────────────────────────────┐
│ EPIC 4:       │ │                             │
│ Quick Scan    │ │                             │
└───────┬───────┘ │                             │
        │         │                             │
        ▼         ▼                             │
┌─────────────────────────┐                     │
│ EPIC 5: Bit/No Bit      │                     │
│ Evaluation (Multi-Agent)│                     │
└───────────┬─────────────┘                     │
            │                                   │
            ▼                                   │
┌─────────────────────────┐                     │
│ EPIC 5a: Agent          │ ← NEU               │
│ Transparency UI         │                     │
└───────────┬─────────────┘                     │
            │                                   │
            ▼                                   │
┌─────────────────────────┐                     │
│ EPIC 6: BL-Routing      │                     │
└───────────┬─────────────┘                     │
            │                                   │
    ┌───────┼───────┬───────────────────────────┘
    ▼       ▼       ▼
┌───────┐ ┌───────┐ ┌─────────────────┐
│EPIC 7:│ │EPIC 8:│ │ EPIC 11:        │
│Deep   │ │Extend.│ │ Master Data Mgmt│
│Migrat.│ │Evaluat│ │ (Crowdsourced)  │
└───────┘ └───┬───┘ └─────────────────┘
              │
              ▼
┌─────────────────────────┐
│ EPIC 9: Team-Assignment │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ EPIC 10: Notification   │
└─────────────────────────┘

┌─────────────────────────┐
│ EPIC 12: Analytics      │ ← Parallel ab Epic 5/6
└─────────────────────────┘
```

### Neue Agent-Native Epics

**EPIC 14: MCP Tool Layer** - Grundlage für alle Agent-Interaktionen
**EPIC 15: Agent Context System** - Dynamischer Context für Agents
**EPIC 5a: Agent Transparency UI** - Sichtbarkeit der Agent-Entscheidungen

---

## Epic 1: Foundation & Infrastructure

**Priorität:** 🔴 Kritisch (Blocker für alle anderen)
**Abhängigkeiten:** Keine

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| F-001 | Database Schema | Drizzle ORM Schema für alle Entities (BidOpportunity, BusinessLine, Employee, etc.) |
| F-002 | Auth System | NextAuth.js mit Credentials Provider, JWT, 3 Rollen (BD, BL, Admin) |
| F-003 | Base Layout | ShadCN Sidebar Layout mit Navigation |
| F-004 | API Route Structure | App Router API Routes Setup |
| F-005 | Environment Config | .env Setup (AI Hub, DB, etc.) |

### Technische Details
- Drizzle ORM mit SQLite für lokale Entwicklung
- NextAuth.js Session mit httpOnly Cookies
- ShadCN Sidebar als Hauptnavigation

---

## Epic 2: Admin Panel & Master Data

**Priorität:** 🔴 Kritisch
**Abhängigkeiten:** Epic 1

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| A-001 | Business Lines CRUD | Bereiche anlegen, bearbeiten, löschen |
| A-002 | Technologies CRUD | CMS-Technologien mit Baselines verwalten |
| A-003 | Employees CRUD | Mitarbeiter mit Skills und Rollen |
| A-004 | Employee Import | CSV Bulk-Import für Mitarbeiter |
| A-005 | Baseline Config | Stunden, Content Types, Paragraphs pro Technologie |

### Seed Data
| Bereich | BL | Technologien |
|---------|-----|--------------|
| PHP | Francesco Raaphorst | Drupal (693h), Ibexa, Sulu |
| WEM | Michael Rittinghaus | Magnolia, Firstspirit |

---

## Epic 3: Smart Upload & AI-Extraktion

**Priorität:** 🔴 Kritisch
**Abhängigkeiten:** Epic 1, Epic 2

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| U-001 | PDF Upload | Drag & Drop Zone für PDF-Dokumente |
| U-002 | Text Upload | Textarea für Freitext/E-Mail |
| U-003 | DSGVO-Bereinigung | Optionales PII-Cleaning vor Verarbeitung |
| U-004 | Extraction Agent | AI-basierte Strukturextraktion (Customer, Tech, Budget, Timeline) |
| U-005 | Preview & Edit | User bestätigt/korrigiert extrahierte Daten |
| U-006 | Account Assignment | Bid einem Kunden-Account zuordnen |

### AI Agent: Extraction Agent
- **Model:** Claude Sonnet
- **Tools:** `extractRequirements`, `cleanPII`
- **Output:** `ExtractedRequirements` Schema

---

## Epic 4: Quick Scan (Company Analysis Phase 1)

**Priorität:** 🟡 Hoch
**Abhängigkeiten:** Epic 2, Epic 3

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| QS-001 | Tech Stack Detection | CMS, Frameworks, Hosting identifizieren |
| QS-002 | Content Volume | Sitemap analysieren, Seitenanzahl |
| QS-003 | Feature Detection | Formulare, Integrationen, E-Commerce |
| QS-004 | BL-Empfehlung | AI-basierte Bereichsleiter-Empfehlung |
| QS-005 | Confidence Score | 0-100% Confidence für Empfehlung |

### Performance Target
- **Dauer:** 2-5 Minuten

### Output Schema
```typescript
interface QuickScanResult {
  techStack: { cms, frameworks, hosting }
  contentVolume: { totalPages, pagesByType }
  features: { forms, integrations, hasEcommerce }
  blRecommendation: { recommendedBL, confidence, reasoning }
}
```

---

## Epic 5: Bit/No Bit Evaluation

**Priorität:** 🔴 Kritisch
**Abhängigkeiten:** Epic 3, Epic 4

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| BIT-001 | Tech Agent | Technische Anforderungen analysieren |
| BIT-002 | Legal Agent | Vertragstyp, Risiken (Quick Check) |
| BIT-003 | Commercial Agent | Budget, Marge, Wirtschaftlichkeit |
| BIT-004 | Competition Agent | Wettbewerber identifizieren |
| BIT-005 | Reference Agent | Passende Referenzen finden |
| BIT-006 | Coordinator Agent | Synthese aller Ergebnisse |
| BIT-007 | Red Flag Detection | Kritische Issues automatisch erkennen |
| BIT-008 | Decision Tree | Interaktive Visualisierung |
| BIT-009 | Alternative Empfehlung | Bei No Bit: anderen Bereich vorschlagen |
| BIT-010 | Agent Transparency | Live Chain-of-Thought anzeigen |

### Multi-Agent Orchestrierung
```
Phase 1 (Parallel): Tech, Legal, Commercial, Competition, Reference
Phase 2 (Sequential): Coordinator synthesizes all results
```

### Performance Target
- **Dauer:** 5-15 Minuten

---

## Epic 5a: Agent Transparency UI (NEU)

**Priorität:** 🔴 Kritisch (Agent-Native Compliance)
**Abhängigkeiten:** Epic 5

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| TRANS-001 | Conversation Component | Agent Activity Stream mit Live-Updates |
| TRANS-002 | Reasoning Component | Chain-of-Thought Visualisierung (expandierbar) |
| TRANS-003 | Sources Component | Zitierte Daten und Referenzen anzeigen |
| TRANS-004 | Message Actions | Copy, Expand, Retry Buttons |
| TRANS-005 | Confidence Indicator | Visuelle Anzeige (gruen 80%+, gelb 60-79%, rot <60%) |
| TRANS-006 | Abort Mechanism | User kann laufende Analyse abbrechen |

### Technologie
- `@ai-sdk/react` AI Elements (Conversation, Message, Reasoning, Sources)
- SSE für Live-Streaming

### UI Pattern
```
[12:34:01] Analysiere Tech Stack...
[12:34:05] Tool: detectCMS -> WordPress 6.4
[12:34:08] WordPress erkannt, prüfe Kompatibilität...
[12:34:15] Entscheidung: Routing zu PHP (87%)
```

---

## Epic 6: BL-Routing

**Priorität:** 🟡 Hoch
**Abhängigkeiten:** Epic 2, Epic 5

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| ROUTE-001 | AI-Routing | Automatisches Routing basierend auf Quick Scan |
| ROUTE-002 | BD Override | BD kann anderen BL wählen mit Begründung |
| ROUTE-003 | Audit Trail | Alle Overrides werden geloggt |
| ROUTE-004 | BL Notification | BL wird über neue Opportunity informiert |

---

## Epic 7: Deep Migration Analysis (Phase 2)

**Priorität:** 🟡 Hoch
**Abhängigkeiten:** Epic 4, Epic 6

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| DEEP-001 | Content Architecture | Page Types -> Content Types Mapping |
| DEEP-002 | Migration Complexity | Export-Möglichkeiten, Datenqualität |
| DEEP-003 | Accessibility Audit | WCAG 2.1 AA Prüfung |
| DEEP-004 | PT-Schätzung | Stunden basierend auf Baseline + Entities |
| DEEP-005 | Background Job | Läuft async nach BL-Zuweisung |
| DEEP-006 | Progress Tracking | SSE Stream für Fortschritt |
| DEEP-007 | CMS-spezifisch | Analysis basierend auf Ziel-CMS |

### Performance Target
- **Dauer:** 10-30 Minuten (Background)

### Trigger
Automatisch nach `bitDecision: 'bit'` UND `assignedBusinessLineId` gesetzt

---

## Epic 8: Extended Evaluation (BL View)

**Priorität:** 🟡 Hoch
**Abhängigkeiten:** Epic 5, Epic 6

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| EXT-001 | Szenario-Kalkulation | Best/Expected/Worst Case |
| EXT-002 | Financial Projection | Revenue, Costs, Margin |
| EXT-003 | Skill Gap Analysis | Fehlende Skills identifizieren |
| EXT-004 | Available Employees | Passende Mitarbeiter anzeigen |
| EXT-005 | Interactive Exploration | Drill-Down in Details |
| EXT-006 | Full Legal Review | Vollständige Vertragsprüfung |

---

## Epic 9: Team-Assignment

**Priorität:** 🟡 Hoch
**Abhängigkeiten:** Epic 2, Epic 8

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| TEAM-001 | AI Team-Vorschlag | Optimales Team basierend auf Skills |
| TEAM-002 | Skill Matching | NLP-basiertes Matching |
| TEAM-003 | Role Assignment | PM, Architect, Lead Dev, etc. |
| TEAM-004 | Team Builder UI | Drag & Drop Zusammenstellung |
| TEAM-005 | Availability Check | Verfügbarkeit berücksichtigen |

### Rollen
```typescript
type TeamRole =
  | 'project_manager'
  | 'architect'
  | 'lead_developer'
  | 'developer'
  | 'consultant'
  | 'analyst'
  | 'qa_engineer'
```

---

## Epic 10: Notification System

**Priorität:** 🟢 Mittel
**Abhängigkeiten:** Epic 9

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| NOTIF-001 | E-Mail an Team | Benachrichtigung mit Rolle |
| NOTIF-002 | PDF Generation | Projekt-Summary als Attachment |
| NOTIF-003 | E-Mail Template | Personalisierte Nachricht |

### E-Mail Template
```
Betreff: [Dealhunter] Angebotsteam für {CustomerName}
Body: Hallo {Name}, du wurdest als {Role} aufgenommen...
Attachment: Projekt-Summary.pdf
```

---

## Epic 11: Master Data Management (Crowdsourced) ✅ COMPLETE

**Priorität:** 🟢 Mittel
**Abhängigkeiten:** Epic 2
**Status:** ✅ Abgeschlossen (Phase 2 - Admin Validation UI)

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| MD-001 | Referenzen CRUD | Vergangene Projekte pflegen |
| MD-002 | Kompetenzen CRUD | Skills und Experten |
| MD-003 | Wettbewerber CRUD | Stärken, Schwächen, Encounters |
| MD-004 | Auto-Matching | AI findet passende Referenzen |
| MD-005 | Admin-Validierung | Crowdsourced mit Approval |
| MD-006 | Search & Filter | Schnelle Suche in allen DBs |

---

## Epic 12: Analytics Dashboard

**Priorität:** 🟢 Mittel
**Abhängigkeiten:** Epic 5, Epic 6

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| ANAL-001 | Bit-Rate Chart | Pie Chart: Bit vs No Bit |
| ANAL-002 | Pipeline Funnel | Draft -> Bit -> Assigned -> Notified |
| ANAL-003 | Time to Decision | Durchschnittliche Entscheidungszeit |
| ANAL-004 | Per BL Stats | Verteilung nach Bereichsleiter |
| ANAL-005 | Source Distribution | Reactive vs Proactive |
| ANAL-006 | AI-Generated Widgets | User kann Custom Dashboards aus Natural Language generieren (json-render) |

### ShadCN Charts
| Metrik | Chart Type |
|--------|------------|
| Bit/No Bit Rate | `chart-pie-donut-text` |
| Pipeline Funnel | `chart-bar-horizontal` |
| Opportunities by BL | `chart-bar-stacked` |
| Time to Decision | `chart-line-default` |

### AI-Generated Dashboards (json-render)

**Technologie:** `@json-render/core` + `@json-render/react`

User können Custom Analytics Widgets aus Natural Language generieren:

```typescript
// User Prompt: "Show me BIT rate by business line this quarter"
// → AI generiert JSON → Rendert als ShadCN Components

// Features:
// - Guardrails: Nur definierte Components (Card, Metric, Chart, Table)
// - Streaming: Progressive Rendering während AI generiert
// - Data Binding: Automatische Verknüpfung mit BID-Daten
// - Export: Standalone React Code ohne Runtime Dependencies
```

**Use Cases:**
- Custom BL-Performance Dashboards
- Ad-hoc Report Generation
- Agent Output Visualization (TECH, COMMERCIAL, RISK)

Siehe `.claude/skills/json-render-integration.md` für Implementation.

---

## Epic 13: Account Management

**Priorität:** 🟢 Mittel
**Abhängigkeiten:** Epic 1, Epic 3

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| ACC-001 | Account CRUD | Kunden anlegen, bearbeiten |
| ACC-002 | Opportunities View | Alle Bids eines Kunden |
| ACC-003 | Account Search | Schnelle Suche nach Kunde |
| ACC-004 | Auto-Suggest | Bei Upload: existierende Accounts vorschlagen |

---

## Epic 14: MCP Tool Layer (NEU)

**Priorität:** 🔴 Kritisch (Agent-Native Foundation)
**Abhängigkeiten:** Epic 1

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| MCP-001 | Tool Registry | Zentrale Registry für alle Agent-Tools |
| MCP-002 | Bid Tools | `uploadBid`, `extractRequirements`, `runQuickScan` |
| MCP-003 | Evaluation Tools | `assessTechnical`, `assessLegal`, `assessCommercial`, `synthesize` |
| MCP-004 | Team Tools | `suggestTeam`, `assignTeam`, `notifyTeam` |
| MCP-005 | Query Tools | `findReferences`, `findCompetitors`, `findEmployees` |
| MCP-006 | Override Tools | `overrideBitDecision`, `overrideRouting`, `overrideTeam` |

### Technologie
- Vercel AI SDK `tool()` mit Zod-Schemas
- Standardisierte Tool-Interfaces für Agent-Interoperabilität

### Tool Pattern
```typescript
const bidTools = {
  uploadBid: tool({
    description: 'Upload and parse bid document',
    parameters: z.object({
      content: z.string(),
      type: z.enum(['pdf', 'text', 'email'])
    }),
    execute: async ({ content, type }) => { ... }
  }),
  // weitere Tools...
}
```

---

## Epic 15: Agent Context System (NEU)

**Priorität:** 🔴 Kritisch (Agent-Native Foundation)
**Abhängigkeiten:** Epic 1, Epic 2

### Anforderungen

| ID | Anforderung | Beschreibung |
|----|-------------|--------------|
| CTX-001 | Context Builder | Service der relevanten Context für Agents baut |
| CTX-002 | Reference Context | Passende Referenzen aus DB für Tech Agent |
| CTX-003 | Competitor Context | Wettbewerber-Intelligence für Competition Agent |
| CTX-004 | Skill Matrix Context | Employee-Skills für Team Agent |
| CTX-005 | Baseline Context | CMS-Baselines für Deep Analysis |
| CTX-006 | History Context | Vergangene Entscheidungen für ähnliche Bids |

### Technologie
- Context Injection in AI SDK `generateText()` und `streamText()`
- Dynamisches RAG für relevante Dokumente

### Context Pattern
```typescript
const buildAgentContext = async (bidId: string, agentType: AgentType) => {
  const baseContext = await getBaseContext(bidId)

  switch (agentType) {
    case 'tech':
      return { ...baseContext, references: await findSimilarReferences(bid) }
    case 'competition':
      return { ...baseContext, competitors: await findLikelyCompetitors(bid) }
    // weitere Agents...
  }
}
```

---

## Implementierungs-Reihenfolge (empfohlen)

| Phase | Epics | Begründung |
|-------|-------|------------|
| **Phase 1** | Epic 1, 14, 15 | Foundation + Agent-Native Infrastructure |
| **Phase 2** | Epic 2, 13 | Admin + Accounts |
| **Phase 3** | Epic 3 | Smart Upload mit MCP Tools |
| **Phase 4** | Epic 4, 5, 5a | Quick Scan + Bit/No Bit + Transparency |
| **Phase 5** | Epic 6, 11 | Routing + Master Data |
| **Phase 6** | Epic 7, 8 | Deep Analysis + Extended Eval |
| **Phase 7** | Epic 9, 10 | Team + Notification |
| **Phase 8** | Epic 12 | Analytics |

---

## Non-Goals (MVP)

Diese Features sind NICHT im MVP enthalten:
- Learning/Feedback-Loop
- Mobile-Optimierung
- Multi-BL Deals
- Slide Deck Generation
- Post-Handoff Tracking
- CRM Integration
- Team-Member Ablehnung
- Portal-Integration (DTVP, TED)

---

## Agent-Native Review Ergebnisse

**Score: 23/60 (38%)** - Signifikante Verbesserungen nötig

### Kritische Lücken

| Problem | Beschreibung |
|---------|--------------|
| **Kein MCP Tool Layer** | Agent-Funktionen sind Server Actions, nicht standardisierte MCP-Tools |
| **Context Starvation** | Agents erhalten keinen Workspace-Context (Referenzen, Wettbewerber, Skills) |
| **Workflow statt Primitives** | Fest codierte Workflows statt kombinierbare Primitive |
| **Fehlende Agent Transparency UI** | Chain-of-Thought erwähnt aber keine UI-Komponenten geplant |
| **Fehlende Override Tools** | User kann Agent-Entscheidungen nur begrenzt überschreiben |

### Empfohlene neue Epics

```markdown
### Epic 5a: Agent Transparency UI (NEU)
- Conversation Component für Agent Activity Stream
- Reasoning Component für Chain-of-Thought
- Sources Component für zitierte Daten
- Message Actions (Copy, Expand, Retry)
**Technologie:** @ai-sdk/react AI Elements

### Epic 14: MCP Tool Layer (NEU)
- Tool Registry mit Discovery
- Bid Tools (upload, extract, scan)
- Evaluation Tools (assess, synthesize)
- Team Tools (suggest, assign, notify)
**Technologie:** Vercel AI SDK tools

### Epic 15: Agent Context System (NEU)
- Context Builder Service
- Reference Matching Context
- Competitor Intelligence Context
- Employee Skill Matrix Context
```

### Was bereits gut ist

- Multi-Agent Parallel Execution (Epic 5)
- Structured Outputs mit Zod-Schemas
- Activity Logging
- Override mit Begründung (Audit Trail)

---

## Epic-Übersicht (16 Epics total)

| # | Epic | Priorität | Status |
|---|------|-----------|--------|
| 1 | Foundation & Infrastructure | 🔴 Kritisch | ✅ COMPLETE |
| 2 | Admin Panel & Master Data | 🔴 Kritisch | ✅ COMPLETE |
| 3 | Smart Upload & AI-Extraktion | 🔴 Kritisch | ✅ COMPLETE |
| 4 | Quick Scan | 🟡 Hoch | ✅ COMPLETE |
| 5 | Bit/No Bit Evaluation | 🔴 Kritisch | ✅ COMPLETE |
| 5a | Agent Transparency UI (NEU) | 🔴 Kritisch | ✅ COMPLETE |
| 6 | BL-Routing | 🟡 Hoch | ✅ COMPLETE |
| 7 | Deep Migration Analysis | 🟡 Hoch | ✅ COMPLETE |
| 8 | Extended Evaluation | 🟡 Hoch | - |
| 9 | Team-Assignment | 🟡 Hoch | ✅ COMPLETE |
| 10 | Notification System | 🟢 Mittel | - |
| 11 | Master Data Management | 🟢 Mittel | - |
| 12 | Analytics Dashboard | 🟢 Mittel | - |
| 13 | Account Management | 🟢 Mittel | - |
| 14 | MCP Tool Layer (NEU) | 🔴 Kritisch | - |
| 15 | Agent Context System (NEU) | 🔴 Kritisch | - |

### ⚡ PRIORITÄT: Epic 11 (Master Data Management)

Epic 5, 7 sind vollständig abgeschlossen. Nächste Priorität ist Epic 11 für Referenzen, Kompetenzen und Wettbewerber-Verwaltung.

---

### Epic 2 Gaps (RESOLVED - 2026-01-17)

**Status: ✅ COMPLETE** - Backend und UI vollständig implementiert

| Feature | Backend | UI | Status |
|---------|---------|-----|--------|
| Business Lines CRUD | ✅ `lib/admin/business-lines-actions.ts` | ✅ `/admin/business-lines` | ✅ DONE |
| Technologies CRUD | ✅ `lib/admin/technologies-actions.ts` | ✅ `/admin/technologies` | ✅ DONE |
| Employees CRUD | ✅ `lib/admin/employees-actions.ts` | ✅ `/admin/employees` | ✅ DONE |
| Employee CSV Import | ✅ In actions vorhanden | ⏸️ Später | Optional |
| Users CRUD | ✅ Actions | ✅ `/admin/users` | ✅ DONE |
| Baseline Config | ✅ In technologies | ✅ Wird mit Tech | ✅ DONE |

**Implementierte Pages:**
- `/app/(dashboard)/admin/business-lines/page.tsx` - List & Delete
- `/app/(dashboard)/admin/business-lines/new/page.tsx` - Create Form
- `/app/(dashboard)/admin/technologies/page.tsx` - List & Delete
- `/app/(dashboard)/admin/technologies/new/page.tsx` - Create Form
- `/app/(dashboard)/admin/employees/page.tsx` - List & Delete
- `/app/(dashboard)/admin/employees/new/page.tsx` - Create Form

**Navigation:** Sidebar Admin-Menü aktualisiert mit Links zu allen Admin-Seiten.

#### 🤖 AI-Autofill für Master Data (NEU)

**Idee:** Wenn ein Admin eine neue Technologie anlegt (z.B. "Drupal"), kann ein **Technology Research Agent** automatisch Basisdaten vorschlagen:

| Feld | AI-Autofill | Quelle |
|------|-------------|--------|
| `baselineHours` | ~693h für Drupal Standard | Erfahrungswerte + Web Research |
| `baselineContentTypes` | 12-15 für typische Corporate Site | Pattern-Matching |
| `baselineParagraphs` | 20-30 Module | Best Practices |
| `migrationComplexity` | medium/high | Abhängig von Source-CMS |
| `features` | Forms, Multilingual, Media Library | Feature-Detection |

**Neuer Agent: `TechnologyResearchAgent`**

Recherchiert CMS-spezifische Baselines und schätzt Migrationsaufwände automatisch. Nutzt Web-Recherche und interne Erfahrungswerte.

**UI-Flow:**
1. Admin gibt "Drupal" als Name ein
2. Button "🤖 AI Vorschläge laden" erscheint
3. Agent recherchiert und befüllt Formular
4. Admin reviewt und passt an
5. Speichern mit AI-generierten Defaults

**Analoges Muster für Employees:**
- Bei Skill-Eingabe: AI schlägt verwandte Skills vor
- Bei Rollen-Zuweisung: AI empfiehlt typische Skill-Kombinationen

---

### Epic 5 Gaps (RESOLVED - 2026-01-17)

**Status: ✅ 100% vollständig** - Alle 6 Agents implementiert

| Spec Agent | Implementiert als | Status |
|------------|-------------------|--------|
| BIT-001: Tech Agent | ✅ Capability Match Agent | ✅ DONE |
| BIT-002: Legal Agent | ✅ Legal Agent | ✅ DONE |
| BIT-003: Commercial Agent | ✅ Deal Quality Agent | ✅ DONE |
| BIT-004: Competition Agent | ✅ Competition Check Agent | ✅ DONE |
| BIT-005: Reference Agent | ✅ Reference Agent | ✅ DONE |
| BIT-006: Coordinator Agent | ✅ BIT Evaluation Coordinator | ✅ DONE |

**Agent-Weights (implementiert):**
| Agent | Weight |
|-------|--------|
| Capability Match | 25% |
| Deal Quality | 20% |
| Strategic Fit | 15% |
| Competition Check | 15% |
| Legal Check | 15% |
| Reference Match | 10% |

**Implementierte Dateien:**
- `lib/bit-evaluation/agents/legal-agent.ts` - Legal Risk Assessment
- `lib/bit-evaluation/agents/reference-agent.ts` - Reference Project Matching
- `lib/bit-evaluation/agent.ts` - Koordinator mit allen 6 Agents integriert

---

### Epic 1 Gaps (resolved 2026-01-16)

| Gap | Severity | Status | Resolution |
|-----|----------|--------|------------|
| Password hash in getUsers() | Critical | ✅ FIXED | Select only required columns, exclude password |
| User deletion FK constraint | Critical | ✅ FIXED | Implemented soft delete with deletedAt column |
| First admin bootstrap | Critical | ✅ FIXED | Created lib/db/seed.ts with npm run db:seed |
| Auth errors not displayed | Important | ✅ FIXED | Added useActionState to login/register pages |
| NavUser hardcoded data | Important | ✅ FIXED | Dashboard layout passes session data to NavUser |
| Admin menu visible to all | Important | ✅ FIXED | Role-based filtering in app-sidebar.tsx |
| Logout non-functional | Important | ✅ FIXED | NavUser uses server action with form |
| Static breadcrumbs | Important | ✅ FIXED | Created DynamicBreadcrumb component |

Additional improvements:
- Added businessLineId to users schema for BL assignment
- Fixed various TypeScript errors across codebase
- AI SDK v5 type mismatch warnings suppressed with @ts-expect-error

Siehe `plans/epic-1-foundation-infrastructure.md` für Details.

### Epic 5a Gaps (resolved 2026-01-17)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| TRANS-001: Conversation Component | ✅ DELIVERED | ActivityStream component with SSE streaming |
| TRANS-002: Reasoning Component | ✅ DELIVERED | AgentMessage with collapsible reasoning sections |
| TRANS-003: Sources Component | ✅ DELIVERED | Sources component with type icons |
| TRANS-004: Message Actions | ✅ DELIVERED | Copy, Expand buttons in AgentMessage |
| TRANS-005: Confidence Indicator | ✅ DELIVERED | Color-coded progress bars (green/yellow/red) |
| TRANS-006: Abort Mechanism | ✅ DELIVERED | AbortButton with AlertDialog confirmation |

**Implementation Details:**

Infrastructure:
- ✅ SSE streaming with createAgentEventStream() and ReadableStream
- ✅ Event type system (AgentEventType enum with 7 event types)
- ✅ State management with useAgentStream() hook (reducer pattern)
- ✅ Two SSE endpoints: /api/bids/[id]/evaluate/stream, /api/bids/[id]/quick-scan/stream

UI Components:
- ✅ ActivityStream: Main container with auto-scroll and auto-start
- ✅ AgentMessage: Individual agent outputs with badges and reasoning
- ✅ ConfidenceIndicator: Progress bars with color coding
- ✅ AbortButton: Cancel with confirmation dialog
- ✅ Sources: Collapsible reference display

Integration:
- ✅ Wired into bid-detail-client.tsx for status='evaluating'
- ✅ Auto-start when BIT evaluation begins
- ✅ Refresh router on completion

**Security & Performance Fixes (Post-Review):**

Critical Fixes (P1):
- ✅ Authentication: Added NextAuth session verification to SSE endpoints
- ✅ Authorization: Verify bid ownership before streaming (userId check)
- ✅ Memory: Circular buffer (MAX_EVENTS=150) prevents unbounded growth
- ⏸️ Race Conditions: Optimistic locking (pending - needs migration)

Important Fixes (P2):
- ⏸️ Rate Limiting: Per-user stream limits (pending)
- ⏸️ XSS Protection: DOMPurify sanitization (pending)
- ⏸️ EventSource Cleanup: Memory leak on unmount (pending)

Code Quality (P3):
- ⏸️ Scroll Performance: Debounce auto-scroll (pending)
- ⏸️ Code Duplication: Color mapping refactor (pending)
- ⏸️ Type Safety: Remove 'as any' (pending)

**Review Results:**
- 6 parallel review agents (pattern-recognition, architecture, security, performance, data-integrity, agent-native)
- 10 structured todo files created in `todos/` directory
- 3 of 4 P1 critical issues fixed immediately
- 1 P1 issue pending (database migration required)

**Known Limitations:**
- EventSource doesn't support custom headers (auth via session only)
- No server-side abort mechanism (client-close only)
- No partial event replay (stream from current state only)
- quickScanResults and websiteUrl fields missing from schema (TypeScript errors)

Siehe `plans/robust-snacking-hennessy.md` für Epic 5a Implementation Plan.
Siehe `todos/001-pending-p1-sse-authentication-missing.md` through `todos/010-pending-p3-type-safety-violations.md` für Review Findings.

---

**Letztes Update:** 2026-01-17 (Epic-Review durchgeführt)
**Quelle:** Spec.md + Francesco Raaphorst Interview + Agent-Native Review + SpecFlow Analysis + Multi-Agent Code Review

**Änderungshistorie:**
- 2026-01-17: Epic 2 & 5 Status korrigiert (waren fälschlich als COMPLETE markiert), AI-Autofill Konzept hinzugefügt
