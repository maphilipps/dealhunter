# Feature Specification: Dealhunter - AI-Powered Company Intelligence Platform

## Overview

Dealhunter ist eine KI-gestützte Plattform für Business Development in der Digital Experience bei adesso. Sie analysiert Unternehmen umfassend basierend auf dem Unternehmensnamen - inklusive automatischer Entdeckung aller Webseiten, vollständiger Unternehmensanalyse, Technologie-Stack, Digital Maturity, Risiken/Chancen, Leadership-Background-Checks und Unternehmensbewertung basierend auf aktuellen Nachrichten/Schlagzeilen. Die Plattform nutzt Agent Native Principles mit vollständiger Transparenz und liefert in ~2 Minuten comprehensive Company Intelligence.

bunx --bun shadcn@latest create --preset "https://ui.shadcn.com/init?base=radix&style=vega&baseColor=neutral&theme=neutral&iconLibrary=lucide&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=next" --template next

## Background

Das BD-Team der Digital Experience bei adesso verbringt signifikante Zeit mit Recherche von potenziellen Kunden - von Unternehmensanalyse über Webseiten-Tech-Stack bis hin zu Lead Scoring und M&A-Recherche. Dealhunter automatisiert diesen Prozess durch:

- **Multi-Webseiten Auto-Discovery**: Automatische Findung aller Webseiten eines Unternehmens

- **Webseiten Deep Dive**: Tech Stack, Performance, UX, SEO, MarTech für alle gefundenen Webseiten

  - Components (samt Bilder und Datenstruktur)
  - Verschiedene "Paragraphs"
  - etc. Bitte ergänzen.

- **Company Research**: Executive Summary, Leadership-Background-Checks, News/Headlines Analysis

- **Digital Maturity Assessment**: Performance, UX, Accessibility, SEO Bewertung

- **Valuation from News**: Unternehmensbewertung basierend auf aktuellen Meldungen/Schlagzeilen

- **LOI Recommendations**: Letter of Intent Struktur für Private M&A Deals

- **Lead Scoring**: Automatische Priorisierung basierend auf allen Signalen

  

## User Stories

- Als **BD Manager** möchte ich nur den Unternehmensnamen eingeben und automatisch alle Webseiten + vollständige Analyse erhalten
- Als **Sales Consultant** möchte ich Lead Scoring, Tech Stack und Pitch Recommendations erhalten
- Als **Digital Experience Experte** möchte ich Technologie-Schwachstellen über alle Webseiten hinweg identifizieren
- Als **M&A Analyst** möchte ich Executive Summary, Leadership Checks, Valuation und LOI Recommendations erhalten
- Als **Management** möchte ich Comprehensive Company Reports für Investment-Entscheidungen erhalten

## MVP Scope & Goals

### Vision Statement
Dealhunter automatisiert die zeitaufwendige Unternehmensrecherche für das BD-Team der Digital Experience bei adesso. Von Unternehmensname zu Comprehensive Company Intelligence in ~2 Minuten.

### MVP Goals (Phase 1)
1. **Single Company Analysis**: Quick Scan (30s) und Deep Dive (2min) für einzelne Unternehmen
2. **Agent Native Transparenz**: Volle Sichtbarkeit aller Agent-Aktionen während Analyse
3. **Actionable Insights**: Lead Scoring, Tech Stack Gaps, Pitch Recommendations
4. **M&A Intelligence**: Executive Summary, Leadership Checks, Valuation, LOI Recommendations

### Success Criteria
- ✅ User kann Unternehmensnamen eingeben → erhält vollständige Analyse in <2 Minuten
- ✅ Alle Webseiten eines Unternehmens werden automatisch entdeckt
- ✅ Tech Stack, Performance, UX, SEO werden pro Webseite analysiert
- ✅ Lead Score (0-100) mit Digital Maturity Assessment
- ✅ Agent-Aktionen sind in Echtzeit sichtbar (Agent Native)
- ✅ Valuation basierend auf News/Headlines + LOI Recommendations
- ✅ Internes Auth (Email/Password), kein SSO benötigt

### Non-Goals (MVP)
- ❌ Competitor Analysis (Vergleich mehrerer Unternehmen)
- ❌ Batch Analysis (CSV Upload für Massen-Analyse)
- ❌ PDF Export (Full Report, One-Pager, etc.)
- ❌ CRM Export (HubSpot/Salesforce)
- ❌ Team Sharing (Geteilte Analysen)
- ❌ Admin Dashboard (Monitoring/User Management)
- ❌ Auto-Updates (Automatische Re-Analyze)
- ❌ Paid APIs für Leadership Checks (Sanctions/FBI)

### Target Audience (MVP)
- **Primary**: BD Manager & Sales Consultants bei adesso Digital Experience
- **Secondary**: M&A Analysts für Private Deals
- **Tertiary**: Management für Investment-Entscheidungen

### Usage Context
- **Business Development**: Identifiziere potenzielle Kunden basierend auf Tech Stack und Digital Maturity
- **Lead Scoring**: Priorisiere Unternehmen basierend auf Adesso-Stack (Drupal, TYPO3, Sitecore)
- **M&A Research**: Executive Summary, Valuation, LOI Structure für Private Deals
- **Competitive Intelligence**: Verstehe Marktpositionierung und Technologie-Landschaft

## Functional Requirements

### Core Functionality

#### 1. Analyse-Arten (MVP)
- **Quick Scan** (MVP): Unternehmens-Info + Haupt-Webseite Tech Stack (30 Sekunden)
- **Deep Dive** (MVP): Full Analyse mit allen Webseiten, Company Research, Valuation, LOI (2 Minuten)
- **Competitor Analysis** (Phase 2): Vergleich von 2-5 Unternehmen
- **Batch Analysis** (Phase 2): Massen-Analyse von 10+ Unternehmen aus CSV/Liste

#### 2. Analyse-Workflow (MVP - Deep Dive)
1. **Input**: Unternehmensname (required) + URL (optional) + Ort (optional, bei Ambiguität required)
2. **Company Discovery Phase**: Unternehmens-Info finden, alle Webseiten discoveren
3. **Multi-Site Crawling Phase**: Alle gefundenen Webseiten via Playwright crawlen
4. **Tech Detection Phase**: CMS, Frameworks, Libraries, Analytics, Hosting Recognition (pro Webseite) via Wappalyzer Skills
5. **Performance Phase**: Core Web Vitals, PageSpeed, Lighthouse Scores (pro Webseite) via PageSpeed API + Lighthouse CI
6. **UX Analysis Phase**: Design Quality, Accessibility, User Journey, Mobile Experience (pro Webseite)
7. **SEO & Content Phase**: Meta-Tags, Structured Data, Content Quality, Rankings (pro Webseite)
8. **MarTech Detection Phase**: CRM, Marketing Automation, Chatbots, Conversion Tools (pro Webseite)
9. **Company Research Phase**: Executive Summary, Leadership Identification, News/Headlines Analysis via Google RSS + Bing API
10. **Leadership Vetting Phase**: Background Checks via Public Sources (LinkedIn, Press, Company Website)
11. **Valuation Phase**: Unternehmensbewertung basierend auf News/Headlines/Market Data
12. **LOI Generation Phase**: Letter of Intent Struktur und Deal Terms
13. **Scoring Phase**: Lead Score berechnen, Digital Maturity bewerten
14. **Report Generation**: Comprehensive Company Report mit allen Sektionen

**Note**: Quick Scan (30s) führt nur Phasen 1-5 durch, fokussiert auf Haupt-Webseite.

#### 3. Live Updates (Agent Native)
- **Volle Transparenz**: Alle Agent-Aktionen sind sichtbar
- **Fortschrittsanzeige**: 13 Phasen mit individueller Progress-Bar
- **Real-Time Updates**: WebSocket-basiert, funktioniert auch wenn Tab im Hintergrund
- **Agent-Thinking**: User sieht, welche Agenten welche Tools nutzen (z.B. \"Discovered 3 websites\", \"Analyzing Lighthouse scores for site 2/3...\")

### User Interface

#### Dashboard
- Liste gespeicherter Analysen mit Suche nach Company
- Filter nach Branche, Tech Stack, Lead Score, Datum
- Lead Score Visualisierung (Farbcodierung: Grün >70, Gelb 40-70, Rot <40)
- \"Analyze Company\" CTA für neue Analyse

#### New Analysis Flow
1. **Unternehmensname Input**: Haupt-Input-Feld (required)
2. **Optionale Felder**: URL (wenn bekannt), Ort (wenn relevant für Disambiguierung)
3. **Analyse-Typ**: Radio-Buttons für Quick Scan / Deep Dive / Competitor Analysis
4. **Batch Upload**: Für CSV mit 10+ Unternehmensnamen (Bulk Analysis)
5. **Start Analysis**: Button mit \"This will take about 2 minutes\" Hinweis

#### Progress Screen
- Overall Progress % (0-100)
- Aktive Phase mit Sub-Task (z.B. \"Company Discovery - Found 3 websites...\")
- Verbleibende Phasen als Liste mit Status
- Live Agent Activities (z.B. \"Crawling site 2/3: careers.company.com\", \"Detected Drupal 7 on main site\")

#### Results Dashboard

**Header**
- Unternehmensname, Alle gefundenen Webseiten (Tabs/Dropdown), Actions (Save, Delete, Export PDF, Re-analyze)

**Company Overview**
- Lead Score Card (0-100) + Maturity Level
- Quick Insights (3-5 Key Takeaways)
- Analysis Coverage Checklist

**Executive Summary**
- 2-3 Paragraphen Zusammenfassung des Unternehmens
- Business Modell, Hauptprodukte/Dienstleistungen, Marktpositionierung
- Aktuelle Entwicklungen basierend auf News/Headlines

**Webseiten Analysis**
- Tabs für jede gefundene Webseite (z.B. \"Main Site\", \"Careers\", \"Blog\")
- Pro Webseite: Tech Stack, Performance, UX, SEO, MarTech
- Aggregierte Tech Stack Übersicht über alle Webseiten

**Key Risks**
- 8-10 Bulleted Risiken (Business, Technology, Financial, Market)
- Basiert auf News/Headlines und Website Analysis

**Opportunities**
- 8-10 Chancen (Tech Upgrades, Market Expansion, Synergies)
- Basiert auf Tech Stack Gaps und Market Intelligence

**Leadership**
- Background Check mit Status-Indikatoren (✓ Clean, ⚠ Unknown, ✗ Issue)
- Sanctions Check, FBI Background Check
- Detail-Modal/Drawer pro Person

**Valuation**
- Unternehmensbewertung basierend auf News/Headlines
- Comparable Companies Analysis
- Market Multiples
- Valuation Range

**LOI Recommendations** (nur Private M&A)
- Vorgeschlagene Deal Struktur
- Equity vs. Debt Split
- Earn-out Provisions
- Key Terms & Conditions

**Digital Maturity**
- Radar Chart mit 5 Dimensionen (Tech, Performance, UX, SEO, Content)
- Aggregiert über alle Webseiten

**Pitch Recommendations**
- Tech-based Ansatzpunkte (z.B. \"Drupal 7 → 10 Upgrade Opportunity\")
- BD-relevante Insights für Outreach

#### Export Options
- **Full Company Report PDF**: Umfassender Report mit allen Sektionen
- **Sales One-Pager PDF**: Kompakte 1-Seite für Sales/Cold Calls
- **Tech Deep Dive PDF**: Detaillierte technische Analyse
- **Executive Summary PDF**: Nur Executive Summary + Leadership
- **Valuation & LOI PDF**: Nur Bewertung und LOI Recommendations
- **CRM Export**: Direkter Export zu HubSpot/Salesforce (JSON/CSV)

### Error Handling

| Error Condition | User Message | System Action |
|-----------------|--------------|---------------|
| Unternehmen nicht gefunden | \"Unable to find company. Please check name or add location.\" | Suggest Alternativen, erlaube Korrektur |
| Keine Webseiten gefunden | \"No websites found for this company. Please add URL manually.\" | Erlaube manuelle URL-Eingabe |
| Website nicht erreichbar | \"Unable to reach website. Skipping, continuing with other sites.\" | Logge Fehler, setze mit anderen Sites fort |
| Crawling blockiert (robots.txt) | \"Website blocks automated access. Limited analysis available.\" | Fallback zu öffentlich verfügbaren Daten |
| Timeout (>3min) | \"Analysis taking longer than expected. Continue waiting?\" | Erlaube Abbruch, zeige partielle Ergebnisse |
| Keine Leadership-Daten | \"Unable to identify leadership team. Manual review recommended.\" | Markiere für manuelles Review |
| Keine News/Headlines | \"No recent news found. Valuation based on market data only.\" | Fallback zu Industry Multiples |
| API Rate Limit exceeded | \"Service temporarily unavailable. Retrying in 30s...\" | Auto-Retry mit Backoff |
| Partial Success | \"Analysis completed with warnings. Some sections may be incomplete.\" | Zeige verfügbare Results, markiere fehlende |

## Technical Specifications

### Tech Stack

#### Frontend
- **Framework**: Next.js 15+ (App Router)
- **UI Library**: ShadCN UI (vollständig, alle Komponenten)
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand für Client State
- **Real-Time**: WebSocket oder Server-Sent Events für Live Updates
- **Data Visualization**: Recharts für Radar Charts, Score Cards

#### Backend
- **Runtime**: Node.js mit TypeScript
- **AI/Agents**: Anthropic Agent SDK mit Credentials aus `.claude/settings.json`
- **API**: Next.js API Routes (tRPC für Type-Safety optional)
- **Database**: PostgreSQL (Drizzle ORM) oder MongoDB
- **Queue**: BullMQ oder Inngest für Background Jobs
- **Cache**: Redis für Result-Caching und Rate Limiting

#### AI/ML
- **Primary Model**: Claude Opus 4.5 für Complex Reasoning
- **Company Discovery**: Firecrawl + Company APIs (Open alternatives)
- **Web Crawling**: Firecrawl für Deep Website Crawling
- **Tech Detection**: Wappalyzer, BuiltWith APIs (Open Source Alternativen)
- **Performance**: Google PageSpeed Insights API, Lighthouse CI
- **SEO**: Screaming Frog API Alternative (Open Source)
- **MarTech**: Ghostery/Disconnect APIs für Tracker Detection
- **News/Headlines**: Google News API, Bing News API (Open alternatives)
- **Background Checks**: Open Source Sanctions APIs, FBI Watchlist APIs

### Data Model

```typescript
// Company Analysis Entity
interface CompanyAnalysis {
  id: string
  userId: string
  companyName: string // required
  location?: string
  type: 'quick_scan' | 'deep_dive' | 'competitor' | 'batch'
  status: 'pending' | 'discovering' | 'crawling' | 'detecting' | 'analyzing' | 'researching' | 'vetting' | 'valuing' | 'generating' | 'completed' | 'failed'
  progress: number // 0-100
  currentPhase: AnalysisPhase
  result?: CompanyAnalysisResult
  leadScore: number // 0-100
  maturityLevel: 'emerging' | 'growing' | 'mature' | 'leader'
  createdAt: Date
  updatedAt: Date
}

// Company Analysis Result
interface CompanyAnalysisResult {
  quickInsights: string[] // 3-5 Key Takeaways
  websites: WebsiteAnalysis[] // Alle gefundenen Webseiten
  aggregatedTechStack: TechStack // Aggregiert über alle Webseiten
  companyOverview: CompanyOverview
  keyRisks: string[]
  opportunities: string[]
  leadership: LeadershipReport[]
  valuation?: ValuationResult
  loiRecommendation?: LOIStructure
  digitalMaturity: MaturityRadar
  pitchRecommendations: PitchOpportunity[]
  coverage: AnalysisCoverage
}

// Website Analysis (pro gefundener Webseite)
interface WebsiteAnalysis {
  url: string
  type: 'main' | 'careers' | 'blog' | 'shop' | 'other'
  techStack: TechStack
  performance: PerformanceMetrics
  uxAssessment: UXMetrics
  seoAnalysis: SEOMetrics
  martechStack: MarTechTools
  crawledAt: Date
}

// Company Overview
interface CompanyOverview {
  executiveSummary: string
  businessModel: string
  mainProducts: string[]
  marketPositioning: string
  recentDevelopments: string[] // Aus News/Headlines
  foundedYear?: number
  employeeCount?: number
  revenue?: number
  headquarters?: string
}

// Tech Stack (aggregiert oder pro Webseite)
interface TechStack {
  cms: DetectedTech[]        // WordPress, Drupal, TYPO3, etc.
  frameworks: DetectedTech[]  // React, Vue, Angular, etc.
  libraries: DetectedTech[]   // jQuery, lodash, etc.
  analytics: DetectedTech[]   // GA4, GTM, Matomo, etc.
  hosting: DetectedTech[]     // AWS, Azure, Hetzner, etc.
  ecommerce: DetectedTech[]   // Shopify, Magento, etc.
  search: DetectedTech[]      // Algolia, Elasticsearch, etc.
}

// Detected Tech
interface DetectedTech {
  name: string
  version?: string
  confidence: number // 0-100
  category: string
  detectedAt: Date
  sourceWebsite?: string // Welche Webseite hat diese Tech
}

// Performance Metrics (pro Webseite)
interface PerformanceMetrics {
  coreWebVitals: {
    lcp: { value: number, status: 'good' | 'needs-improvement' | 'poor' }
    fid: { value: number, status: 'good' | 'needs-improvement' | 'poor' }
    cls: { value: number, status: 'good' | 'needs-improvement' | 'poor' }
  }
  lighthouse: {
    performance: number
    accessibility: number
    bestPractices: number
    seo: number
  }
  pageSpeed: number // 0-100
}

// UX Metrics (pro Webseite)
interface UXMetrics {
  designQuality: number // 0-100
  accessibility: number // 0-100
  mobileExperience: number // 0-100
  userJourney: string
  issues: string[]
}

// SEO Metrics (pro Webseite)
interface SEOMetrics {
  metaTags: boolean
  structuredData: boolean
  sitemap: boolean
  robotsTxt: boolean
  ssl: boolean
  contentQuality: number // 0-100
  issues: string[]
}

// MarTech Tools (pro Webseite)
interface MarTechTools {
  crm: DetectedTech[]
  marketingAutomation: DetectedTech[]
  chatbots: DetectedTech[]
  conversionTools: DetectedTech[]
  socialMedia: DetectedTech[]
}

// Leadership Report
interface LeadershipReport {
  name: string
  title: string
  status: 'clean' | 'unknown' | 'issue'
  sanctionsCheck: CheckResult
  fbiCheck: CheckResult
  findings: string[]
  sourceUrl?: string // Wo wurde die Info gefunden
}

// Valuation Result
interface ValuationResult {
  valuationRange: { min: number, max: number, currency: string }
  methodology: string // z.B. \"Based on recent news headlines and market multiples\"
  keyHeadlines: string[] // News/Schlagzeilen die zur Bewertung führten
  comparableCompanies: string[]
  marketMultiples: { metric: string, value: number }
  lastUpdated: Date
}

// LOI Structure (nur Private M&A)
interface LOIStructure {
  purchasePrice: { min: number, max: number, currency: string }
  equityPercentage: number
  debtFinancing: { percentage: number, type: string }
  earnOut: { percentage: number, conditions: string[] }
  keyTerms: string[]
  closingConditions: string[]
}

// Maturity Radar (aggregiert über alle Webseiten)
interface MaturityRadar {
  tech: number // 0-100
  performance: number // 0-100
  ux: number // 0-100
  seo: number // 0-100
  content: number // 0-100
  overall: number // 0-100
}

// Pitch Opportunity
interface PitchOpportunity {
  category: 'upgrade' | 'migration' | 'optimization' | 'modernization'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedValue?: string
  currentTech?: string
  recommendedTech?: string
  targetWebsite?: string // Welche Webseite betrifft dies
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/analyses | Create new company analysis |
| GET | /api/analyses | List user's analyses (paginated, filterable) |
| GET | /api/analyses/:id | Get single analysis with results |
| PUT | /api/analyses/:id | Update analysis (e.g., re-analyze) |
| DELETE | /api/analyses/:id | Delete analysis |
| POST | /api/analyses/batch | Batch analysis from CSV/List |
| GET | /api/analyses/:id/stream | SSE stream for live updates |
| GET | /api/export/:id/full-report | Full Company Report PDF |
| GET | /api/export/:id/sales-one-pager | Sales One-Pager PDF |
| GET | /api/export/:id/tech-deep-dive | Tech Deep Dive PDF |
| GET | /api/export/:id/executive-summary | Executive Summary + Leadership PDF |
| GET | /api/export/:id/valuation-loi | Valuation & LOI PDF |
| POST | /api/export/:id/crm | Export to CRM (HubSpot/Salesforce) |

### Agent Orchestration

```typescript
// Main Agent Supervisor
interface SupervisorAgent {
  orchestrates: [
    'companyDiscoveryAgent',
    'multiSiteCrawlingAgent',
    'techDetectionAgent',
    'performanceAgent',
    'uxAnalysisAgent',
    'seoAnalysisAgent',
    'martechDetectionAgent',
    'companyResearchAgent',
    'leadershipVettingAgent',
    'newsAnalysisAgent',
    'valuationAgent',
    'loiGenerationAgent',
    'scoringAgent',
    'reportGenerationAgent'
  ]
  providesLiveUpdates: true // Agent Native Transparency
}

// Company Discovery Agent
interface CompanyDiscoveryAgent {
  tools: ['company_apis', 'search_engines', 'business_registries']
  output: { companyInfo: CompanyInfo, websites: string[] }
}

// Multi-Site Crawling Agent
interface MultiSiteCrawlingAgent {
  tools: ['firecrawl', 'sitemap_parser', 'html_extractor']
  output: CrawledData[]
}

// Tech Detection Agent
interface TechDetectionAgent {
  tools: ['wappalyzer', 'builtwith_api', 'header_analysis', 'source_code_analysis']
  output: TechStack
}

// Performance Agent
interface PerformanceAgent {
  tools: ['pagespeed_api', 'lighthouse_ci', 'core_web_vitals']
  output: PerformanceMetrics
}

// UX Analysis Agent
interface UXAnalysisAgent {
  tools: ['accessibility_checker', 'mobile_emulator', 'design_analyzer']
  output: UXMetrics
}

// SEO Analysis Agent
interface SEOAnalysisAgent {
  tools: ['meta_tag_analyzer', 'structured_data_checker', 'content_analyzer']
  output: SEOMetrics
}

// MarTech Detection Agent
interface MarTechDetectionAgent {
  tools: ['tracker_detector', 'crm_detector', 'chatbot_detector']
  output: MarTechTools
}

// Company Research Agent
interface CompanyResearchAgent {
  tools: ['company_apis', 'search_engines', 'wikipedia']
  output: CompanyOverview
}

// Leadership Vetting Agent
interface LeadershipVettingAgent {
  tools: ['sanctions_api', 'fbi_watchlist', 'press_search', 'linkedin_search']
  output: LeadershipReport[]
}

// News Analysis Agent
interface NewsAnalysisAgent {
  tools: ['google_news_api', 'bing_news_api', 'press_releases']
  output: { headlines: string[], recentDevelopments: string[] }
}

// Valuation Agent
interface ValuationAgent {
  tools: ['comparable_companies', 'market_multiples', 'news_analyzer']
  output: ValuationResult
}

// LOI Generation Agent
interface LOIGenerationAgent {
  tools: ['deal_structurer', 'debt_calculator', 'term_generator']
  output: LOIStructure
}

// Scoring Agent
interface ScoringAgent {
  tools: ['lead_scorer', 'maturity_calculator', 'pitch_generator']
  output: { leadScore: number, maturityLevel: string, pitchRecommendations: PitchOpportunity[] }
}

// Report Generation Agent
interface ReportGenerationAgent {
  tools: ['executive_summary', 'full_report', 'sales_one_pager', 'valuation_loi']
  output: CompanyAnalysisResult
}
```

### Permissions

| Role | Can View | Can Create | Can Edit | Can Delete |
|------|----------|------------|----------|------------|
| Anonymous | ❌ | ❌ | ❌ | ❌ |
| Authenticated (Adesso) | ✅ (own) | ✅ | ✅ (own) | ✅ (own) |
| Admin | ✅ (all) | ✅ | ✅ (all) | ✅ (all) |

### Authentication

- **Kein SSO**: Einfache Email/Password Auth (NextAuth.js Credentials Provider)
- **Kein OAuth**: Keine Integration mit Google, GitHub, etc.
- **Session Management**: JWT Tokens mit httpOnly Cookies
- **Password Reset**: Email-basiert (SendGrid oder AWS SES)

## Lead Scoring Algorithm

Der Lead Score (0-100) wird basierend auf folgenden Faktoren berechnet:

### Tech Stack Signals (30%)
- **Legacy Tech** (+15 Punkte): Drupal 7, WordPress ohne Updates, jQuery-only
- **Modern Tech** (+10 Punkte): React/Next.js, Vue 3, Headless CMS
- **Adesso-Stack** (+25 Punkte): Drupal, TYPO3, Sitecore (prioritäre Targets)
- **Migration-Ready** (+10 Punkte): Symfony, Laravel (PHP-basiert)

### Digital Maturity (20%)
- **Low Maturity** (+15 Punkte): Keine Analytics, keine SEO, kein CRM
- **High Maturity** (-5 Punkte): Vollständiger MarTech Stack

### Performance Across Sites (15%)
- **Poor Performance** (+10 Punkte): Lighthouse <50 auf allen Sites
- **Good Performance** (-5 Punkte): Lighthouse >90 auf allen Sites

### Company Size (10%)
- **Enterprise** (+15 Punkte): >1000 Employees, >€50M Revenue
- **Mid-Market** (+8 Punkte): 100-1000 Employees, €5-50M Revenue
- **SMB** (+3 Punkte): <100 Employees, <€5M Revenue

### Industry Fit (10%)
- **High Fit** (+10 Punkte): Automotive, Manufacturing, Finance, Healthcare
- **Medium Fit** (+5 Punkte): Retail, Media, Education
- **Low Fit** (0 Punkte): Tech Startups, Agencies (competition)

### M&A Signals (15%)
- **Acquisition Target** (+20 Punkte): Recent news about acquisitions, funding, expansion
- **Growth Stage** (+10 Punkte): Hiring, new products, market expansion
- **Stable** (+5 Punkte): Steady performance, established market position

### Score Interpretation
- **80-100**: Hot Lead - Immediate Action
- **60-79**: Warm Lead - High Priority
- **40-59**: Medium Lead - Monitor
- **20-39**: Cold Lead - Low Priority
- **0-19**: Not Qualified

## Edge Cases & Decisions

### Multi-Webseiten Support
**Question**: Wie werden mehrere Webseiten pro Unternehmen gehandhabt?
**Decision**: Auto-Discovery aller Webseiten, separate Analyse pro Website, Aggregation für Overall View
**Rationale**: Unternehmen haben oft mehrere Webseiten (Main, Careers, Blog, Shop), alle sollten analysiert werden

### Agent Native Transparenz
**Question**: Wie viel vom Agent-Thinking soll dem User gezeigt werden?
**Decision**: Volle Transparenz - alle Agent-Aktionen sind sichtbar
**Rationale**: Gemäß every.to/guides/agent-native müssen User verstehen, was Agenten tun
**Implementation**:
- Regelmäßiger agent-native reviewer während Entwicklung
- `/agent-sdk` Skill MUSS für Agent-SDK-Implementierung genutzt werden
- Link: https://every.to/guides/agent-native

### Offline-Handling
**Question**: Was passiert, wenn User während Analyse offline geht?
**Decision**: Analyse läuft serverseitig weiter, User sieht Ergebnis bei Rückkehr
**Rationale**: Langlaufende Analysen (2+ Minuten) dürfen nicht durch Browser-Events abgebrochen werden

### Disambiguierung bei mehrdeutigen Unternehmensnamen
**Question**: Wie soll mit mehrdeutigen Namen umgegangen werden? (z.B. "Autohaus Müller" gibt es mehrfach)
**Decision**: Ort ist erforderlich bei Ambiguität
**Rationale**: Vermeidet falsche Analysen, sorgt für korrekte Company Discovery
**User Flow**: Wenn mehrere Matches gefunden → Zeige Liste mit Orten → User wählt aus

### Rate Limiting & Cost Control
**Question**: Sollen Analysen limitiert werden?
**Decision**: Keine harten Limits auf Analysen, nur API Rate Limiting für Abuse-Schutz
**Rationale**: Internes MVP-Tool, adesso Projekt ohne Budgetbeschränkung
**Note**: Cost-Monitoring ist für Phase 2 geplant, nicht für MVP

### Re-Analyze & Updates
**Question**: Sollen Analysen automatisch aktualisiert werden?
**Decision**: Nur manuell via "Re-analyze" Button
**Rationale**: User hat volle Kontrolle, keine unnötigen API-Costs
**Future**: Phase 2 könnte optionale Auto-Updates nach X Wochen einführen

### Compliance Standards
**Question**: Welche Compliance-Standards müssen eingehalten werden?
**Decision**: Mindestmaß (DS-GVO für deutsche Unternehmen)
**Rationale**: MVP als internes Tool, keine Enterprise-Compliance benötigt
**Scope**: Datenschutz-Grundverordnung, PII nicht für Training verwenden

### Web Crawling bei robots.txt Blockade
**Question**: Was passiert wenn robots.txt Crawling blockiert?
**Decision**: Wir nutzen Playwright und brauchen die Daten - keine robots.txt Respektierung
**Rationale**: Analyse ist für Business Development, nicht für Indexierung
**Ethics**: Nur öffentliche Webseiten, keine Password-Protected Areas

### Data Retention
**Question**: Wie lange sollen Analyse-Ergebnisse gespeichert bleiben?
**Decision**: Nur manuell durch User, kein Auto-Delete
**Rationale**: Interne BD-Daten sollen langfristig verfügbar bleiben
**Compliance**: DS-GVO-konform durch User-Control (Löschen jederzeit möglich)

### Tech Detection APIs
**Question**: Welche Tech-Detection APIs sollen genutzt werden?
**Decision**: Wappalyzer mit Custom Skills
**Rationale**: Wappalyzer ist Industry Standard, Custom Skills für spezifische Anforderungen
**Implementation**: separate Skills für Tech-Detection bauen

### Performance Testing APIs
**Question**: Welche Performance-Testing APIs?
**Decision**: Hybrid (Google PageSpeed Insights API + Lighthouse CI)
**Rationale**: PageSpeed API für Core Web Vitals (gratis, 25K queries/day), Lighthouse CI für detaillierte Scores

### News & Headlines APIs
**Question**: Welche News APIs für Valuation?
**Decision**: Free/OSS (Google News RSS + Bing News API)
**Rationale**: Keine hohen API-Costs für MVP, öffentliche Quellen ausreichend

### Authentifizierung
**Question**: Wie soll Auth funktionieren?
**Decision**: Nur Email/Password (NextAuth.js Credentials Provider)
**Rationale**: SSO explizit ausgeschlossen, einfache Auth ausreichend für internes Tool
**No Magic Links**: Nur Password-based Auth, keine passwordless Optionen

### Leadership Vetting (MVP Scope)
**Question**: Wie tief für MVP?
**Decision**: Nur Public Sources (LinkedIn, Press, Company Website)
**Rationale**: Keine paid APIs für MVP, Sanctions/FBI Checks für Phase 2
**MVP Includes**: Basic background info aus öffentlichen Quellen

### MVP Feature Scope
**Question**: Welche Features gehören zum MVP?
**Decision**: Single Company Analysis (Quick Scan + Deep Dive)
**Rationale**: Fokus auf Core-Value, Competitor Analysis und Batch für Phase 2
**MVP Includes**:
- ✅ Quick Scan (30 sec)
- ✅ Deep Dive (2 min)
- ✅ Company Discovery
- ✅ Multi-Webseiten Crawling
- ✅ Tech Detection
- ✅ Performance Analysis
- ✅ UX/SEO Analysis
- ✅ Company Research
- ✅ Leadership Vetting (Public Sources nur)
- ✅ News Analysis
- ✅ Valuation
- ✅ LOI Generation
- ✅ Lead Scoring
- ✅ Digital Maturity
- ✅ Pitch Recommendations
**Phase 2**: Competitor Analysis, Batch Analysis, PDF Export, CRM Export

### Legacy Rate Limiting (Updated)
**Question**: Sollen Analysen limitiert werden? (Legacy Question)
**Decision**: Per-User Rate Limits auf API Endpoints (nicht auf Analysen)
**Rationale**: Schutz vor Abuse, aber keine künstliche Begrenzung für legitime BD-Arbeit

### Valuation Data Source
**Question**: Woher kommen Unternehmensbewertungen?
**Decision**: News/Headlines Analysis + Market Multiples
**Rationale**: Keine teuren Financial Data APIs needed, öffentliche News reichen für erste Einschätzung

### Authentifizierung
**Question**: Wie soll Auth funktionieren?
**Decision**: Einfache Email/Password Auth, kein SSO/OAuth
**Rationale**: SSO explizit ausgeschlossen, einfache Auth ausreichend für internes Tool

### Partielle Ergebnisse
**Question**: Was passiert bei Teilerfolgen?
**Decision**: Zeige verfügbare Results, markiere fehlende Sections, erlaube Re-analyze
**Rationale**: Besser partielle Insights als gar keine, User kann entscheiden ob ausreichend

## Out of Scope (MVP)

### Explicitly NOT in MVP
- **Private Credit Analysis**: Credit Underwriting, DSCR, Loan Structure (nicht gefragt)
- **Social Media Analysis**: LinkedIn, Twitter, Facebook Analysis (Phase 2)
- **Review Analysis**: Google Reviews, Trustpilot, Glassdoor (Phase 2)
- **Real-Time Monitoring**: Kontinuierliche Überwachung von Websites (Phase 2)
- **Multi-Language Support**: Aktuell nur DE/EN Markets (Phase 2)

### Phase 2 Features
- **Competitor Analysis**: Vergleich von 2-5 Unternehmen (nicht MVP)
- **Batch Analysis**: CSV Upload für 10+ Unternehmen (nicht MVP)
- **PDF Export**: Full Report, One-Pager, Tech Deep Dive (nicht MVP)
- **CRM Export**: HubSpot/Salesforce Integration (nicht MVP)
- **Leadership Sanctions/FBI Checks**: Paid APIs (nicht MVP, nur Public Sources)
- **Auto-Updates**: Automatische Re-Analyze nach X Wochen (nicht MVP)
- **Team Sharing**: Geteilte Analysen innerhalb BD-Team (nicht MVP)
- **Admin Dashboard**: Monitoring/User Management (nicht MVP)
- **Cost Monitoring**: API-Cost Tracking und Alerts (nicht MVP)

## Testing Requirements

### Unit Tests
- [ ] Company Discovery Logic (Unternehmens-Info finden, Webseiten discovern)
- [ ] Tech Detection Logic (CMS, Frameworks, Libraries)
- [ ] Lead Scoring Algorithm (verschiedene Szenarien)
- [ ] Performance Metrics Calculation
- [ ] Valuation Logic aus News/Headlines
- [ ] LOI Generation Logic

### Integration Tests
- [ ] Agent Orchestration (vollständiger 13-Phasen Workflow)
- [ ] API Endpoints (CRUD Operations)
- [ ] Database Operations (Create, Read, Update, Delete)
- [ ] External API Integrations (Firecrawl, PageSpeed, Wappalyzer, News APIs)

### E2E Tests (Playwright)
- [ ] Happy Path: Company Name → Analyse → Full Result → Export
- [ ] Multi-Website Analyse (3+ Webseiten)
- [ ] Batch Analysis mit CSV Upload
- [ ] Live Updates während Analyse (WebSocket)
- [ ] Error Recovery (Re-analyze nach Fehler)
- [ ] Export Full Report PDF
- [ ] Export Valuation & LOI PDF
- [ ] CRM Export Functionality

### Accessibility Tests
- [ ] Keyboard Navigation
- [ ] Screen Reader Compatibility
- [ ] Color Contrast (WCAG 2.1 Level AA)
- [ ] Focus Management

### Performance Tests
- [ ] Concurrent Analysis Load (10+ gleichzeitig)
- [ ] Multi-Site Crawling (50+ Seiten gesamt)
- [ ] WebSocket Connection Stability
- [ ] API Response Times (p95 < 500ms)

## Security Considerations

### Data Privacy
- **Company Data at Rest**: Encryption mit AES-256
- **Company Data in Transit**: TLS 1.3
- **Data Retention**: User kann Analysen löschen, auto-delete nach 90 Tagen
- **PII Handling**: Unternehmens-Infos und Leadership-Daten werden nicht für Training verwendet

### API Security
- **Authentication**: NextAuth.js mit Email/Password (Credentials Provider)
- **Authorization**: Role-based Access Control (RBAC)
- **Rate Limiting**: Per-User Rate Limits auf API Endpoints (100/hour)
- **Input Validation**: Alle Inputs validieren, sanitizen, Länge checken

### Agent Security
- **Tool Access Control**: Agenten haben nur Zugriff auf explizit erlaubte Tools
- **Output Sanitization**: Alle Agent-Outputs werden validiert vor Speicherung
- **Prompt Injection Prevention**: System Prompts sind hardened

## Deployment Architecture

```
┌─────────────────┐
│   CloudFront    │ (CDN, SSL Termination)
└────────┬────────┘
         │
┌────────▼────────┐
│   Next.js App   │ (Serverless, Edge Functions)
│  (Frontend +    │
│   API Routes)   │
└────────┬────────┘
         │
┌────────▼─────────────────────────────────┐
│          Background Jobs                  │
│  ┌─────────────────────────────────────┐ │
│  │  BullMQ Workers (Agent Execution)  │ │
│  │  - Company Discovery Agent         │ │
│  │  - Multi-Site Crawling Agent       │ │
│  │  - Tech Detection Agent            │ │
│  │  - Performance Agent               │ │
│  │  - UX/SEO Analysis Agent           │ │
│  │  - Company Research Agent          │ │
│  │  - Leadership Vetting Agent        │ │
│  │  - News Analysis Agent             │ │
│  │  - Valuation Agent                 │ │
│  │  - LOI Generation Agent            │ │
│  │  - Scoring Agent                   │ │
│  │  - Report Agent                    │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
         │
┌────────▼────────┐
│  PostgreSQL     │ (Analyses, Companies, Crawled Data)
│  or MongoDB     │
└─────────────────┘
         │
┌────────▼────────┐
│  Redis Cache    │ (Rate Limiting, Result Cache, Session)
└─────────────────┘
```

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to Quick Scan | <30 sec | End-to-End Time |
| Time to Deep Dive | <120 sec | End-to-End Time |
| Live Update Latency | <500ms | WebSocket Round-Trip |
| Crawling Speed | >1 page/sec | Pages crawled per second |
| API Response Time (p95) | <500ms | API Endpoint Latency |
| Concurrent Users | 50+ | Simultaneous Analyses |
| Uptime | 99.9% | Monthly Availability |

## Monitoring & Observability

### Metrics
- Analysis Success Rate (per Type)
- Average Analysis Duration (per Phase)
- Company Discovery Accuracy (wie viele Webseiten gefunden)
- Tech Detection Accuracy (manual validation)
- Lead Score Distribution
- API Response Times (per Endpoint)
- WebSocket Connection Duration

### Logging
- Structured JSON Logs (Pino oder Winston)
- Log Levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs für Request Tracing
- Agent Decision Logging

### Alerts
- Analysis Failure Rate >5%
- API Error Rate >1%
- WebSocket Disconnections >10%
- External API Downtime

## Open Questions

### Phase 2 Considerations
- [ ] Soll es eine Team-Funktion geben für geteilte Analysen innerhalb des BD-Teams? (Phase 2)
- [ ] Soll es ein Admin-Dashbord geben für Monitoring/User Management? (Phase 2)
- [ ] Sollen Branchen-Datenbanken für automatische Branchen-Erkennung genutzt werden? (Phase 2)

### Resolved Questions (MVP)
- [x] **Compliance**: Mindestmaß (DS-GVO) - ✅ RESOLVED
- [x] **Re-Analyze**: Nur manuell, keine Auto-Updates - ✅ RESOLVED
- [x] **Rate Limits**: Keine harten Limits, nur API Protection - ✅ RESOLVED
- [x] **Data Retention**: Manual Only, kein Auto-Delete - ✅ RESOLVED
- [x] **Auth**: Nur Email/Password, kein SSO - ✅ RESOLVED
- [x] **Tech Detection**: Wappalyzer mit Custom Skills - ✅ RESOLVED
- [x] **News APIs**: Free/OSS (Google RSS + Bing) - ✅ RESOLVED
- [x] **Performance APIs**: Hybrid (PageSpeed + Lighthouse CI) - ✅ RESOLVED
- [x] **Leadership Vetting**: Nur Public Sources MVP - ✅ RESOLVED
- [x] **Disambiguierung**: Ort erforderlich bei Ambiguität - ✅ RESOLVED
- [x] **robots.txt**: Playwright, keine Respektierung - ✅ RESOLVED

## References

- Agent Native Guide: https://every.to/guides/agent-native
- Anthropic Agent SDK: https://docs.anthropic.com/
- ShadCN UI: https://ui.shadcn.com/
- Next.js: https://nextjs.org/
- Firecrawl: https://www.firecrawl.dev/
- Wappalyzer: https://www.wappalyzer.com/
- Google PageSpeed Insights API: https://developers.google.com/speed/docs/insights/v5/get-started

---

**Status**: MVP Specification Complete - Ready for Implementation Plan
**Last Updated**: 2025-01-13
**Author**: Marc Philipps
**Context**: Business Development Tool für Digital Experience bei adesso
**Phase**: MVP (Single Company Analysis)
**Next Step**: `/plan` to create implementation plan
