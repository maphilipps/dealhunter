# Feature Specification: Dealhunter - AI-Powered BD Decision Platform

## Overview

Dealhunter ist eine KI-gestützte **End-to-End Business Development Plattform** für adesso. Sie automatisiert den gesamten Akquise-Prozess: von der Anforderungsaufnahme über die **Bid/No Bid Entscheidung** bis zur **Team-Zusammenstellung** - inklusive umfassender Unternehmensanalyse (Tech Stack, Digital Maturity, Leadership, Valuation).

**Der Kern-Flow (Francesco's Vision):**
```
Anforderung hochladen → AI-Extraktion → Bid/No Bid Entscheidung →
Routing an Bereichsleiter → Erweiterte Auswertung → Team zusammenstellen →
Team per E-Mail benachrichtigen
```

## Tech Stack

### AI Foundation: Vercel AI SDK
- **Core**: `ai` Package für LLM-Interaktion, Tool-Calling, Agents
- **UI**: `@ai-sdk/react` für Streaming-UIs, useChat, useObject
- **Provider**: `@ai-sdk/anthropic` für Claude Opus 4.5
- **Structured Output**: Zod-Schemas für type-safe AI-Responses

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **UI Library**: ShadCN UI (vollständig)
- **Styling**: Tailwind CSS v4
- **State**: Zustand für Client State
- **Data Viz**: Recharts

### Backend
- **Runtime**: Node.js + TypeScript
- **Database**: PostgreSQL (Drizzle ORM)
- **Queue**: BullMQ für Background Jobs
- **Cache**: Redis

## Background

Das BD-Team bei adesso Digital Experience:
1. **Erhält Kundenanfragen** (RFPs, E-Mails, CRM-Leads) in verschiedenen Formaten
2. **Muss entscheiden**: Bieten wir an? ("Bid or No Bid")
3. **Muss routen**: Welcher Bereichsleiter ist zuständig?
4. **Muss evaluieren**: Aufwand, Wirtschaftlichkeit, benötigte Skills
5. **Muss Team zusammenstellen**: Wer arbeitet am Angebot?

Dealhunter automatisiert diesen gesamten Prozess mit AI-Unterstützung.

---

## RFP-to-Lead Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      DEALHUNTER: RFP-TO-LEAD LIFECYCLE                       │
└──────────────────────────────────────────────────────────────────────────────┘

                              ┌─ PHASE 1: QUALIFICATION ─┐
                              │    (BD Manager)          │
                              └──────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
            ┌────────────────┐   ┌──────────────┐   ┌────────────────┐
            │  DUPLICATE     │   │  EXTRACT     │   │  QUICK SCAN    │
            │  CHECK AGENT   │   │  AGENT       │   │  AGENT         │
            └────────────────┘   └──────────────┘   └────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │ TIMELINE + ROUTING     │
                            │ AGENT                  │
                            └────────────────────────┘
                                        │
                    ┌───────DECISION────┴──────────────────┐
                    │                                       │
                 HIGH CONFIDENCE                    LOW CONFIDENCE
                    │                            (< 70% → User Input)
                    └────────────────┬────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │ RFP BECOMES "LEAD"              │
                    │ (Status: routed)                │
                    └─────────────────────────────────┘
                                     │
                    ┌────── PHASE 2: DEEP ANALYSIS ────┐
                    │    (BU Lead, Background Job)     │
                    └──────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
    ┌─────────────┐         ┌────────────────┐         ┌────────────────┐
    │ FULL-SCAN   │         │ CONTRACT       │         │ LEGAL          │
    │ AGENT       │         │ AGENT          │         │ AGENT          │
    └─────────────┘         └────────────────┘         └────────────────┘
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     │
                                     ▼
                        ┌────────────────────────┐
                        │ DECISION AGENT         │
                        │ (Coordinator)          │
                        └────────────────────────┘
                                     │
                    ┌────────DECISION─┴────────┐
                    │                          │
                    ▼                          ▼
            ┌────────────────┐        ┌──────────────────┐
            │ ✅ BID         │        │ ❌ NO-BID        │
            │ (proceed)      │        │ (alternative)    │
            └────────────────┘        └──────────────────┘
                    │                          │
                    │                   Alternative BU
                    │                          │
                    └──────────────┬───────────┘
                                   │
                    ┌─────PHASE 3: TEAM STAFFING ───┐
                    │   (After BID Decision)        │
                    └───────────────────────────────┘
                                   │
                                   ▼
                      ┌────────────────────────┐
                      │ STAFFING AGENT         │
                      │ → Team Proposal        │
                      │ → Skill Matching       │
                      │ → Availability Check   │
                      └────────────────────────┘
                                   │
                                   ▼
                      ┌────────────────────────┐
                      │ BU LEAD CONFIRMS TEAM  │
                      └────────────────────────┘
                                   │
                                   ▼
                      ┌────────────────────────┐
                      │ TEAM NOTIFICATION      │
                      │ (Email + PDF)          │
                      └────────────────────────┘
                                   │
                                   ▼
                      ┌────────────────────────┐
                      │ 🎯 HANDED OFF          │
                      └────────────────────────┘
```

### Status-Flow

```
draft → extracting → quick_scanning → evaluating → bid_decided
                                                       │
                                                  [Bid/No-Bid]
                                                  ↙        ↘
                                               BID       NO-BID
                                                │            │
                                           routing    (Alt. Routing)
                                                │
                                           routed (LEAD)
                                                │
                                         deep_analyzing
                                                │
                                         pending_decision
                                                │
                                            staffing
                                                │
                                         team_assigned
                                                │
                                            notified
                                                │
                                         handed_off ✓
```

### Agents (10 Total)

| Phase | Agent | Funktion |
|-------|-------|----------|
| 1 | Duplicate-Check | Prüft auf existierende RFPs |
| 1 | Extraction | PDF/Email/Text → Strukturierte Daten |
| 1 | Quick-Scan | Website-Crawl (schnell) |
| 1 | Timeline | Projekt-Phasen schätzen |
| 1 | Routing | BU-Empfehlung |
| 2 | Full-Scan | Umfassender Website-Audit |
| 2 | Contract | Vertragstyp + Risiken |
| 2 | Legal | Compliance-Review |
| 2 | Decision | Coordinator: Bid/No-Bid + Tree |
| 3 | Staffing | Skill-Match + Team-Vorschlag |

---

## User Stories

### BD Manager
- Als **BD Manager** möchte ich Anforderungen hochladen (PDF, CRM, Freitext) und automatisch eine Bid/No Bid Empfehlung erhalten
- Als **BD Manager** möchte ich den kompletten Pipeline-Status in Echtzeit sehen (volle Transparenz)
- Als **BD Manager** möchte ich bei "No Bid" eine Alternative Empfehlung (anderer Bereich) erhalten

### Bereichsleiter (BL)
- Als **Bereichsleiter** möchte ich automatisch über relevante Opportunities informiert werden
- Als **Bereichsleiter** möchte ich eine erweiterte Auswertung mit Szenario-basierter Kalkulation sehen
- Als **Bereichsleiter** möchte ich interaktiv in Details eintauchen können (Skills, Aufwand, Risiken)
- Als **Bereichsleiter** möchte ich per Knopfdruck ein optimales Team zusammenstellen
- Als **Bereichsleiter** möchte ich das Team automatisch per E-Mail benachrichtigen lassen

### Administrator
- Als **Administrator** möchte ich die BL-Struktur (Bereiche, Technologien, Zuständigkeiten) pflegen
- Als **Administrator** möchte ich Mitarbeiter mit Skills anlegen und verwalten
- Als **Administrator** möchte ich Analytics über Bid/No Bid Entscheidungen sehen

---

## MVP Scope & Goals

### Vision Statement
Dealhunter automatisiert den gesamten BD-Entscheidungsprozess bei adesso: Von der Anforderungsaufnahme zur Team-Benachrichtigung - AI-gestützt, transparent, und mit einer Bid/No Bid Genauigkeit als oberste Priorität.

### MVP Goals
1. **Smart Upload**: Mixed-Format-Upload (PDF, CRM, Freitext) mit AI-Extraktion
2. **Bid/No Bid Entscheidung**: Vollständige Bewertung (Capability, Deal Quality, Strategic Fit, Wettbewerb)
3. **BL-Routing**: Automatische Weiterleitung an zuständigen Bereichsleiter
4. **Erweiterte Auswertung**: Szenario-basierte Kalkulation (Best/Worst/Expected)
5. **Team-Assignment**: AI-Vorschlag mit festen Rollen
6. **Benachrichtigung**: E-Mail + PDF an Team
7. **Company Analysis**: Integrierte Unternehmensanalyse (Tech Stack, Leadership, etc.)

### Success Criteria
- ✅ BD kann Anforderungen in beliebigem Format hochladen
- ✅ Bid/No Bid Entscheidung in 10-30 Minuten
- ✅ Automatisches Routing an korrekten Bereichsleiter
- ✅ BL erhält Szenario-basierte Wirtschaftlichkeitsanalyse
- ✅ AI schlägt optimales Team vor
- ✅ Team wird automatisch per E-Mail benachrichtigt
- ✅ BD hat volle Transparenz über Pipeline-Status
- ✅ Analytics Dashboard für Management

### Non-Goals (MVP)
- ❌ Learning/Feedback-Loop (System lernt nicht aus Outcomes)
- ❌ Mobile-Optimierung (Desktop Only)
- ❌ Multi-BL Deals (Joint Bids)
- ❌ Post-Handoff Tracking (Won/Lost)
- ❌ Slide Deck Generation (nur PDF)
- ❌ Ablehnung durch Team-Mitglieder

---

## Functional Requirements

### 1. Smart Upload & AI-Extraktion

**Input-Formate:**
- PDF (Ausschreibungen, RFPs, RFIs)
- CRM-Export (HubSpot, Salesforce)
- Freie Textbeschreibung
- E-Mail-Weiterleitungen

#### Document Cleaning (DSGVO-Konformität)

**Optionaler Schritt vor Verarbeitung:**
- User kann "Dokument bereinigen" aktivieren
- AI identifiziert und entfernt/anonymisiert:
  - Persönliche Daten (Namen, E-Mail, Telefon, Adressen)
  - Sensible Unternehmensdaten (Gehälter, interne Codes)
  - Vertrauliche Markierungen und Referenzen

**Cleaning-Prozess:**
```typescript
interface CleaningResult {
  originalText: string
  cleanedText: string
  removedItems: RemovedItem[]
  cleaningConfidence: number // 0-100
  requiresManualReview: boolean
}

interface RemovedItem {
  type: 'personal_name' | 'email' | 'phone' | 'address' | 'salary' | 'internal_code' | 'other'
  original: string
  replacement: string // z.B. "[NAME ENTFERNT]" oder "[ANONYMISIERT]"
  position: { start: number, end: number }
  confidence: number
}
```

**UX-Flow mit Cleaning:**
1. User lädt Dokument hoch
2. User aktiviert optional "DSGVO-Bereinigung"
3. AI scannt und markiert sensible Daten
4. User reviewed Vorschläge (kann einzelne Items behalten)
5. User bestätigt Bereinigung
6. Bereinigtes Dokument wird weiterverarbeitet

**Audit-Trail:**
- Ursprüngliches Dokument wird NICHT gespeichert (wenn Cleaning aktiv)
- Nur bereinigtes Dokument + Cleaning-Log
- Log zeigt WAS entfernt wurde (Typ, nicht Inhalt)

**AI-Extraktion:**
```typescript
interface ExtractedRequirements {
  customerName: string
  projectDescription: string
  technologies: string[]
  budget?: { min: number, max: number, currency: string }
  timeline?: string
  scope: string[]
  keyRequirements: string[]
  rawInput: string
  confidence: number // 0-100
  source: 'pdf' | 'crm' | 'freetext' | 'email'
}
```

**UX-Flow:**
1. User lädt Dokument hoch oder gibt Text ein
2. AI extrahiert strukturierte Daten
3. User bestätigt/korrigiert extrahierte Daten
4. Weiter zu Bid/No Bid Bewertung

### 2. Bid/No Bid Entscheidung & BD-Bewertung

**Document Upload & AI-Extraktion:**
- **PDF + Text Upload**: BD kann Ausschreibungsdokumente (PDF) direkt hochladen
- **AI-Analyse**: System extrahiert strukturiert alle relevanten Informationen
- **Nur extrahierte Daten**: Original-PDFs werden NICHT dauerhaft gespeichert
- **Immer volle Analyse**: Keine "Quick Assessment" Option - System analysiert immer vollständig

**Bewertungskategorien (Qualitativ, kein numerisches Scoring):**

| Kategorie | Aspekte | Agent |
|-----------|---------|-------|
| **Technisch** | Tech-Anforderungen, Komplexität, adesso-Kompetenzen | Tech Agent |
| **Rechtlich** | Vertragsrisiken, Haftung, Compliance | Legal Agent |
| **Kommerziell** | Budget, Marge, Wirtschaftlichkeit | Commercial Agent |
| **Organisatorisch** | Kapazität, Team, Timeline | Org Agent |
| **Wettbewerb** | Bekannte Mitbieter, Win-Wahrscheinlichkeit | Competition Agent |

**Vertragstyp-Erkennung & Risikobewertung:**
```typescript
interface ContractAnalysis {
  contractType: 'evb_it' | 'werkvertrag' | 'dienstvertrag' | 'rahmenvertrag' | 'sla' | 'unknown'
  riskLevel: 'low' | 'medium' | 'high'
  riskFactors: string[]           // z.B. "Unbegrenzte Haftung", "Pönalen >10%"
  recommendations: string[]       // Empfehlungen zur Risikominimierung
}
```

**Zuschlagskriterien Deep Analysis:**
```typescript
interface AwardCriteriaAnalysis {
  priceWeight: number             // % Gewichtung Preis
  qualityWeight: number           // % Gewichtung Qualität/Leistung
  criteria: AwardCriterion[]
  adessoStrengthMatch: {
    criterion: string
    matchScore: 'strong' | 'moderate' | 'weak'
    reasoning: string
  }[]
  overallFit: 'excellent' | 'good' | 'moderate' | 'poor'
  recommendation: string
}

interface AwardCriterion {
  name: string
  weight: number
  subCriteria?: string[]
}
```

**Red Flag Detection (Automatisch):**
```typescript
interface RedFlagAnalysis {
  budgetRedFlags: RedFlag[]       // z.B. "Budget 50% unter Marktdurchschnitt"
  timelineRedFlags: RedFlag[]     // z.B. "Go-Live in 6 Wochen unrealistisch"
  legalRedFlags: RedFlag[]        // z.B. "Unbegrenzte Haftungsklausel"
  technicalRedFlags: RedFlag[]    // z.B. "Legacy-Integration ohne API"
}

interface RedFlag {
  type: string
  severity: 'critical' | 'warning' | 'info'
  description: string
  recommendation: string
}
```

**Multi-Dimensionales Risiko-Assessment:**
```typescript
interface RiskAssessment {
  technical: RiskDimension
  legal: RiskDimension
  commercial: RiskDimension
  organizational: RiskDimension
  timeline: RiskDimension
}

interface RiskDimension {
  risks: Risk[]
  overallSeverity: 'low' | 'medium' | 'high' | 'critical'
}

interface Risk {
  name: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  mitigation?: string
}
```

**Entscheidungsbaum-Visualisierung:**
- Finale Empfehlung als interaktiver Entscheidungsbaum (ShadCN-basiert)
- Zeigt alle Faktoren die zur Empfehlung führen
- Klickbare Nodes mit Details
- Pro- und Contra-Argumente visuell aufbereitet

**Output:**
```typescript
interface BidDecision {
  decision: 'bid' | 'no_bid'
  confidence: number // 0-100
  reasoning: string
  decisionTree: DecisionNode       // Visualisierung
  riskAssessment: RiskAssessment
  awardCriteriaFit: AwardCriteriaAnalysis
  contractAnalysis: ContractAnalysis
  redFlags: RedFlagAnalysis
  alternativeRecommendation?: string
}

interface DecisionNode {
  id: string
  label: string
  type: 'factor' | 'decision' | 'recommendation'
  value?: 'positive' | 'negative' | 'neutral'
  children?: DecisionNode[]
  details?: string
}
```

**Bei "No Bid":**
- System prüft ob ein anderer Bereich besser passt
- Gibt Alternative Empfehlung (z.B. "Könnte zu WEM passen")
- Zeigt Entscheidungsbaum warum No Bid

### 2b. Legal Agent & Compliance

**Legal Agent Scope (zwei Ebenen):**

| Ebene | Scope | Details |
|-------|-------|---------|
| **BD-Level** | Fokus Risiko | Kritische Red Flags: Unbegrenzte Haftung, unfaire Pönalen, problematische IP-Klauseln |
| **BL-Level** | Umfassend | Vollständige Vertragsprüfung nach BL-Zuweisung |

**Legal Red Flags (BD-Level):**
```typescript
interface LegalQuickCheck {
  criticalFlags: LegalRedFlag[]
  complianceHints: string[]       // Hinweise auf relevante Compliance-Themen
  requiresDetailedReview: boolean
}

interface LegalRedFlag {
  category: 'liability' | 'penalty' | 'ip' | 'warranty' | 'termination' | 'jurisdiction'
  severity: 'critical' | 'warning'
  description: string
  clauseReference?: string        // Verweis auf Dokumentstelle
}
```

**Compliance-Prüfung (Vollständig):**
```typescript
interface ComplianceCheck {
  procurementLaw: {              // Vergaberecht
    applicable: boolean
    type?: 'vob' | 'vgv' | 'uvgo' | 'eu_threshold'
    requirements: string[]
    deadlines: { name: string; date: Date }[]
  }
  frameworkAgreement: {          // Rahmenverträge
    isFramework: boolean
    existingFramework?: string   // z.B. "Rahmenvertrag NRW IT"
    callOffRules?: string[]
  }
  subcontractor: {               // Subunternehmer
    allowed: boolean
    restrictions: string[]
    reportingRequirements: string[]
  }
}
```

### 2c. Master Data & Matching-Datenbanken

**Zentrale Datenbanken (Crowdsourced mit Admin-Validierung):**

| Datenbank | Inhalt | Pflege |
|-----------|--------|--------|
| **Referenzen** | Vergangene Projekte mit Kriterien | Jeder BD kann hinzufügen, Admin validiert |
| **Kompetenzen** | adesso-Skills und Experten | Jeder BD kann hinzufügen, Admin validiert |
| **Wettbewerber** | Bekannte Mitbieter mit Stärken/Schwächen | Jeder BD kann hinzufügen, Admin validiert |

**Referenz-Datenbank:**
```typescript
interface Reference {
  id: string
  projectName: string
  customerName: string
  industry: string
  technologies: string[]
  scope: string[]                 // z.B. ["CMS Migration", "E-Commerce"]
  teamSize: number
  duration: string                // z.B. "6 Monate"
  budget: { min: number; max: number }
  outcome: 'won' | 'delivered' | 'reference_available'
  contactPerson?: string
  highlights: string[]            // Besondere Erfolge
  createdBy: string               // User ID
  validatedBy?: string            // Admin ID
  validatedAt?: Date
  createdAt: Date
}
```

**Kompetenz-Datenbank:**
```typescript
interface Competency {
  id: string
  name: string                    // z.B. "Drupal Commerce", "React Performance"
  category: 'technology' | 'methodology' | 'industry' | 'soft_skill'
  level: 'basic' | 'advanced' | 'expert'
  experts: string[]               // Employee IDs
  projectCount: number            // Anzahl Projekte mit dieser Kompetenz
  certifications?: string[]
  createdBy: string
  validatedBy?: string
  createdAt: Date
}
```

**Wettbewerber-Datenbank:**
```typescript
interface Competitor {
  id: string
  name: string
  strengths: string[]             // z.B. ["Günstige Preise", "Öffentlicher Sektor"]
  weaknesses: string[]            // z.B. ["Keine Drupal-Expertise", "Kleine Teams"]
  technologies: string[]          // Bekannte Tech-Schwerpunkte
  industries: string[]            // Branchen-Fokus
  priceLevel: 'low' | 'medium' | 'high'
  recentEncounters: {
    opportunityId?: string
    date: Date
    outcome: 'won_against' | 'lost_to' | 'unknown'
    notes?: string
  }[]
  createdBy: string
  validatedBy?: string
  createdAt: Date
}
```

**Auto-Matching:**
```typescript
interface MatchingResult {
  references: {
    reference: Reference
    matchScore: number            // 0-100
    matchedCriteria: string[]
  }[]
  competencies: {
    required: string
    available: boolean
    experts: Employee[]
    gap?: string                  // Falls Kompetenz fehlt
  }[]
  competitors: {
    competitor: Competitor
    likelihood: 'high' | 'medium' | 'low'
    reasoning: string
    counterStrategy?: string
  }[]
}
```

### 3. BL-Struktur & Routing

**Konfigurierbare Bereichsleiter-Struktur:**
```typescript
interface BusinessLine {
  id: string
  name: string // "PHP", "WEM", "Data", etc.
  leaderId: string
  leaderName: string // "Francesco Raaphorst"
  leaderEmail: string
  technologies: string[] // ["Ibexa", "Drupal", "Sulu"]
  keywords: string[] // Für NLP-Matching
  createdAt: Date
  updatedAt: Date
}
```

**Initiale Konfiguration (Seed Data):**

| Bereich | Bereichsleiter | Technologien | Default |
|---------|----------------|--------------|---------|
| PHP | Francesco Raaphorst | Drupal, Ibexa, Sulu | Drupal |
| WEM | Michael Rittinghaus | Magnolia, Firstspirit | Magnolia |

**Technologie-Baselines (Initial):**

| Technologie | Baseline Name | Hours | Content Types | Paragraphs | Views |
|-------------|---------------|-------|---------------|------------|-------|
| Drupal | adessoCMS | 693 | 6 | 32 | 27 |
| Ibexa | Ibexa Standard | TBD | TBD | TBD | TBD |
| Sulu | Sulu Standard | TBD | TBD | TBD | TBD |
| Magnolia | Magnolia Base | TBD | TBD | TBD | TBD |
| Firstspirit | FS Standard | TBD | TBD | TBD | TBD |

**Hinweis:** Nur Drupal-Baseline (adessoCMS) ist initial komplett. Andere Baselines werden im Betrieb ergänzt.

**Routing-Logik:**
1. AI analysiert Anforderungen
2. NLP-Match zu Business Lines (Keywords, Technologies)
3. Routing an bestpassenden BL
4. Ein BL pro Deal (kein Multi-BL)

### 4. Erweiterte Auswertung für BL

**Trigger:** Automatisch nach Bid-Entscheidung

**Szenario-basierte Kalkulation:**
```typescript
interface ExtendedEvaluation {
  scenarioAnalysis: {
    best: FinancialProjection
    expected: FinancialProjection
    worst: FinancialProjection
  }
  riskFactors: string[]
  requiredSkills: string[] // NLP-basiert aus Anforderungen
  skillMatchScore: number // 0-100
  availableEmployees: EmployeeMatch[]
  recommendedTeamSize: number
  estimatedEffort: {
    days: { min: number, max: number }
    fte: number
  }
  profitabilityRecommendation: 'high' | 'medium' | 'low'
  profitabilityReasoning: string
}

interface FinancialProjection {
  revenue: number
  costs: number
  margin: number
  marginPercent: number
  riskFactors: string[]
}
```

**UX:** Interaktive Exploration
- BL kann Details aufklappen
- Filter nach Skills, Verfügbarkeit
- Drill-Down in einzelne Aspekte

---

## Data Model

### Core Entities

```typescript
// Bid Opportunity (Haupt-Entity)
interface BidOpportunity {
  id: string
  userId: string // BD Manager der eingereicht hat

  // Input
  source: 'reactive' | 'proactive'
  stage: 'cold' | 'warm' | 'rfp'
  inputType: 'pdf' | 'crm' | 'freetext' | 'email'
  rawInput: string
  extractedRequirements: ExtractedRequirements

  // Bid Decision
  bidDecision: 'bid' | 'no_bid' | 'pending'
  bidDecisionData?: BidDecision
  alternativeRecommendation?: string

  // Routing
  assignedBusinessLineId?: string
  assignedBLNotifiedAt?: Date

  // Extended Evaluation
  extendedEvaluation?: ExtendedEvaluation

  // Team
  assignedTeam?: TeamAssignment[]
  teamNotifiedAt?: Date

  // Company Analysis Links
  quickScanId?: string                    // Phase 1 Quick Scan
  deepMigrationAnalysisId?: string        // Phase 2 Deep Analysis

  // Status & Tracking
  status: BidStatus
  createdAt: Date
  updatedAt: Date
}

type BidStatus =
  | 'draft'              // BD erstellt
  | 'extracting'         // AI extrahiert Anforderungen
  | 'quick_scanning'     // Phase 1: Quick Scan läuft
  | 'evaluating'         // Bid/No Bid läuft
  | 'bid_decided'        // Bid-Entscheidung getroffen
  | 'routing'            // BL-Zuweisung
  | 'deep_analyzing'     // Phase 2: Deep Migration Analysis läuft (Background)
  | 'bl_reviewing'       // BL prüft Ergebnisse
  | 'team_assigned'      // Team zugewiesen
  | 'notified'           // Team benachrichtigt
  | 'handed_off'         // Abgeschlossen

// Business Line
interface BusinessLine {
  id: string
  name: string                    // "PHP", "WEM"
  leaderId: string
  leaderName: string
  leaderEmail: string
  technologies: Technology[]      // Zugeordnete CMS-Technologien
  keywords: string[]              // Für NLP-Matching
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// CMS-Technologie mit Baseline
interface Technology {
  id: string
  name: string                    // "Drupal", "Ibexa", "Magnolia", "Sulu", "Firstspirit"
  businessLineId: string
  baselineHours: number           // Reference-Stunden (z.B. 693 für adessoCMS)
  baselineName: string            // "adessoCMS", "Ibexa Standard", etc.
  baselineEntities: {
    contentTypes: number
    paragraphs: number
    views: number
    configFiles: number
  }
  isDefault: boolean              // Standard-Ziel für diese BL
  createdAt: Date
  updatedAt: Date
}

// Quick Scan Ergebnis (Phase 1)
interface QuickScan {
  id: string
  bidOpportunityId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: QuickScanResult
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

// Deep Migration Analysis (Phase 2)
interface DeepMigrationAnalysis {
  id: string
  bidOpportunityId: string
  targetTechnologyId: string      // Gewählte Ziel-Technologie
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number                // 0-100
  currentPhase: string            // "content_architecture" | "migration" | "accessibility" | "estimation"
  result?: DeepMigrationResult
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

// Employee
interface Employee {
  id: string
  name: string
  email: string
  businessLineId: string
  skills: string[]
  roles: TeamRole[]
  isAvailable: boolean
  createdAt: Date
  updatedAt: Date
}

// Team Assignment
interface TeamAssignment {
  id: string
  bidOpportunityId: string
  employeeId: string
  role: TeamRole
  assignedAt: Date
  notifiedAt?: Date
}

// Audit Trail Entry (für Override-Tracking)
interface AuditTrailEntry {
  id: string
  bidOpportunityId: string
  userId: string
  action: 'bl_override' | 'bid_override' | 'team_change' | 'status_change'
  previousValue: string
  newValue: string
  reason: string                  // Pflicht bei Override
  createdAt: Date
}

// Account (Kunden-Hierarchie)
interface Account {
  id: string
  name: string                    // Kundenname
  industry: string
  website?: string
  notes?: string
  opportunities: string[]         // BidOpportunity IDs
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// BD Subjective Input (Slider-basiert)
interface SubjectiveAssessment {
  id: string
  bidOpportunityId: string
  userId: string                  // BD der bewertet
  assessments: {
    customerRelationship: number  // 1-5: Kundenbeziehung
    strategicImportance: number   // 1-5: Strategische Bedeutung
    winProbability: number        // 1-5: Gewinnwahrscheinlichkeit (subjektiv)
    resourceAvailability: number  // 1-5: Ressourcenverfügbarkeit
    technicalFit: number          // 1-5: Technischer Fit
  }
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Reference (Zentrale Referenz-DB)
interface Reference {
  id: string
  projectName: string
  customerName: string
  industry: string
  technologies: string[]
  scope: string[]
  teamSize: number
  duration: string
  budget: { min: number; max: number }
  outcome: 'won' | 'delivered' | 'reference_available'
  contactPerson?: string
  highlights: string[]
  createdBy: string
  validatedBy?: string
  validatedAt?: Date
  createdAt: Date
}

// Competency (Zentrale Kompetenz-DB)
interface Competency {
  id: string
  name: string
  category: 'technology' | 'methodology' | 'industry' | 'soft_skill'
  level: 'basic' | 'advanced' | 'expert'
  experts: string[]
  projectCount: number
  certifications?: string[]
  createdBy: string
  validatedBy?: string
  createdAt: Date
}

// Competitor (Zentrale Wettbewerber-DB)
interface Competitor {
  id: string
  name: string
  strengths: string[]
  weaknesses: string[]
  technologies: string[]
  industries: string[]
  priceLevel: 'low' | 'medium' | 'high'
  recentEncounters: CompetitorEncounter[]
  createdBy: string
  validatedBy?: string
  createdAt: Date
}

interface CompetitorEncounter {
  opportunityId?: string
  date: Date
  outcome: 'won_against' | 'lost_to' | 'unknown'
  notes?: string
}
```

---

## API Endpoints

### Bid Opportunities
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/bids | Create new bid opportunity (upload) |
| GET | /api/bids | List all bids (with filters) |
| GET | /api/bids/:id | Get single bid with all data |
| PATCH | /api/bids/:id | Update bid (confirm extraction, etc.) |
| DELETE | /api/bids/:id | Delete bid |
| POST | /api/bids/:id/evaluate | Trigger Bid/No Bid evaluation |
| POST | /api/bids/:id/assign-team | Assign team to bid |
| POST | /api/bids/:id/notify-team | Send notifications |
| GET | /api/bids/:id/stream | SSE stream for live updates |

### Business Lines (Admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/business-lines | List all BLs |
| POST | /api/admin/business-lines | Create BL |
| PATCH | /api/admin/business-lines/:id | Update BL |
| DELETE | /api/admin/business-lines/:id | Delete BL |

### Employees (Admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/employees | List all employees |
| POST | /api/admin/employees | Create employee |
| PATCH | /api/admin/employees/:id | Update employee |
| DELETE | /api/admin/employees/:id | Delete employee |
| POST | /api/admin/employees/import | Bulk import (CSV) |

### Company Analysis (Zwei-Phasen)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/bids/:id/quick-scan | Trigger Quick Scan (Phase 1) |
| GET | /api/bids/:id/quick-scan | Get Quick Scan result |
| POST | /api/bids/:id/deep-analysis | Trigger Deep Analysis (Phase 2) |
| GET | /api/bids/:id/deep-analysis | Get Deep Analysis result |
| GET | /api/bids/:id/deep-analysis/stream | SSE stream for progress |

### Technologies (Admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/technologies | List all technologies |
| POST | /api/admin/technologies | Create technology with baseline |
| PATCH | /api/admin/technologies/:id | Update technology |
| DELETE | /api/admin/technologies/:id | Delete technology |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/overview | Dashboard stats |
| GET | /api/analytics/bid-rate | Bid/No Bid statistics |
| GET | /api/analytics/by-bl | Stats per Business Line |

### Accounts (Kunden-Hierarchie)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/accounts | List all accounts |
| POST | /api/accounts | Create account |
| GET | /api/accounts/:id | Get account with opportunities |
| PATCH | /api/accounts/:id | Update account |
| DELETE | /api/accounts/:id | Delete account |

### References (Master Data)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/references | List all references |
| POST | /api/references | Create reference (BD) |
| GET | /api/references/:id | Get reference details |
| PATCH | /api/references/:id | Update reference |
| DELETE | /api/references/:id | Delete reference |
| POST | /api/references/:id/validate | Validate reference (Admin) |
| GET | /api/references/search | Search/match references |

### Competencies (Master Data)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/competencies | List all competencies |
| POST | /api/competencies | Create competency (BD) |
| PATCH | /api/competencies/:id | Update competency |
| DELETE | /api/competencies/:id | Delete competency |
| POST | /api/competencies/:id/validate | Validate competency (Admin) |
| GET | /api/competencies/search | Search competencies |

### Competitors (Master Data)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/competitors | List all competitors |
| POST | /api/competitors | Create competitor (BD) |
| GET | /api/competitors/:id | Get competitor details |
| PATCH | /api/competitors/:id | Update competitor |
| DELETE | /api/competitors/:id | Delete competitor |
| POST | /api/competitors/:id/validate | Validate competitor (Admin) |
| POST | /api/competitors/:id/encounter | Log encounter with competitor |

### Subjective Assessment
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/bids/:id/assessment | Get BD assessment |
| POST | /api/bids/:id/assessment | Create/update assessment |

---

## Agent Architecture (Vercel AI SDK)

> **Agent-Liste:** Siehe [Agent-Native Architektur](#agent-native-architektur) im Abschnitt "Refined RFP-to-Lead Pipeline" für die vollständige Liste der 10 Agents.

### Orchestrierung (Agentic Loop)

**Ablauf (dynamisch vom Coordinator gesteuert):**
1. **Coordinator entscheidet dynamisch** welche Agents wann laufen (Agentic Loop)
2. **Parallel wo möglich:** Unabhängige Agents laufen gleichzeitig
3. **Checkpoints:** Zwischenstände als JSON im Filesystem gespeichert
4. **Confidence < 70%:** Eskalation an User

```typescript
// Orchestration Flow
async function evaluateBidOpportunity(bidId: string) {
  // Phase 1: Parallel Extraction
  const [
    techResult,
    legalQuickResult,
    commercialResult,
    competitionResult,
    referenceResult
  ] = await Promise.all([
    techAgent.analyze(bidId),
    legalAgent.quickCheck(bidId),
    commercialAgent.analyze(bidId),
    competitionAgent.analyze(bidId),
    referenceAgent.findMatches(bidId)
  ])

  // Phase 2: Sequential Coordination
  const coordinatorResult = await coordinatorAgent.synthesize({
    tech: techResult,
    legal: legalQuickResult,
    commercial: commercialResult,
    competition: competitionResult,
    references: referenceResult
  })

  return coordinatorResult
}
```

### Coordinator Agent

**Aufgabe:** Alle Teil-Analysen zusammenführen und finale Empfehlung erstellen

```typescript
interface CoordinatorOutput {
  recommendation: 'bid' | 'no_bid'
  confidence: number
  decisionTree: DecisionNode
  synthesis: {
    strengths: string[]           // Top 3-5 Pro-Argumente
    weaknesses: string[]          // Top 3-5 Contra-Argumente
    keyRisks: Risk[]
    keyOpportunities: string[]
  }
  reasoning: string               // Ausführliche Begründung
  nextSteps: string[]             // Empfohlene nächste Schritte
}
```

### Agent-Loop Pattern mit AI SDK

```typescript
import { generateText, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// Coordinator Agent - Synthesizes all partial results
const coordinatorAgent = async (partialResults: PartialResults) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `Du bist der Coordinator Agent bei Dealhunter.
    Deine Aufgabe ist es, alle Teil-Analysen zusammenzuführen und eine
    fundierte Bid/No Bid Empfehlung zu erstellen.

    Erstelle einen Entscheidungsbaum der alle Faktoren visualisiert.
    Sei objektiv und nenne sowohl Pro als auch Contra Argumente.`,
    prompt: `Erstelle eine Gesamtbewertung basierend auf:

    Tech-Analyse: ${JSON.stringify(partialResults.tech)}
    Legal-Check: ${JSON.stringify(partialResults.legal)}
    Commercial: ${JSON.stringify(partialResults.commercial)}
    Wettbewerber: ${JSON.stringify(partialResults.competition)}
    Referenzen: ${JSON.stringify(partialResults.references)}`,
    tools: {
      buildDecisionTree: tool({
        description: 'Erstelle einen Entscheidungsbaum',
        parameters: z.object({
          rootDecision: z.string(),
          factors: z.array(z.object({
            name: z.string(),
            value: z.enum(['positive', 'negative', 'neutral']),
            weight: z.number(),
            children: z.array(z.any()).optional()
          }))
        }),
        execute: async ({ rootDecision, factors }) => {
          // Build tree structure
        }
      }),
      calculateConfidence: tool({
        description: 'Berechne Confidence Score basierend auf Faktoren',
        parameters: z.object({
          positiveFactors: z.number(),
          negativeFactors: z.number(),
          uncertainFactors: z.number()
        }),
        execute: async ({ positiveFactors, negativeFactors, uncertainFactors }) => {
          // Calculate weighted confidence
        }
      })
    },
    maxSteps: 5
  })

  return result
}

// Tech Agent
const techAgent = async (requirements: ExtractedRequirements) => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: `Du bist der Tech Agent bei Dealhunter.
    Analysiere technische Anforderungen und matche sie gegen adesso-Kompetenzen.`,
    prompt: `Analysiere diese Anforderungen: ${JSON.stringify(requirements)}`,
    tools: {
      checkCapabilities: tool({
        description: 'Prüfe ob adesso die benötigten Capabilities hat',
        parameters: z.object({
          technologies: z.array(z.string()),
          skills: z.array(z.string())
        }),
        execute: async ({ technologies, skills }) => {
          // Check gegen Competency DB
        }
      }),
      findExperts: tool({
        description: 'Finde Experten für bestimmte Technologien',
        parameters: z.object({
          technologies: z.array(z.string())
        }),
        execute: async ({ technologies }) => {
          // Query Employee DB
        }
      })
    },
    maxSteps: 10
  })

  return result
}
```

### Streaming UI mit AI SDK UI

```typescript
// Frontend: useChat für Live-Updates
import { useChat } from '@ai-sdk/react'

function BidEvaluationProgress({ bidId }) {
  const { messages, isLoading } = useChat({
    api: `/api/bids/${bidId}/evaluate`,
    onFinish: (message) => {
      // Handle completion
    }
  })

  return (
    <div>
      {messages.map((m) => (
        <AgentThought key={m.id} message={m} />
      ))}
    </div>
  )
}
```

### Structured Output für Bid-Decision

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'

const BidDecisionSchema = z.object({
  decision: z.enum(['bid', 'no_bid']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  capabilityScore: z.number().min(0).max(100),
  dealQualityScore: z.number().min(0).max(100),
  strategicFitScore: z.number().min(0).max(100),
  competitionRisk: z.enum(['low', 'medium', 'high']),
  alternativeRecommendation: z.string().optional()
})

const result = await generateObject({
  model: anthropic('claude-sonnet-4-20250514'),
  schema: BidDecisionSchema,
  prompt: `Triff eine Bid/No Bid Entscheidung für: ${JSON.stringify(requirements)}`
})
```

---

## Agent Native Transparency

Basierend auf https://every.to/guides/agent-native - volle Sichtbarkeit aller AI-Aktionen.

### Prinzipien

1. **Volle Chain-of-Thought Sichtbarkeit**: Jeder Agent-Schritt ist für den User sichtbar
2. **Kein Black Box**: User sieht WAS der Agent tut, WARUM, und WIE
3. **Abbruch möglich**: User kann jederzeit abbrechen (keine Live-Steuerung)
4. **Confidence Levels**: Alle Entscheidungen zeigen Confidence Score

### Agent Activity Stream

```typescript
interface AgentActivityEvent {
  id: string
  timestamp: Date
  type: 'thought' | 'tool_call' | 'tool_result' | 'decision' | 'error'
  agent: string                   // "bid_evaluator", "quick_scan", "deep_analysis"
  content: {
    thought?: string              // Chain-of-Thought
    toolName?: string             // z.B. "checkCapabilities"
    toolInput?: Record<string, any>
    toolOutput?: Record<string, any>
    decision?: {
      value: string
      confidence: number
      reasoning: string
    }
    error?: string
  }
}
```

### UI-Komponenten

**AgentActivityLog**: Echtzeit-Stream aller Agent-Aktionen
```
[12:34:01] 🤔 Analysiere Tech Stack der Kundenwebsite...
[12:34:05] 🔧 Tool: detectCMS → WordPress 6.4 detected
[12:34:08] 🤔 WordPress erkannt, prüfe PHP-Kompatibilität...
[12:34:12] 🔧 Tool: checkCapabilities → PHP BL hat WordPress-Expertise
[12:34:15] ✅ Entscheidung: Routing zu PHP (Confidence: 87%)
```

**AgentThoughtBubble**: Expandierbare Thought-Details
- Minimiert: Kurze Zusammenfassung
- Expandiert: Vollständiger Chain-of-Thought

**ConfidenceIndicator**: Visueller Confidence-Score
- 🟢 80-100%: High Confidence
- 🟡 60-79%: Medium Confidence (Warnung anzeigen)
- 🔴 <60%: Low Confidence (Bestätigung erforderlich)

### Abort-Mechanismus

**User kann abbrechen:**
- Button "Analyse abbrechen" während aller Agent-Operationen
- Graceful Shutdown: Laufende Tool-Calls werden beendet
- Partial Results: Bisherige Ergebnisse bleiben erhalten
- Re-Start möglich: User kann später fortsetzen

**Kein Live-Steering:**
- User kann Agent nicht während der Ausführung umlenken
- Stattdessen: Abbrechen → Anpassen → Neu starten

---

## User Interface

### Screens

#### 1. Dashboard (BD View)
- **Account-basierte Ansicht**: Opportunities gruppiert nach Kunde/Account
- **Pipeline Overview**: Alle Bids mit Status
- **Quick Stats**: Bid-Rate, offene Evaluierungen, zugewiesene Teams
- **Deadline-Tracking**: Anstehende Deadlines im Dashboard sichtbar
- **New Bid CTA**: Upload starten
- **Filters**: Status, Datum, BL, Source, Account

#### 2. Smart Upload
- **Drop Zone**: Drag & Drop für PDFs (Ausschreibungsdokumente)
- **Text Area**: Für Freitext/E-Mail
- **Account-Zuweisung**: Bid einem Account zuordnen (neu oder bestehend)
- **AI Extraction Preview**: Zeigt extrahierte Daten zur Bestätigung
- **DSGVO-Bereinigung**: Optional vor Verarbeitung

#### 3. Subjektive Bewertung (BD Input)
- **Slider-basierte Ratings** (1-5):
  - Kundenbeziehung
  - Strategische Bedeutung
  - Gewinnwahrscheinlichkeit (subjektiv)
  - Ressourcenverfügbarkeit
  - Technischer Fit
- **System-Vorschläge**: Basierend auf Historie, BD kann überschreiben
- **Freitext-Notizen**: Zusätzliche Einschätzungen

#### 4. Bid/No Bid Progress & Entscheidungsbaum
- **Agent Transparency**: Live Agent-Aktionen sichtbar (Full Chain-of-Thought)
- **Multi-Agent Progress**: Zeigt alle parallel laufenden Agents
  - Tech Agent Status
  - Legal Agent Status
  - Commercial Agent Status
  - Competition Agent Status
  - Reference Agent Status
- **Coordinator Synthesis**: Wenn alle fertig, zeigt Zusammenführung
- **Entscheidungsbaum-Visualisierung**:
  - Interaktiver Baum mit allen Faktoren
  - Klickbare Nodes für Details
  - Farbcodierung (Grün=Positiv, Rot=Negativ, Gelb=Neutral)
  - Pro/Contra klar visualisiert
- **Red Flag Alerts**: Kritische Issues prominent anzeigen
- **Referenz-Matches**: Passende Referenzen aus DB
- **Wettbewerber-Warnung**: Bekannte Mitbieter anzeigen

#### 5. BL Review (Bereichsleiter View)
- **Inbox**: Neue Opportunities mit Status
  - 🔄 "Deep Analysis läuft..." (wenn Background Job aktiv)
  - ✅ "Bereit zur Prüfung" (wenn Analysis fertig)
- **Vollständige Legal-Analyse**: Detaillierte Vertragsprüfung
- **Deep Migration Analysis Dashboard**:
  - Content Architecture Overview (Page Types, Components)
  - Migration Complexity Score
  - Accessibility Report Summary
  - **PT-Schätzung** mit Baseline-Vergleich
- **Erweiterte Auswertung**: Interaktive Exploration
- **Szenario Cards**: Best/Expected/Worst
- **Skill Gaps**: Fehlende Skills visualisiert
- **Target CMS Auswahl**: BL kann Ziel-Technologie ändern
- **Team Builder**: Drag & Drop Team-Zusammenstellung
- **Notify Button**: Team benachrichtigen

#### 6. Master Data Management
- **Referenzen pflegen**:
  - Neue Referenz hinzufügen
  - Bestehende bearbeiten
  - Validierung (Admin-Workflow)
- **Kompetenzen pflegen**:
  - Technologien, Methodiken, Branchen
  - Experten zuordnen
  - Validierung (Admin-Workflow)
- **Wettbewerber pflegen**:
  - Stärken/Schwächen dokumentieren
  - Encounters loggen (gewonnen/verloren gegen)
  - Validierung (Admin-Workflow)

#### 7. Account Management
- **Account-Übersicht**: Alle Kunden/Accounts
- **Account-Detail**: Alle Opportunities eines Kunden
- **Account erstellen**: Bei neuem Kunden

#### 8. Admin Panel
- **Business Lines**: CRUD für Bereiche
- **Technologies**: CMS-Technologien mit Baselines pflegen
  - Name, Baseline-Hours, Baseline-Entities
  - Zuordnung zu Business Lines
- **Employees**: CRUD für Mitarbeiter + Skills
- **Master Data Validation**: Referenzen, Kompetenzen, Wettbewerber validieren
- **Analytics**: Bid/No Bid Stats, Pipeline-Metriken
- **Audit Trail**: Override-Logs einsehen

---

## Analytics Dashboard

### Metrics
- **Bid Rate**: % der RFPs die zu "Bid" werden
- **Time to Decision**: Durchschnittliche Zeit bis Bid/No Bid
- **Per BL**: Verteilung nach Bereichsleiter
- **Source Distribution**: Reactive vs Proactive
- **Stage Distribution**: Cold/Warm/RFP

### Visualizations
- Bid/No Bid Pie Chart
- Timeline: Bids over time
- BL Heatmap: Welcher Bereich bekommt wie viele?
- Funnel: Draft → Bid → Assigned → Notified

---

## Authentication & Permissions

### System-Benutzer (mit Login)
| Role | Permissions |
|------|-------------|
| BD Manager | Create bids, view own bids, see pipeline status |
| Bereichsleiter | Review assigned bids, assign teams, notify |
| Admin | All + manage BLs + manage employees + analytics |

### Keine System-User
| Role | Beschreibung |
|------|--------------|
| Team-Mitglied | Empfängt nur E-Mail + PDF, **kein System-Zugang** |

**Hinweis:** Team-Mitglieder werden in der Mitarbeiter-Datenbank gepflegt (Name, E-Mail, Skills), haben aber keinen Login. Sie erhalten nur Benachrichtigungen per E-Mail.

### Auth
- NextAuth.js Credentials Provider
- Email/Password (kein SSO)
- JWT mit httpOnly Cookies
- **Nur 3 User-Rollen**: BD Manager, Bereichsleiter, Admin

---

## Testing Requirements

### Unit Tests
- [ ] AI Extraction Logic
- [ ] Bid/No Bid Scoring Algorithm
- [ ] BL Routing Logic
- [ ] Skill Matching (NLP)
- [ ] Szenario Calculation

### Integration Tests
- [ ] Upload → Extraction → Evaluation Flow
- [ ] BL Routing Accuracy
- [ ] Team Assignment Flow
- [ ] Email Notification Delivery

### E2E Tests (Playwright)
- [ ] Happy Path: Upload → Bid → Team → Notify
- [ ] No Bid with Alternative Recommendation
- [ ] Admin: Create BL, Create Employee
- [ ] BD Pipeline View

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Smart Upload Processing | <30 sec |
| AI Extraction | <60 sec |
| Quick Scan (Phase 1) | 2-5 min |
| Bid/No Bid Decision | 5-15 min |
| Deep Migration Analysis (Phase 2) | 10-30 min (Background) |
| Extended Evaluation | <2 min |
| Team Notification | <30 sec |

---

## Security Considerations

- **Data at Rest**: AES-256 Encryption
- **Data in Transit**: TLS 1.3
- **PII**: Nicht für Training verwenden
- **Input Validation**: Alle Uploads validieren
- **Rate Limiting**: Pro-User Limits auf API

---

## Refined RFP-to-Lead Pipeline (2026-01 Update)

### Übersicht: Der verfeinerte Qualifikationsprozess

```
RFP Upload (BD)
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: QUALIFIKATION (BD Manager)                        │
│  ───────────────────────────────────────────────────────── │
│  - AI-Extraktion aus PDF/E-Mail/Freitext                   │
│  - Quick Scan der Kunden-Website                           │
│  - Erste Bid/No-Bid Empfehlung (AI-gestützt)              │
│  - Timeline-Vorschau (grobe Projektphasen)                 │
│  - Routing-Empfehlung an Business Unit                     │
└─────────────────────────────────────────────────────────────┘
     │
     ▼ Routing an Business Unit Lead
┌─────────────────────────────────────────────────────────────┐
│  RFP wird zu LEAD                                           │
│  (Status-Transformation bei BU-Zuweisung)                   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: VOLLUMFÄNGLICHER SCAN (Business Unit Lead)        │
│  ───────────────────────────────────────────────────────── │
│  - Website Audit (Komponenten, Häufigkeiten, Screenshots)  │
│  - Technische Analyse (CMS, Framework, Integrationen)      │
│  - Content-Typen und Migrationsaufwand                     │
│  - Vertragsmodell-Analyse (T&M vs. Festpreis)             │
│  - Rechtliche Risiken und Compliance                       │
│  - Projekt-Timeline (Setup → Go-Live)                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  BIT / NO-BIT ENTSCHEIDUNG (durch BU Lead)                  │
│  ───────────────────────────────────────────────────────── │
│  - Alle Daten auf einen Blick                              │
│  - Entscheidung mit Begründung                             │
│  - Bei NO-BIT: Alternative BU-Empfehlung                   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼ Bei BIT
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: TEAM-STAFFING (Business Unit Lead)                │
│  ───────────────────────────────────────────────────────── │
│  - Mitarbeiter-Auswahl basierend auf gecrawlten Daten     │
│  - Skill-Matching mit Website-Anforderungen                │
│  - Verfügbarkeits-Check                                    │
│  - Team-Benachrichtigung                                   │
└─────────────────────────────────────────────────────────────┘
```

### Agent-Native Architektur

**Kernprinzip:** Die gesamte Logik wird durch AI-Agents abgebildet. Jeder Prozessschritt ist ein Agent, der eigenständig arbeitet und seine Ergebnisse strukturiert zurückgibt.

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT-NATIVE PIPELINE                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DUPLICATE-CHECK AGENT                                       │
│     Input:  RFP-Text, Kundenname, URL                          │
│     Output: { isDuplicate, existingRfps[], similarity }        │
│                                                                 │
│  2. EXTRACTION AGENT                                            │
│     Input:  RFP-Dokument (PDF/Email/Text)                      │
│     Output: { extractedFields, confidence, missingFields }     │
│                                                                 │
│  3. QUICK-SCAN AGENT                                            │
│     Input:  Kunden-URL                                         │
│     Output: { techStack, contentVolume, blRecommendation }     │
│                                                                 │
│  4. TIMELINE AGENT                                              │
│     Input:  QuickScan-Result, RFP-Anforderungen                │
│     Output: { phases[], totalDays, milestones }                │
│                                                                 │
│  5. ROUTING AGENT                                               │
│     Input:  All previous outputs                               │
│     Output: { recommendedBU, confidence, reasoning }           │
│                                                                 │
│  ─── Nach Routing: RFP → LEAD ───                              │
│                                                                 │
│  6. FULL-SCAN AGENT (Website Audit)                            │
│     Input:  Kunden-URL, Deep=true                              │
│     Output: { components, screenshots, migrations, audits }    │
│                                                                 │
│  7. CONTRACT AGENT                                              │
│     Input:  RFP-Text                                           │
│     Output: { type, riskFlags[], budget, penalties }           │
│                                                                 │
│  8. LEGAL AGENT                                                 │
│     Input:  RFP-Text, ContractAnalysis                         │
│     Output: { riskScore, issues[], compliance }                │
│                                                                 │
│  9. DECISION AGENT (Coordinator)                                │
│     Input:  All previous outputs                               │
│     Output: { recommendation, scores, reasoning }              │
│                                                                 │
│  ─── Nach BIT-Entscheidung ───                                 │
│                                                                 │
│  10. STAFFING AGENT                                             │
│      Input:  FullScan, Mitarbeiter-DB                          │
│      Output: { teamProposal[], matchScores, availability }     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Agent-Eigenschaften:**
- Jeder Agent ist **idempotent** (kann mehrfach ausgeführt werden)
- Jeder Agent liefert **strukturierte Outputs** (Zod-validiert)
- Jeder Agent hat **Confidence Scores**
- Jeder Agent loggt seine **Reasoning Chain**
- Agents können **parallel** oder **sequentiell** orchestriert werden

### Duplikat-Prüfung (Duplicate Check Agent)

**Problem:** RFPs für denselben Kunden/dasselbe Projekt können mehrfach eingehen (z.B. "Saudi Pro League", "VHS Frankfurt"). Ohne Duplikat-Check entstehen redundante Einträge.

**Lösung:** Bei jedem neuen RFP prüft der Duplicate-Check Agent:

```
┌─────────────────────────────────────────────────────────────┐
│  DUPLICATE CHECK                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Neuer RFP: "VHS Frankfurt - Website Relaunch"              │
│                                                             │
│  ⚠️  Mögliche Duplikate gefunden:                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐
│  │ 1. "VHS Frankfurt Redesign" (RFP-2024-089)              │
│  │    Status: qualified | Erstellt: 15.12.2024             │
│  │    Similarity: 92%                                       │
│  │    [Zusammenführen] [Trotzdem anlegen] [Abbrechen]      │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐
│  │ 2. "Volkshochschule Frankfurt Portal" (RFP-2024-045)    │
│  │    Status: no_bid | Erstellt: 03.09.2024                │
│  │    Similarity: 78%                                       │
│  │    [Verknüpfen] [Trotzdem anlegen] [Details]            │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Matching-Kriterien:**

| Kriterium | Gewicht | Beschreibung |
|-----------|---------|--------------|
| Kundenname | 40% | Fuzzy-Match auf Account/Company Name |
| URL/Domain | 30% | Gleiche Website = hohe Wahrscheinlichkeit |
| Projektbeschreibung | 20% | Semantic Similarity (Embeddings) |
| Zeitraum | 10% | RFPs < 6 Monate auseinander |

**Aktionen bei Duplikat:**
- **Automatisch Zusammenführen** (Default): Neuer RFP wird mit existierendem gemerged
  - Neue Informationen werden zum existierenden RFP hinzugefügt
  - Kein manueller Eingriff nötig bei hoher Similarity (> 90%)
- **Manuell Verknüpfen**: Bei mittlerer Similarity (70-90%) User-Bestätigung
- **Trotzdem anlegen**: Explizit als neuer RFP behandeln (User Override)

**API für Duplicate Check:**
```typescript
// POST /api/rfps/duplicate-check
{
  customerName: string;
  projectTitle: string;
  websiteUrl?: string;
  description?: string;
}

// Response
{
  hasDuplicates: boolean;
  matches: Array<{
    rfpId: string;
    title: string;
    status: OpportunityStatus;
    similarity: number;       // 0-100
    matchedFields: string[];  // ['customerName', 'url']
    createdAt: Date;
  }>;
}
```

### Architecture Decisions (Interview 2026-01-20)

Die folgenden Entscheidungen wurden im Detail-Interview mit dem Product Owner getroffen:

#### MCP & Datensammlung

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **MCP Scope** | Multi-Source über MCP | LinkedIn, Handelsregister, etc. alles via Browser-Automation |
| **MCP Auth** | Nur öffentliche Daten | Kein Login für externe Dienste (erstmal), ToS-konform |
| **Crawling Legalität** | Ignorieren | Internes Tool, robots.txt nicht relevant |

#### Embeddings & Vektor-Suche

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Embedding Model** | `text-embedding-3-large` | Via adesso AI Hub, 3072 Dimensionen |
| **Vektor-DB** | SQLite mit vec0 Extension | < 10.000 RFPs erwartet, reicht völlig |
| **Embedding Lifecycle** | Speichern + Reindex | Bei RFP-Änderungen neu berechnen |

#### Agent-Orchestrierung

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Orchestrierung** | Coordinator entscheidet dynamisch | Agentic Loop, AI wählt welche Agents wann |
| **Human-in-Loop** | Nein, vollautomatisch | Agent trifft alle Entscheidungen selbst |
| **Agent-Konflikte** | Kontextabhängig | AI Coordinator löst je nach Severity |
| **Timeline-Kalibrierung** | Agenten als Experten | AI mimen Experten für Validierung |

#### Error Handling & Checkpoints

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Rollback-Strategie** | Checkpoint-basiert | Zwischenstände speichern, bei Checkpoint fortsetzen |
| **Checkpoint-Storage** | Filesystem (JSON-Files) | Pro Workflow ein File, einfach zu debuggen |

#### UI & Notifications

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Agent UI** | Alles live streamen | Volle Transparenz, jeder Agent-Schritt sichtbar |
| **Notifications** | In-App only | Slack komplett raus, Dashboard-Benachrichtigungen |
| **Confidence Threshold** | < 70% → User eskalieren | Bei niedriger Confidence manuelle Entscheidung |

#### Governance & Audit

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Override-Governance** | Nur Audit-Log | BD Manager wird vertraut, Log reicht |
| **Log Retention** | Unbegrenzt (komprimiert) | Alles behalten, nach 90 Tagen archivieren |
| **Original-Dokumente** | Extrahierte Daten reichen | Kein Audit ohne Original nötig |

#### Daten-Management

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Daten-Freshness** | Warnung nach X Tagen | Alert wenn Scan-Daten veraltet |
| **Full-Scan bei Website-Änderung** | Immer neu crawlen | Unabhängig vom Quick-Scan |
| **HR-Daten Sync** | Manuelle Pflege | Admin pflegt Mitarbeiter-DB, kein HR-System |

#### Duplicate Handling

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Duplicate Action** | Automatisch mergen | Neue Infos zum existierenden RFP hinzufügen |

#### Feedback & Learning

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **No-Bid Reason** | Optionales Freitext | BU Lead kann Grund angeben, muss nicht |

#### Internationalisierung

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Timezone** | Immer lokale Zeit (Berlin) | Alle Zeiten in deutscher Zeitzone |

---

### Technische Umsetzung (basierend auf Decisions)

**Datenhaltung:**
- [x] MCP-Layer für Multi-Source Datensammlung (nur öffentliche Daten)
- [x] Alle Crawl-Daten in DB speichern (SQLite + JSON)
- [x] Embeddings mit `text-embedding-3-large` via adesso AI Hub
- [x] SQLite vec0 Extension für Vektor-Suche (< 10k RFPs)

**Integration:**
- [x] Playwright/Chrome DevTools MCP für Screenshots
- [x] Wappalyzer für Tech-Detection
- [x] Filesystem-Checkpoints (JSON) für Workflow-State

**Agent-Orchestrierung:**
- [x] Vercel AI SDK mit streamText/generateObject
- [x] Agentic Loop: Coordinator entscheidet dynamisch
- [x] Vollautomatisch (kein Human-in-Loop während Workflow)
- [x] Confidence < 70% → Eskalation an User

### Phase 1: Qualifikation (BD Manager)

#### RFP-Extraktion (bestehend, zu verbessern)

**Probleme mit aktuellem Stand:**
- Extraktion liefert nicht immer brauchbare Ergebnisse
- Fehlende Strukturierung der extrahierten Daten
- Keine Validierung gegen bekannte Patterns

**Verbesserungen:**
- Structured Output mit strikten Zod-Schemas
- Multi-Pass Extraktion (erst grob, dann Detail)
- Confidence Scores für jeden extrahierten Wert
- Human-in-the-Loop für niedrige Confidence

#### Quick Scan (während Qualifikation)

Der Quick Scan läuft bereits während der BD-Qualifikation und liefert:
- Tech Stack der Kunden-Website
- Content-Volumen Schätzung
- Erste BU-Routing-Empfehlung
- Grobe Migrations-Komplexität

**Wichtig:** Timeline muss bereits hier sichtbar sein!

#### Timeline-Vorschau (NEU)

Die Timeline soll **dauerhaft** im RFP/Lead angezeigt werden:

```
┌──────────────────────────────────────────────────────────────┐
│  PROJEKT-TIMELINE (geschätzt)                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Setup & Konzeption    ████████░░░░░░░░░░░░░░░░  15 Tage    │
│  Design & Prototyping  ░░░░░░░░████████░░░░░░░░  20 Tage    │
│  Frontend Development  ░░░░░░░░░░░░░░░░████████  30 Tage    │
│  Backend/CMS           ░░░░░░░░░░░░████████████  25 Tage    │
│  Integration & Test    ░░░░░░░░░░░░░░░░░░░░████  10 Tage    │
│  Go-Live & Hypercare   ░░░░░░░░░░░░░░░░░░░░░░██   5 Tage    │
│                                                              │
│  Gesamt: ~105 Tage (ca. 5 Monate)                           │
│  Projektstart: [Datum aus RFP oder TBD]                     │
│  Go-Live Target: [Berechnet oder aus RFP]                   │
└──────────────────────────────────────────────────────────────┘
```

**Berechnung basiert auf:**
- Content-Volumen (Seiten, Content-Typen)
- Komponenten-Komplexität
- Integrations-Anforderungen
- Team-Größe (Standard: 3-4 Personen)

### Phase 2: Vollumfänglicher Scan (BU Lead)

Wenn ein RFP an eine Business Unit geroutet wird, wird er zum **Lead** und erhält einen vollumfänglichen Scan.

#### Website Audit Integration

Der bestehende **Website Audit Skill** liefert:

| Daten | Beschreibung | Nutzen für BU Lead |
|-------|--------------|-------------------|
| **Komponenten** | UI-Patterns, Häufigkeit, Varianten | Aufwandsschätzung |
| **Screenshots** | Visuelle Dokumentation aller Seiten | Schneller Überblick |
| **Content-Typen** | Strukturierte vs. unstrukturierte Inhalte | Migrations-Planung |
| **Tech Stack** | CMS, Frameworks, Libraries | Team-Staffing |
| **Integrationen** | APIs, Third-Party Services | Risiko-Assessment |
| **Performance** | Core Web Vitals, Page Speed | Benchmark |
| **SEO** | Meta, Structure, Accessibility | Scope-Definition |
| **Legal** | Cookie-Banner, Datenschutz, Impressum | Compliance |

#### Vertragsmodell-Analyse (NEU)

**Automatische Erkennung aus RFP:**

| Vertragstyp | Indikatoren | Risiko-Level |
|-------------|-------------|--------------|
| **Time & Material (T&M)** | "nach Aufwand", "Stundensätze", "agil" | Niedrig |
| **Festpreis** | "Pauschal", "Budget: X€", "nicht zu überschreiten" | Hoch |
| **Rahmenvertrag** | "Abruf", "Kontingent", "Laufzeit X Jahre" | Mittel |
| **Hybrid** | "Festpreis für Phase 1, T&M für Phase 2" | Mittel |

**Risiko-Flags bei Festpreis:**
- [ ] Unrealistische Timeline
- [ ] Unklare Anforderungen ("und weitere Features")
- [ ] Kein Change Request Prozess definiert
- [ ] Penalty-Klauseln bei Verzug

#### Rechtliche Analyse (NEU - erweitert)

**Zu prüfende Aspekte:**

| Kategorie | Prüfpunkte |
|-----------|------------|
| **Haftung** | Haftungsbegrenzung, Gewährleistung, SLA-Penalties |
| **IP/Rechte** | Urheberrecht, Lizenzen, Open Source Compliance |
| **Datenschutz** | DSGVO, Auftragsverarbeitung, Datenexport |
| **Compliance** | Branchenspezifisch (Pharma, Finance, Public Sector) |
| **Kündigungs-Klauseln** | Exit-Szenarien, Übergabe-Pflichten |

**Output: Legal Risk Score (1-10) mit Begründung**

#### Projekt-Timeline (Detail für BU Lead)

Erweiterte Timeline mit Abhängigkeiten:

```
Phase                    | Dauer  | Abhängig von        | Team
-------------------------|--------|---------------------|------------------
1. Kickoff & Discovery   | 5 Tage | -                   | PL, UX, Tech Lead
2. Konzeption            | 10 Tage| Phase 1             | UX, Architect
3. Design System         | 15 Tage| Phase 2             | Designer, Frontend
4. CMS Setup             | 10 Tage| Phase 2             | Backend, DevOps
5. Content-Modellierung  | 10 Tage| Phase 4             | Backend, Content
6. Frontend Development  | 30 Tage| Phase 3, 4          | Frontend Team
7. Backend/Integrationen | 25 Tage| Phase 4             | Backend Team
8. Content-Migration     | 15 Tage| Phase 5             | Content, Backend
9. QA & Testing          | 10 Tage| Phase 6, 7          | QA, Alle
10. Go-Live              | 5 Tage | Phase 9             | DevOps, PL
```

### Phase 3: Bid/No-Bid Entscheidung (BU Lead)

#### Entscheidungs-Dashboard

Der BU Lead sieht alle relevanten Daten auf einen Blick:

```
┌─────────────────────────────────────────────────────────────┐
│  LEAD: [Kundenname] - [Projektname]                         │
│  Status: Awaiting BU Decision                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  QUICK FACTS                                                │
│  ───────────                                                │
│  Budget: 250.000 € (Festpreis)          ⚠️ Risiko: Mittel   │
│  Timeline: 6 Monate                     ✅ Realistisch      │
│  Vertragstyp: Festpreis                 ⚠️ Change Requests? │
│  Tech Stack: Drupal 10                  ✅ Kernkompetenz    │
│                                                             │
│  SCORING                                                    │
│  ───────                                                    │
│  Capability Match:     ████████░░  85%                      │
│  Strategic Fit:        ██████░░░░  60%                      │
│  Deal Quality:         ███████░░░  70%                      │
│  Competition Risk:     ████░░░░░░  40% (niedrig = gut)      │
│  Legal Risk:           ███░░░░░░░  30% (niedrig = gut)      │
│                                                             │
│  TIMELINE PREVIEW                                           │
│  ────────────────                                           │
│  [Gantt-Chart oder Timeline-Balken]                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │   🟢 BIT    │  │  🔴 NO BIT  │                          │
│  └─────────────┘  └─────────────┘                          │
│                                                             │
│  Bei NO-BIT (optional):                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Grund (Freitext):                                       ││
│  │ [________________________________________________]      ││
│  │ z.B. "Budget unrealistisch", "Kein Drupal-Fit"          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Team-Staffing (nach BIT)

#### Mitarbeiter-Matching basierend auf Website-Audit

Die gecrawlten Daten werden für intelligentes Staffing genutzt:

| Website-Daten | Matching-Kriterium | Mitarbeiter-Skills |
|---------------|-------------------|-------------------|
| CMS: Drupal 10 | Exact Match | drupal, drupal-10 |
| React Components | Framework | react, typescript |
| GSAP Animations | Specialty | animation, gsap |
| Elasticsearch | Integration | elasticsearch, search |
| Multilingual (5 Sprachen) | Complexity | i18n, translation-mgmt |

#### Staffing-Vorschlag

```
┌─────────────────────────────────────────────────────────────┐
│  TEAM-VORSCHLAG                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Rolle              │ Vorschlag        │ Match │ Verfügbar │
│  ─────────────────────────────────────────────────────────│
│  Project Lead       │ Max Mustermann   │  95%  │ ✅ Ab 01.03│
│  Tech Lead          │ Anna Schmidt     │  90%  │ ✅ Ab 15.02│
│  Frontend Dev       │ Tim Weber        │  85%  │ ⚠️ 50%    │
│  Frontend Dev       │ Lisa Müller      │  80%  │ ✅ Ab 01.03│
│  Backend Dev        │ Jan Becker       │  92%  │ ✅ Ab 01.03│
│  UX Designer        │ Sarah Koch       │  88%  │ ✅ Sofort  │
│                                                             │
│  Gesamt-Match: 88%                                          │
│  Team-Verfügbarkeit: Ab 01.03.2026                          │
│                                                             │
│  [Team bestätigen & benachrichtigen]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Datenmodell-Erweiterungen

#### RFP → Lead Transformation

```typescript
// Status-Enum erweitern
type OpportunityStatus =
  | 'draft'           // RFP angelegt
  | 'qualifying'      // Quick Scan läuft
  | 'qualified'       // Quick Scan fertig, wartet auf Routing
  | 'routed'          // An BU geroutet → wird zu "Lead"
  | 'scanning'        // Vollumfänglicher Scan läuft
  | 'pending_decision'// Wartet auf BU Lead Entscheidung
  | 'bid'             // BIT entschieden
  | 'no_bid'          // NO BIT entschieden
  | 'staffing'        // Team wird zusammengestellt
  | 'handed_off';     // An Team übergeben

// Neues Feld für Lead-Transformation
interface Opportunity {
  // ... existing fields ...

  // NEU: Lead-spezifische Felder (nach Routing)
  becameLeadAt?: Date;           // Zeitpunkt der Transformation
  fullScanResult?: FullScanResult;
  contractAnalysis?: ContractAnalysis;
  legalRiskAssessment?: LegalRiskAssessment;
  projectTimeline?: ProjectTimeline;
  staffingProposal?: StaffingProposal;
}
```

#### Timeline-Schema

```typescript
interface ProjectTimeline {
  phases: ProjectPhase[];
  totalDays: number;
  estimatedStart?: Date;
  estimatedGoLive?: Date;
  confidence: number; // 0-100
  assumptions: string[];
}

interface ProjectPhase {
  name: string;
  durationDays: number;
  dependencies: string[]; // Phase names
  requiredRoles: string[];
  parallelizable: boolean;
}
```

#### Contract Analysis Schema

```typescript
interface ContractAnalysis {
  type: 'tm' | 'fixed_price' | 'framework' | 'hybrid';
  budget?: number;
  currency: string;
  indicators: string[];      // Textstellen die zum Typ führten
  riskFlags: RiskFlag[];
  changeRequestProcess: boolean;
  penaltyClauses: boolean;
  confidence: number;
}

interface RiskFlag {
  category: 'timeline' | 'scope' | 'budget' | 'legal' | 'technical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation?: string;
}
```

---

**Status**: MVP Specification Complete - Ready for Implementation
**Last Updated**: 2026-01-20
**Author**: Marc Philipps + Claude
**Source**: Francesco Raaphorst Interview + BD Evaluation Criteria Session + Architecture Interview 2026-01-20
**Tech Stack**: Vercel AI SDK + Next.js 16 + ShadCN + Tailwind v4

**Key Features (MVP)**:
- **Multi-Agent System**: 10 spezialisierte Agents mit dynamischem Coordinator
- **Agent-Native Architecture**: Agentic Loop, Coordinator entscheidet dynamisch
- **Embeddings**: text-embedding-3-large via adesso AI Hub, SQLite vec0
- **Checkpoint System**: Filesystem-basiert (JSON), crash-resilient
- **Legal Agent**: Vertragstyp-Erkennung, Risiko-Assessment, Compliance-Check
- **Master Data**: Zentrale DBs für Referenzen, Kompetenzen, Wettbewerber (Crowdsourced)
- **Entscheidungsbaum**: Interaktive Visualisierung der Bid/No Bid Empfehlung
- **Red Flag Detection**: Automatische Erkennung unrealistischer Budget/Timeline
- **Account-Hierarchie**: Opportunities gruppiert nach Kunden
- **Two-Phase Company Analysis**: Quick Scan (BD) + Deep Migration (BL)
- **Multi-CMS Baselines**: Drupal, Ibexa, Magnolia, Sulu, Firstspirit
- **Agent Native Transparency**: Full Chain-of-Thought, Live Streaming
- **Duplicate Detection**: Automatisches Mergen bei hoher Similarity

**Architecture Decisions (2026-01-20)**:
- MCP: Multi-Source (öffentliche Daten), kein Login
- Embeddings: text-embedding-3-large, SQLite vec0 (< 10k RFPs)
- Orchestrierung: Agentic Loop (Coordinator entscheidet dynamisch)
- Error Handling: Checkpoint-basiert (Filesystem JSON)
- Human-in-Loop: Nein (vollautomatisch, < 70% Confidence → Eskalation)
- Notifications: In-App only (kein Slack)
- Retention: Unbegrenzt (komprimiert nach 90 Tagen)
- Timezone: Berlin (lokal)

**Hybrid-Orchestrierung**:
1. Parallel: Extraction, Tech, Legal (Quick), Commercial, Competition, Reference Agents
2. Dynamisch: Coordinator Agent wählt zur Laufzeit welche Agents wann
3. Background: Deep Analysis Agent nach BL-Zuweisung

**Next Step**: `/plan` for implementation plan
