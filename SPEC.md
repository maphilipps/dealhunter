# Feature Specification: Dealhunter - AI-Powered BD Decision Platform

## Overview

Dealhunter ist eine KI-gestützte **End-to-End Business Development Plattform** für adesso. Sie automatisiert den gesamten Akquise-Prozess: von der Anforderungsaufnahme über die **Bit/No Bit Entscheidung** bis zur **Team-Zusammenstellung** - inklusive umfassender Unternehmensanalyse (Tech Stack, Digital Maturity, Leadership, Valuation).

**Der Kern-Flow (Francesco's Vision):**
```
Anforderung hochladen → AI-Extraktion → Bit/No Bit Entscheidung →
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
2. **Muss entscheiden**: Bieten wir an? ("Bit or No Bit")
3. **Muss routen**: Welcher Bereichsleiter ist zuständig?
4. **Muss evaluieren**: Aufwand, Wirtschaftlichkeit, benötigte Skills
5. **Muss Team zusammenstellen**: Wer arbeitet am Angebot?

Dealhunter automatisiert diesen gesamten Prozess mit AI-Unterstützung.

---

## User Stories

### BD Manager
- Als **BD Manager** möchte ich Anforderungen hochladen (PDF, CRM, Freitext) und automatisch eine Bit/No Bit Empfehlung erhalten
- Als **BD Manager** möchte ich den kompletten Pipeline-Status in Echtzeit sehen (volle Transparenz)
- Als **BD Manager** möchte ich bei "No Bit" eine Alternative Empfehlung (anderer Bereich) erhalten

### Bereichsleiter (BL)
- Als **Bereichsleiter** möchte ich automatisch über relevante Opportunities informiert werden
- Als **Bereichsleiter** möchte ich eine erweiterte Auswertung mit Szenario-basierter Kalkulation sehen
- Als **Bereichsleiter** möchte ich interaktiv in Details eintauchen können (Skills, Aufwand, Risiken)
- Als **Bereichsleiter** möchte ich per Knopfdruck ein optimales Team zusammenstellen
- Als **Bereichsleiter** möchte ich das Team automatisch per E-Mail benachrichtigen lassen

### Administrator
- Als **Administrator** möchte ich die BL-Struktur (Bereiche, Technologien, Zuständigkeiten) pflegen
- Als **Administrator** möchte ich Mitarbeiter mit Skills anlegen und verwalten
- Als **Administrator** möchte ich Analytics über Bit/No Bit Entscheidungen sehen

---

## MVP Scope & Goals

### Vision Statement
Dealhunter automatisiert den gesamten BD-Entscheidungsprozess bei adesso: Von der Anforderungsaufnahme zur Team-Benachrichtigung - AI-gestützt, transparent, und mit einer Bit/No Bit Genauigkeit als oberste Priorität.

### MVP Goals
1. **Smart Upload**: Mixed-Format-Upload (PDF, CRM, Freitext) mit AI-Extraktion
2. **Bit/No Bit Entscheidung**: Vollständige Bewertung (Capability, Deal Quality, Strategic Fit, Wettbewerb)
3. **BL-Routing**: Automatische Weiterleitung an zuständigen Bereichsleiter
4. **Erweiterte Auswertung**: Szenario-basierte Kalkulation (Best/Worst/Expected)
5. **Team-Assignment**: AI-Vorschlag mit festen Rollen
6. **Benachrichtigung**: E-Mail + PDF an Team
7. **Company Analysis**: Integrierte Unternehmensanalyse (Tech Stack, Leadership, etc.)

### Success Criteria
- ✅ BD kann Anforderungen in beliebigem Format hochladen
- ✅ Bit/No Bit Entscheidung in 10-30 Minuten
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
4. Weiter zu Bit/No Bit Bewertung

### 2. Bit/No Bit Entscheidung & BD-Bewertung

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
interface BitDecision {
  decision: 'bit' | 'no_bit'
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

**Bei "No Bit":**
- System prüft ob ein anderer Bereich besser passt
- Gibt Alternative Empfehlung (z.B. "Könnte zu WEM passen")
- Zeigt Entscheidungsbaum warum No Bit

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

**Trigger:** Automatisch nach Bit-Entscheidung

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

### 5. Team-Assignment

**AI-Vorschlag:**
- System schlägt optimales Team vor basierend auf:
  - Required Skills (NLP-Match)
  - Verfügbarkeit
  - Erfahrung mit ähnlichen Projekten
  - Rollen-Anforderungen

**Feste Rollen:**
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

**Team-Größe:** Variabel (2-15+ Personen)

**Keine Ablehnung:** BL-Entscheidung ist final

### 6. Benachrichtigungs-System

**Team-Benachrichtigung per E-Mail:**
```
Betreff: [Dealhunter] Angebotsteam für {CustomerName}

Hallo {Name},

du wurdest von {BL-Name} in das Angebotsteam für {CustomerName} aufgenommen.

Deine Rolle: {Role}

Im Anhang findest du alle wichtigen Informationen zum Projekt.

Beste Grüße,
{BL-Name}

---
Automatisch generiert von Dealhunter
```

**PDF-Attachment:**
- Kundenname & Kontakt
- Projekt-Beschreibung
- Scope & Requirements
- Timeline
- Team-Zusammensetzung
- Nächste Schritte

### 7. Zwei-Phasen Company Analysis

Die Company Analysis ist in zwei Phasen aufgeteilt - passend zum BD-Workflow:

#### Phase 1: Quick Scan (für BD, während Bit/No Bit)

**Läuft automatisch nach Upload:**
- **Tech Stack Detection**: CMS, Frameworks, Hosting, Libraries identifizieren
- **Content Volume**: Sitemap analysieren, Seitenanzahl, URL-Patterns
- **Features & Integrations**: Formulare, Suche, APIs, externe Services

**Dauer:** 2-5 Minuten
**Output:** Structured JSON für Bit/No Bit Entscheidung

```typescript
interface QuickScanResult {
  techStack: {
    cms: string | null          // "WordPress", "Drupal", "Typo3", etc.
    cmsVersion?: string
    frameworks: string[]        // ["React", "Vue", "jQuery"]
    hosting: string | null      // "AWS", "Azure", "On-Premise"
  }
  contentVolume: {
    totalPages: number
    pagesByType: { type: string; count: number }[]
    sitemapFound: boolean
  }
  features: {
    forms: string[]             // ["Contact", "Newsletter", "Search"]
    integrations: string[]      // ["Google Analytics", "HubSpot", "Stripe"]
    hasEcommerce: boolean
    hasUserAccounts: boolean
  }
  blRecommendation: {
    recommendedBL: string       // "PHP", "WEM"
    confidence: number          // 0-100
    reasoning: string
    matchedTechnologies: string[]
  }
}
```

#### Phase 2: Deep Migration Analysis (nach BL-Zuweisung)

**Läuft automatisch als Background Job nach Bit + BL-Assignment:**
- **Content Architecture Mapping**: Page Types → Content Types, Components → Paragraphs
- **Migration Complexity**: Export-Möglichkeiten, Datenqualität, Cleanup-Aufwand
- **Accessibility Audit**: WCAG 2.1 Level AA Prüfung, Remediation Effort
- **Aufwandsschätzung**: PT-Schätzung basierend auf Entity-Counts und CMS-Baseline

**Dauer:** 10-30 Minuten (Background Job)
**Trigger:** Automatisch nach `bitDecision: 'bit'` UND `assignedBusinessLineId` gesetzt
**Notification:** BL wird benachrichtigt wenn Analysis fertig

```typescript
interface DeepMigrationResult {
  contentArchitecture: {
    pageTypes: PageTypeAnalysis[]
    components: ComponentAnalysis[]
    taxonomies: TaxonomyAnalysis[]
    mediaTypes: MediaTypeAnalysis[]
  }
  migrationComplexity: {
    exportCapability: 'structured' | 'database' | 'api' | 'scraping'
    dataQuality: 'clean' | 'moderate_cleanup' | 'heavy_cleanup'
    estimatedNodes: number
    complexityScore: 'simple' | 'medium' | 'complex'
  }
  accessibility: {
    wcagLevel: 'A' | 'AA' | 'AAA' | 'non_compliant'
    issueCount: { critical: number; serious: number; moderate: number; minor: number }
    remediationEffort: number // Stunden
  }
  estimation: {
    targetCMS: string              // "Drupal", "Ibexa", "Magnolia"
    baselineUsed: string           // "adessoCMS", "Ibexa Standard", etc.
    totalHours: number
    breakdown: {
      contentTypes: number
      components: number
      migration: number
      accessibility: number
      testing: number
      buffer: number
    }
    confidenceLevel: 'high' | 'medium' | 'low'
    assumptions: string[]
    risks: string[]
  }
}

interface PageTypeAnalysis {
  name: string
  count: number
  fields: string[]
  complexity: 'simple' | 'medium' | 'complex'
  mappedTo: string  // Drupal Content Type, Ibexa Content Type, etc.
}

interface ComponentAnalysis {
  name: string
  frequency: 'high' | 'medium' | 'low'
  complexity: 'simple' | 'medium' | 'complex'
  mappedTo: string  // Paragraph Type, Block Type, etc.
}
```

#### BL-Spezifische Analyse

Die Deep Migration Analysis ist **CMS-spezifisch** basierend auf der BL-Zuweisung:

| Business Line | Technologien | Baselines |
|--------------|--------------|-----------|
| PHP | Drupal, Sulu | adessoCMS (693h), Sulu Standard |
| WEM | Ibexa, Magnolia, Firstspirit | Ibexa Standard, Magnolia Base |

Das Ziel-CMS wird automatisch aus der `BusinessLine.technologies` ermittelt oder vom BL manuell gewählt.

#### BL-Routing mit AI-Empfehlung

**Automatische BL-Empfehlung basierend auf Quick Scan:**
1. AI analysiert detektierten Tech Stack
2. Matched gegen `BusinessLine.technologies` und `keywords`
3. Gibt Empfehlung mit Confidence Score

**BD kann überschreiben:**
- BD sieht AI-Empfehlung
- BD kann anderen BL wählen
- Override wird mit Begründung geloggt

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

  // Bit Decision
  bitDecision: 'bit' | 'no_bit' | 'pending'
  bitDecisionData?: BitDecision
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
  | 'evaluating'         // Bit/No Bit läuft
  | 'bit_decided'        // Bit-Entscheidung getroffen
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
  action: 'bl_override' | 'bit_override' | 'team_change' | 'status_change'
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
| POST | /api/bids/:id/evaluate | Trigger Bit/No Bit evaluation |
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
| GET | /api/analytics/bit-rate | Bit/No Bit statistics |
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

### Multi-Agent System mit Coordinator

**Agent-Übersicht:**

| Agent | Aufgabe | Phase |
|-------|---------|-------|
| **Extraction Agent** | Dokument-Analyse, Strukturierte Extraktion | Upload |
| **Tech Agent** | Tech-Anforderungen analysieren, Kompetenz-Matching | BD |
| **Legal Agent** | Vertragstyp, Risiken, Compliance | BD + BL |
| **Commercial Agent** | Budget, Marge, Wirtschaftlichkeit | BD |
| **Competition Agent** | Wettbewerber identifizieren, Strategie | BD |
| **Reference Agent** | Passende Referenzen finden | BD |
| **Coordinator Agent** | Alle Ergebnisse zusammenführen, Empfehlung erstellen | BD |
| **Deep Analysis Agent** | Migration, Accessibility, PT-Schätzung | BL |

### Hybrid-Orchestrierung

**Ablauf:**
1. **Parallel (Extraktion):** Extraction Agent, Tech Agent, Legal Agent (Quick), Commercial Agent, Competition Agent, Reference Agent laufen gleichzeitig
2. **Sequenziell (Bewertung):** Coordinator Agent erhält alle Ergebnisse, erstellt Gesamtbewertung mit Kontext
3. **Background (Deep):** Nach Bit + BL-Zuweisung startet Deep Analysis Agent

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
  recommendation: 'bit' | 'no_bit'
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
    fundierte Bit/No Bit Empfehlung zu erstellen.

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

function BitEvaluationProgress({ bidId }) {
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

### Structured Output für Bit-Decision

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'

const BitDecisionSchema = z.object({
  decision: z.enum(['bit', 'no_bit']),
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
  schema: BitDecisionSchema,
  prompt: `Triff eine Bit/No Bit Entscheidung für: ${JSON.stringify(requirements)}`
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
  agent: string                   // "bit_evaluator", "quick_scan", "deep_analysis"
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
- **Quick Stats**: Bit-Rate, offene Evaluierungen, zugewiesene Teams
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

#### 4. Bit/No Bit Progress & Entscheidungsbaum
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
- **Analytics**: Bit/No Bit Stats, Pipeline-Metriken
- **Audit Trail**: Override-Logs einsehen

---

## Analytics Dashboard

### Metrics
- **Bit Rate**: % der Bids die "Bit" werden
- **Time to Decision**: Durchschnittliche Zeit bis Bit/No Bit
- **Per BL**: Verteilung nach Bereichsleiter
- **Source Distribution**: Reactive vs Proactive
- **Stage Distribution**: Cold/Warm/RFP

### Visualizations
- Bit/No Bit Pie Chart
- Timeline: Bids over time
- BL Heatmap: Welcher Bereich bekommt wie viele?
- Funnel: Draft → Bit → Assigned → Notified

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
- [ ] Bit/No Bit Scoring Algorithm
- [ ] BL Routing Logic
- [ ] Skill Matching (NLP)
- [ ] Szenario Calculation

### Integration Tests
- [ ] Upload → Extraction → Evaluation Flow
- [ ] BL Routing Accuracy
- [ ] Team Assignment Flow
- [ ] Email Notification Delivery

### E2E Tests (Playwright)
- [ ] Happy Path: Upload → Bit → Team → Notify
- [ ] No Bit with Alternative Recommendation
- [ ] Admin: Create BL, Create Employee
- [ ] BD Pipeline View

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Smart Upload Processing | <30 sec |
| AI Extraction | <60 sec |
| Quick Scan (Phase 1) | 2-5 min |
| Bit/No Bit Decision | 5-15 min |
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

## Open Questions (Resolved)

### Runde 1 (Basis-Interview)
- [x] **AI SDK**: Vercel AI SDK (ai-sdk.dev) - ✅ RESOLVED
- [x] **Document Cleaning**: Optional DSGVO-Bereinigung vor Verarbeitung - ✅ RESOLVED
- [x] **Input Format**: Mixed/Hybrid → Smart Upload - ✅ RESOLVED
- [x] **Bit Criteria**: Vollständige Bewertung - ✅ RESOLVED
- [x] **Routing**: AI-basiert, konfigurierbar - ✅ RESOLVED
- [x] **Kalkulation**: Szenario-basiert - ✅ RESOLVED
- [x] **Team Selection**: AI-Vorschlag - ✅ RESOLVED
- [x] **Slide Deck**: MVP nur PDF - ✅ RESOLVED
- [x] **BD Visibility**: Volle Transparenz - ✅ RESOLVED
- [x] **Wettbewerb**: Nur Präsenz-Check - ✅ RESOLVED
- [x] **Learning**: Kein Learning - ✅ RESOLVED
- [x] **Mobile**: Desktop Only - ✅ RESOLVED
- [x] **Analytics**: Dashboard - ✅ RESOLVED
- [x] **Ablehnung**: Keine (BL final) - ✅ RESOLVED
- [x] **Multi-BL**: Ein BL Only - ✅ RESOLVED
- [x] **Post-Team**: Handoff Complete - ✅ RESOLVED
- [x] **HR Data**: Neu aufbauen - ✅ RESOLVED

### Runde 2 (Company Analysis)
- [x] **Analysis Scope**: Zwei-Phasen (Quick Scan + Deep Migration) - ✅ RESOLVED
- [x] **Quick Scan**: Tech Stack, Content Volume, Features - ✅ RESOLVED
- [x] **Deep Analysis**: Content Architecture, Migration, Accessibility, PT-Schätzung - ✅ RESOLVED
- [x] **Output Format**: In-App JSON Display (kein VitePress) - ✅ RESOLVED
- [x] **CMS Baselines**: Pro Technologie (Drupal, Ibexa, Magnolia, etc.) - ✅ RESOLVED
- [x] **Target System**: Multi-CMS basierend auf BL-Zuweisung - ✅ RESOLVED
- [x] **BL Routing**: AI-Empfehlung + BD kann überschreiben - ✅ RESOLVED
- [x] **Deep Analysis Trigger**: Automatisch nach Bit + BL-Zuweisung - ✅ RESOLVED
- [x] **Analysis Duration**: Background Job (10-30 min) - ✅ RESOLVED
- [x] **Agent Native**: Volle Chain-of-Thought Transparenz - ✅ RESOLVED

### Runde 3 (BD Evaluation Criteria)
- [x] **Subjektive Daten**: Hybrid (System schlägt vor, BD bestätigt/korrigiert) - ✅ RESOLVED
- [x] **Multi-Stage Prozesse**: Nicht in MVP (nur Single-Stage) - ✅ RESOLVED
- [x] **Referenz-Matching**: Ja, mit zentraler Referenz-DB + AI-Matching - ✅ RESOLVED
- [x] **Vertragstyp-Erkennung**: Auto-Erkennung + Risiko-Bewertung - ✅ RESOLVED
- [x] **Zuschlagskriterien**: Deep Analysis (extrahiert, matcht, empfiehlt) - ✅ RESOLVED
- [x] **Dokument-Upload**: PDF + Text Upload möglich - ✅ RESOLVED
- [x] **Red Flags**: Auto-Erkennung basierend auf Scope - ✅ RESOLVED
- [x] **Legal Agent**: Fokus Risiko (BD), Umfassend (BL) - ✅ RESOLVED
- [x] **Compliance**: Vollständig (Vergaberecht, Rahmenverträge, Subunternehmer) - ✅ RESOLVED
- [x] **Risiko-Kategorien**: Multi-Dimensional (Tech, Legal, Commercial, Org, Timeline) - ✅ RESOLVED
- [x] **Hard Stops**: Informativ (zeigt Issues, entscheidet nicht automatisch) - ✅ RESOLVED
- [x] **Output Format**: Angepasstes Web-UI Format - ✅ RESOLVED
- [x] **Referenz-DB**: Zentral (adesso-weit) - ✅ RESOLVED
- [x] **Kompetenz-Matching**: Auto-Matching mit Kompetenz-DB - ✅ RESOLVED
- [x] **Wettbewerber**: Ja, mit Wettbewerber-DB - ✅ RESOLVED
- [x] **Scoring-Modell**: Qualitativ (kein numerisches Scoring) - ✅ RESOLVED
- [x] **Gewichtungen**: Global + Override pro Opportunity - ✅ RESOLVED
- [x] **Empfehlung**: Entscheidungsbaum-Visualisierung - ✅ RESOLVED
- [x] **ML/Historie**: Nicht in MVP - ✅ RESOLVED
- [x] **DB-Pflege**: Crowdsourced mit Admin-Validierung - ✅ RESOLVED
- [x] **Approval**: Kein Approval-Workflow (BD entscheidet) - ✅ RESOLVED
- [x] **Deadline-Tracking**: Dashboard-Anzeige (keine Notifications) - ✅ RESOLVED
- [x] **Website-Analyse**: Automatisch nach Bit - ✅ RESOLVED
- [x] **Subjektive Inputs**: Slider/Rating - ✅ RESOLVED
- [x] **Quick Mode**: Nein, immer volle Analyse - ✅ RESOLVED
- [x] **Dokument-Storage**: Nur extrahierte Daten (kein Original) - ✅ RESOLVED
- [x] **Portal-Integration**: Nicht in MVP - ✅ RESOLVED
- [x] **Outcome-Tracking**: Nur Status (gewonnen/verloren) - ✅ RESOLVED
- [x] **Export**: Nicht in MVP - ✅ RESOLVED
- [x] **Account-View**: Account-Hierarchie - ✅ RESOLVED
- [x] **Agent-Orchestrierung**: Hybrid (Extraktion parallel, Bewertung sequenziell) - ✅ RESOLVED
- [x] **Coordinator Agent**: Ja, dediziert - ✅ RESOLVED
- [x] **Transparenz**: Full Chain-of-Thought - ✅ RESOLVED
- [x] **Re-Run**: Nur komplette Neu-Analyse - ✅ RESOLVED

---

## Phase 2 Features (NOT in MVP)

- Slide Deck Generation (PowerPoint)
- Learning/Feedback Loop (Won/Lost → verbesserte Prognosen, Win-Rate Prediction)
- Mobile Support
- Multi-BL Deals (Joint Bids)
- Post-Handoff Tracking (detailliertes Lessons Learned)
- CRM Integration (HubSpot, Salesforce)
- Team-Member Ablehnung
- Competitor Analysis (tiefgehend)
- Batch Analysis
- Portal-Integration (DTVP, TED, evergabe)
- PDF/Excel Export
- E-Mail Notifications für Deadlines
- Multi-Stage Prozesse (Teilnahmeantrag → Angebot)
- Granularer Agent Re-Run (einzelne Agents wiederholen)

---

**Status**: MVP Specification Complete - Ready for Implementation
**Last Updated**: 2026-01-15
**Author**: Marc Philipps + Claude
**Source**: Francesco Raaphorst Interview + BD Evaluation Criteria Session
**Tech Stack**: Vercel AI SDK + Next.js 15 + ShadCN + Tailwind v4

**Key Features (MVP)**:
- **Multi-Agent System**: 8 spezialisierte Agents mit Coordinator
- **Legal Agent**: Vertragstyp-Erkennung, Risiko-Assessment, Compliance-Check
- **Master Data**: Zentrale DBs für Referenzen, Kompetenzen, Wettbewerber (Crowdsourced)
- **Entscheidungsbaum**: Interaktive Visualisierung der Bit/No Bit Empfehlung
- **Red Flag Detection**: Automatische Erkennung unrealistischer Budget/Timeline
- **Account-Hierarchie**: Opportunities gruppiert nach Kunden
- **Two-Phase Company Analysis**: Quick Scan (BD) + Deep Migration (BL)
- **Multi-CMS Baselines**: Drupal, Ibexa, Magnolia, Sulu, Firstspirit
- **Agent Native Transparency**: Full Chain-of-Thought

**Hybrid-Orchestrierung**:
1. Parallel: Extraction, Tech, Legal (Quick), Commercial, Competition, Reference Agents
2. Sequenziell: Coordinator Agent synthetisiert alle Ergebnisse
3. Background: Deep Analysis Agent nach BL-Zuweisung

**Next Step**: `/plan` for implementation plan
