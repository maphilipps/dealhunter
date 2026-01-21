# QuickScan 2-Phasen-Workflow-Refactoring: Detaillierte Analyse

**Projekt:** Dealhunter - AI-gestützte BD-Entscheidungsplattform
**Datum:** 2026-01-20
**Fokus:** QuickScan Workflow-Refactoring für Website Audit Skill

---

## EXECUTIVE SUMMARY

Das QuickScan-System ist eine AI-gesteuerte Multi-Agent-Architektur zur automatisierten Website-Analyse und Geschäftsbereich-Empfehlung. Die bestehende Implementierung zeigt eine **solide Streaming-Infrastruktur** (SSE-basiert), muss aber für ein 2-Phasen-Workflow-Muster (COLLECT + SYNTHESIZE) sowie Business-Units-Caching optimiert werden.

**Refactoring-Ziele:**

1. Parallele COLLECT-Phase mit Business Units Singleton-Cache
2. Sequential SYNTHESIZE-Phase für Drupal-Mapping-Hints
3. Phase Events für granulares UI-Streaming
4. Website Audit Skill Integration

---

## 1. BESTEHENDE QUICKSCAN-IMPLEMENTIERUNG

### 1.1 Architektur-Überblick

```
Workflow:
┌─────────────────────────────────────────────────────────────┐
│ User startet QuickScan                                      │
│ (startQuickScan action)                                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│ SSE Stream Route                                            │
│ /api/rfps/[id]/quick-scan/stream/route.ts                 │
│ - Erstellt QuickScanRecord in DB                           │
│ - Stellt SSE-Verbindung bereit                             │
│ - Lädt Business Units (SINGLETON CACHE)                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│ runQuickScanWithStreaming()                                 │
│ lib/quick-scan/agent.ts                                    │
│ - Orchestriert alle Sub-Agents                             │
│ - Emittet AgentEvents via Streaming                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│ Sub-Agents (Parallel/Sequential Mix)                       │
│ - Tech Stack Detection (Wappalyzer + HTML patterns)        │
│ - Content Volume Analysis                                  │
│ - Feature Detection                                        │
│ - Navigation Analysis                                      │
│ - Component Extraction                                     │
│ - Migration Complexity Assessment                          │
│ - Decision Maker Research                                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│ Business Unit Recommendation (AI-basiert)                   │
│ - Matching gegen Cached Business Units                     │
│ - Confidence Score Calculation                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│ Database Persist (alle Ergebnisse)                         │
│ RFP Status: quick_scanning → bit_pending                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Dateipfade & Zeilennummern

#### Agent & Orchestration

- **`/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts`**
  - Lines 1-100: Imports und Business Units Singleton Cache (KERN-ELEMENT!)
  - Lines 66-92: `getBusinessUnitsOnce()` & `clearBusinessUnitsCache()` - SINGLETON-PATTERN
  - Lines 100+: `runTechStackDetection()` - Wappalyzer + HTML-Pattern Matching

#### Streaming Infrastructure

- **`/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-types.ts`**
  - Lines 3-14: `AgentEventType` Enum
  - Lines 16-24: `PhaseStartData` & `AnalysisCompleteData` - PHASE EVENTS!
  - Lines 92-102: Union type `AgentEventData` - alle möglichen Event-Typen

- **`/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-emitter.ts`**
  - Lines 11-56: `createAgentEventStream()` - SSE Streaming mit Web Streams API
  - Lines 61-70: `createSSEResponse()` - Proper SSE Headers

#### API Route

- **`/Users/marc.philipps/Sites/dealhunter/app/api/rfps/[id]/quick-scan/stream/route.ts`**
  - Lines 1-30: Authentication & Authorization
  - Lines 74-101: Replaying completed scans via activity log
  - Lines 104-184: Live streaming mit `runQuickScanWithStreaming()`
  - Lines 132-162: DB Update mit ALLEN QuickScan 2.0 Feldern

#### Server Actions

- **`/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/actions.ts`**
  - Lines 19-97: `startQuickScan()` - erstellt initialen QuickScan Record
  - Lines 104-188: `retriggerQuickScan()` - löscht alte, erstellt neue
  - Lines 193-260: `getQuickScanResult()` - parsed ALLE 15+ JSON-Felder!

### 1.3 Event-Type System

**Existing Event Types** (event-types.ts, lines 3-14):

```typescript
enum AgentEventType {
  START = 'start',
  AGENT_PROGRESS = 'agent-progress',
  AGENT_COMPLETE = 'agent-complete',
  DECISION = 'decision',
  COMPLETE = 'complete',
  ERROR = 'error',
  ABORT = 'abort',
  // PHASE EVENTS (NEUE STRUKTUR):
  PHASE_START = 'phase-start',
  ANALYSIS_COMPLETE = 'analysis-complete',
}
```

**Phase Event Data** (lines 16-31):

```typescript
type QuickScanPhase = 'bootstrap' | 'multi_page' | 'analysis' | 'synthesis';

interface PhaseStartData {
  phase: QuickScanPhase;
  message: string;
  timestamp: number;
}

interface AnalysisCompleteData {
  analysis: string; // z.B. 'techStack', 'accessibility', 'seo', etc.
  success: boolean;
  duration: number;
  details?: string;
}
```

---

## 2. EVENT-TYPES UND STREAMING INFRASTRUKTUR

### 2.1 Streaming Architecture

Die Streaming-Basis ist **vollständig** implementiert und robust:

| Komponente        | Datei                                          | Status      | Details                                       |
| ----------------- | ---------------------------------------------- | ----------- | --------------------------------------------- |
| **Event Types**   | `lib/streaming/event-types.ts`                 | ✅ Complete | Enum + Data Structures für alle Event-Typen   |
| **Event Emitter** | `lib/streaming/event-emitter.ts`               | ✅ Complete | Web Streams API, SSE-Encoding, Error Handling |
| **SSE Response**  | `lib/streaming/event-emitter.ts:61-70`         | ✅ Complete | Proper Cache-Control, Keep-Alive Headers      |
| **API Route**     | `app/api/rfps/[id]/quick-scan/stream/route.ts` | ✅ Complete | Auth, DB Persistence, Replay-Modus            |

### 2.2 Phase Event Structure (READY FOR 2-PHASE WORKFLOW)

**Bereits vorhanden** (event-types.ts, lines 11-31):

- `PHASE_START` - marks beginning of new phase
- `ANALYSIS_COMPLETE` - marks completion of specific analysis

**Refactoring-Potenzial:**

- Phase Events können direkt für COLLECT/SYNTHESIZE genutzt werden
- Keine Breaking Changes nötig
- Existing Agent Progress Events bleiben erhalten

---

## 3. UI-KOMPONENTEN FÜR AGENT-ACTIVITY

### 3.1 Agent Activity View

**Datei:** `/Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-activity-view.tsx`

**Hauptkomponenten** (lines 39-281):

```typescript
export function AgentActivityView({ events, isStreaming }: AgentActivityViewProps) {
  // Line 43-106: Event grouping by agent name
  const agentGroups = useMemo(() => {...}, [events]);

  // Line 109-113: Progress calculation
  const progress = useMemo(() => {...}, [agentGroups]);

  // Line 175-281: Render Agent Cards mit Collapsibles
}
```

**Agent Color Mapping** (lines 140-157):

- Website Crawler (cyan)
- Tech Stack Analyzer (violet)
- Content Analyzer (emerald)
- Feature Detector (amber)
- Business Analyst (rose)
- PLUS Intelligent Agent Framework: Researcher, Evaluator, Optimizer

**Rendering Strategy:**

- Line 203-262: Collapsibles für expandable Agent-Details
- Line 224: Message count display
- Line 228-232: Duration formatting
- Line 243-258: Timeline-ähnliche Message-Anzeige mit Timestamps

### 3.2 Agent Message Component

**Datei:** `/Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-message.tsx`

**Core Features** (lines 31-201):

```typescript
export function AgentMessage({ event }: AgentMessageProps) {
  // Line 36-41: Only render progress/complete events
  // Line 43-59: Extract data from event
  // Line 61-66: Copy-to-Clipboard Handler
  // Line 68-94: Agent Color Mapping
  // Line 104-200: Render Logic
}
```

**Message Elements:**

- Line 108-110: Timestamp (formatted HH:MM:SS)
- Line 113-118: Agent Badge mit dynamischer Farbe
- Line 123-125: Message Content
- Line 128-132: Details (Chain-of-Thought)
- Line 135-139: Confidence Indicator
- Line 142-156: Tool Calls (expandable)
- Line 159-179: Reasoning (collapsible)
- Line 182: Sources Component
- Line 186-197: Copy Button (hover-activated)

---

## 4. SCHEMA-DEFINITIONEN

### 4.1 Quick Scan Result Schema

**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/schema.ts`

#### Core Schemas (Lines 6-79):

| Schema                     | Lines   | Fields                                                                         | Purpose              |
| -------------------------- | ------- | ------------------------------------------------------------------------------ | -------------------- |
| `techStackSchema`          | 6-52    | CMS, Framework, Backend, Hosting, CDN, Server, Libraries, Analytics, Marketing | Tech Stack Detection |
| `contentVolumeSchema`      | 59-77   | pageCount, contentTypes, mediaAssets, languages, complexity                    | Content Analysis     |
| `accessibilityAuditSchema` | 84-119  | Score, WCAG Level, Issue Counts, Specific Checks, Top Issues                   | A11y Audit           |
| `seoAuditSchema`           | 142-167 | Score, SEO Checks, Issues                                                      | SEO Analysis         |

#### QuickScan 2.0 Schemas (Lines 388-717):

| Schema                          | Lines   | Purpose                   | For Drupal?                        |
| ------------------------------- | ------- | ------------------------- | ---------------------------------- |
| `siteTreeSchema`                | 408-442 | Full hierarchical sitemap | ✅ Navigation Structure            |
| `contentTypeDistributionSchema` | 449-465 | AI-classified page types  | ✅ Content Types / Paragraph Types |
| `migrationComplexitySchema`     | 472-519 | Effort estimation         | ✅ Migration Planning              |
| `decisionMakersResearchSchema`  | 539-559 | Contact research          | ✅ Stakeholder Analysis            |
| `extractedComponentsSchema`     | 689-701 | UI Component Detection    | ✅ Drupal Mapping!                 |

#### Drupal-Mapping Hints (types.ts, Lines 392-421):

**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/types.ts`

```typescript
// Lines 392-399: DrupalMappingData Interface
export interface DrupalMappingData {
  suggestedParagraphTypes: string[]; // z.B. ["hero", "cards_grid", "accordion"]
  suggestedContentTypes: string[]; // z.B. ["article", "event", "product"]
  suggestedTaxonomies: string[]; // z.B. ["category", "tag", "location"]
  suggestedMediaTypes: string[]; // z.B. ["image", "video", "document"]
  estimatedViews: number; // Geschätzte Views basierend auf Listen
}

// Lines 401-422: ExtractedComponentsData (WITH Drupal Mapping!)
export interface ExtractedComponentsData {
  navigation: NavigationComponentData[];
  contentBlocks: ContentBlockComponentData[];
  forms: FormComponentData[];
  mediaElements: MediaComponentData[];
  interactiveElements: string[];
  drupalMapping?: DrupalMappingData; // <-- DRUPAL MAPPING HINTS!
  summary: {
    totalComponents: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    uniquePatterns: number;
    estimatedComponentTypes: number;
    estimatedDrupalEntities?: {
      // <-- ENTITY ESTIMATION!
      contentTypes: number;
      paragraphTypes: number;
      taxonomies: number;
      views: number;
    };
  };
}
```

### 4.2 Database Schema

**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts`

#### quickScans Table (Lines 412-479):

```typescript
export const quickScans = sqliteTable(
  'quick_scans',
  {
    // Identity & Relations
    id: text('id').primaryKey(),
    rfpId: text('rfp_id')
      .notNull()
      .references(() => rfps.id),
    websiteUrl: text('website_url').notNull(),

    // Status
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }),

    // CORE RESULTS (Tech Stack, Content, Features)
    techStack: text('tech_stack'), // JSON
    cms: text('cms'),
    framework: text('framework'),
    hosting: text('hosting'),
    pageCount: integer('page_count'),
    contentVolume: text('content_volume'),
    features: text('features'),
    integrations: text('integrations'),

    // ENHANCED AUDITS (Lines 440-447)
    navigationStructure: text('navigation_structure'),
    accessibilityAudit: text('accessibility_audit'),
    seoAudit: text('seo_audit'),
    legalCompliance: text('legal_compliance'),
    performanceIndicators: text('performance_indicators'),
    screenshots: text('screenshots'),
    companyIntelligence: text('company_intelligence'),

    // QUICKSCAN 2.0 FIELDS (Lines 449-455)
    siteTree: text('site_tree'),
    contentTypes: text('content_types'),
    migrationComplexity: text('migration_complexity'),
    decisionMakers: text('decision_makers'),
    tenQuestions: text('ten_questions'),
    rawScanData: text('raw_scan_data'),

    // BUSINESS UNIT RECOMMENDATION
    recommendedBusinessUnit: text('recommended_business_unit'),
    confidence: integer('confidence'),
    reasoning: text('reasoning'),

    // ACTIVITY & VISUALIZATION
    activityLog: text('activity_log'), // JSON - Agent Activity Steps
    visualizationTree: text('visualization_tree'), // JSON - cached json-render tree

    // CMS EVALUATION (from adessoCMS Baseline)
    cmsEvaluation: text('cms_evaluation'),
    cmsEvaluationCompletedAt: integer('cms_evaluation_completed_at', { mode: 'timestamp' }),

    // TIMESTAMPS
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }),
  },
  table => ({
    rfpIdx: index('quick_scans_rfp_idx').on(table.rfpId),
  })
);
```

---

## 5. BESTEHENDE TOOLS IN lib/quick-scan/tools/

### 5.1 Tool-Übersicht

| Tool                        | Datei                        | Status | Zweck                                            | Für COLLECT?  |
| --------------------------- | ---------------------------- | ------ | ------------------------------------------------ | ------------- |
| **Multi-Page Analyzer**     | `multi-page-analyzer.ts`     | ✅     | Parallel Tech Stack Detection (10 diverse pages) | ✅ COLLECT    |
| **Migration Analyzer**      | `migration-analyzer.ts`      | ✅     | Complexity scoring + CMS export capabilities     | ✅ SYNTHESIZE |
| **Component Extractor**     | `component-extractor.ts`     | ✅     | UI component pattern detection                   | ✅ COLLECT    |
| **Decision Maker Research** | `decision-maker-research.ts` | ✅     | Web search for key contacts                      | ✅ COLLECT    |
| **Playwright**              | `playwright.ts`              | ✅     | Browser automation, screenshot capture           | ✅ COLLECT    |
| **Navigation Crawler**      | `navigation-crawler.ts`      | ✅     | Site structure mapping                           | ✅ COLLECT    |
| **Content Classifier**      | `content-classifier.ts`      | ✅     | Page type classification (AI)                    | ✅ COLLECT    |
| **Page Sampler**            | `page-sampler.ts`            | ✅     | Smart page sampling strategy                     | ✅ COLLECT    |
| **Page Counter**            | `page-counter.ts`            | ✅     | Accurate page counting from sitemap              | ✅ COLLECT    |
| **Company Research**        | `company-research.ts`        | ✅     | Web search for company intelligence              | ✅ COLLECT    |

### 5.2 Detailed Tool Analysis

#### Multi-Page Analyzer (multi-page-analyzer.ts, Lines 1-80)

**Zweck:** Parallel Technology Detection über multiple Pages

**Key Interfaces:**

```typescript
export interface PageData {
  url: string;
  html: string;
  headers: Record<string, string>;
  fetchedAt: string;
  error?: string;
}

export interface AggregatedTechResult {
  cms?: { name, version, confidence, detectedOn, totalPages, indicators };
  framework?: { name, version, confidence, detectedOn };
  backend: Array<...>;
  hosting?: string;
  cdn?: string;
  server?: string;
  libraries: Array<...>;
  analytics: Array<...>;
  marketing: Array<...>;
  overallConfidence: number;
  pagesAnalyzed: number;
  detectionMethod: 'multi-page' | 'single-page' | 'httpx-fallback';
}
```

**CMS Detection Patterns** (Lines 85-150):

- Drupal: Lines 87-100 (Regex patterns + version detection)
- WordPress: Lines 102-112
- TYPO3: Lines 114-124
- Joomla: Lines 126-134
- Contao: Lines 136-142
- Magento: Lines 144-150+

**Strategy:** Wappalyzer (einfach, schnell) + HTML Patterns (zuverlässig)

#### Migration Analyzer (migration-analyzer.ts, Lines 1-150)

**CMS Export Capabilities Database** (Lines 41-62):

```typescript
const CMS_EXPORT_CAPABILITIES = {
  wordpress: { hasRestApi: true, hasXmlExport: true, hasCli: true, exportScore: 90 },
  drupal: { hasRestApi: true, hasXmlExport: true, hasCli: true, exportScore: 95 },
  typo3: { hasRestApi: true, hasXmlExport: true, hasCli: true, exportScore: 85 },
  // ... etc
  custom: { hasRestApi: false, hasXmlExport: false, hasCli: false, exportScore: 30 },
};
```

**Complexity Estimation** (Lines 100-148):

- Base Score: 30
- Page Count Impact: +10-30
- Content Type Complexity: +10-20
- Feature Impact: +5-15
- Result: 0-100 Score + Recommendation (easy/moderate/complex/very_complex)

#### Component Extractor (component-extractor.ts, Lines 1-50)

**Navigation Detection** (Lines 54-92):

- mega_menu, sticky_header, mobile_menu, sidebar, breadcrumbs, pagination, standard

**Content Block Detection** (Lines 97-150+):

- hero, cards, teaser, accordion, tabs, slider, testimonials, timeline, grid, list, cta, pricing, faq, team, stats, features

**Drupal Mapping Potential:**

- Hero Block → Paragraph Type "hero"
- Cards Grid → Paragraph Type "cards_grid"
- Testimonials → Paragraph Type "testimonials"
- Contact Form → Content Type "contact_form"
- Product Grid → Views with Entity Reference Pagination

---

## 6. BUSINESS UNITS SINGLETON CACHE

### 6.1 Aktuelle Implementierung (KERNFEATURE!)

**Datei:** `/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts`

**Lines 58-93: Singleton Pattern**

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS UNITS SINGLETON CACHE
// Prevents multiple DB loads per session - loaded once, reused everywhere
// ═══════════════════════════════════════════════════════════════════════════════

type CachedBusinessUnit = { name: string; keywords: string[] };
let cachedBusinessUnits: CachedBusinessUnit[] | null = null;

/**
 * Get business units from cache or load from DB once
 * This is the ONLY way to get business units in the QuickScan flow
 */
async function getBusinessUnitsOnce(): Promise<CachedBusinessUnit[]> {
  if (!cachedBusinessUnits) {
    try {
      const units = await db.select().from(businessUnitsTable);
      cachedBusinessUnits = units.map(unit => ({
        name: unit.name,
        keywords:
          typeof unit.keywords === 'string' ? JSON.parse(unit.keywords) : unit.keywords || [],
      }));
      console.log(`[QuickScan] Business Units loaded from DB: ${cachedBusinessUnits.length}`);
    } catch (error) {
      console.error('[QuickScan] Error loading business units from DB:', error);
      cachedBusinessUnits = [];
    }
  }
  return cachedBusinessUnits;
}

/**
 * Clear the business units cache (for testing or refresh)
 */
function clearBusinessUnitsCache(): void {
  cachedBusinessUnits = null;
}
```

### 6.2 Usage Pattern

Das Pattern wird in der BL-Recommendation-Phase verwendet:

1. First call zu `getBusinessUnitsOnce()` → DB Load + Cache
2. Subsequent calls → Cache Hit (kein DB Load)
3. `clearBusinessUnitsCache()` in Tests/bei Reload

### 6.3 Performance Impact

- **Before:** 1-2 DB queries pro QuickScan Session
- **After:** 1 DB query pro Session (beim ersten Zugriff)
- **Impact:** Minimal bei 8 Business Units, aber Pattern ist skalierbar

---

## 7. REFACTORING-BLUEPRINT: 2-PHASEN WORKFLOW

### 7.1 Proposed Phase Architecture

```typescript
// NEW: Phase Event Emission Pattern

// PHASE 1: COLLECT (Parallel Data Gathering)
const phase1Events: PhaseStartData[] = [{ phase: 'bootstrap', message: 'Initializing scan...' }];

const collectTasks = Promise.all([
  runTechStackDetection(url), // Multi-page analysis
  analyzeNavigationStructure(url), // Site crawler
  extractComponentPatterns(pages), // UI component detection
  researchDecisionMakers(company), // Web search for contacts
  analyzeContentTypes(pages), // Content classifier
  detectMigrationComplexity(techStack), // Complexity estimation
]);

emit({
  type: AgentEventType.PHASE_START,
  data: {
    phase: 'multi_page',
    message: 'Collecting data from website...',
    timestamp: Date.now(),
  },
});

const collectedData = await collectTasks;

emit({
  type: AgentEventType.ANALYSIS_COMPLETE,
  data: {
    analysis: 'collection',
    success: true,
    duration: elapsed,
    details: '6/6 collection tasks completed',
  },
});

// PHASE 2: SYNTHESIZE (Sequential AI Processing)
emit({
  type: AgentEventType.PHASE_START,
  data: {
    phase: 'synthesis',
    message: 'Synthesizing analysis results...',
    timestamp: Date.now(),
  },
});

const synthesisResult = await Promise.all([
  generateBusinessUnitRecommendation(collectedData), // Use cached BUs
  generateDrupalMappingHints(collectedData), // For Website Audit Skill
  generateDecisionMakerSummary(collectedData),
  generateMigrationInsights(collectedData),
]);

emit({
  type: AgentEventType.ANALYSIS_COMPLETE,
  data: {
    analysis: 'synthesis',
    success: true,
    duration: elapsed,
    details: 'All synthesis tasks completed',
  },
});

emit({
  type: AgentEventType.COMPLETE,
});
```

### 7.2 Drupal-Mapping-Hints Generation

**Input:** `ExtractedComponentsData` + `ContentTypeDistribution`

**Output:** `DrupalMappingData`

```typescript
// Example Mapping Logic
function generateDrupalMappingHints(
  components: ExtractedComponentsData,
  contentTypes: ContentTypeDistribution
): DrupalMappingData {
  // Map content blocks to paragraph types
  const paragraphTypes = new Set<string>();
  components.contentBlocks.forEach(block => {
    if (block.type === 'hero') paragraphTypes.add('hero');
    if (block.type === 'cards') paragraphTypes.add('cards_grid');
    if (block.type === 'testimonials') paragraphTypes.add('testimonials_section');
    if (block.type === 'cta') paragraphTypes.add('call_to_action');
    // ... etc
  });

  // Map detected content types to Drupal content types
  const drupalContentTypes = new Set<string>();
  contentTypes.distribution.forEach(ct => {
    if (ct.type === 'blog') drupalContentTypes.add('article');
    if (ct.type === 'product') drupalContentTypes.add('product');
    if (ct.type === 'service') drupalContentTypes.add('service_page');
    if (ct.type === 'person') drupalContentTypes.add('team_member');
    // ... etc
  });

  // Estimate taxonomies
  const suggestedTaxonomies = ['category', 'tag'];
  if (contentTypes.distribution.some(ct => ct.type === 'event')) {
    suggestedTaxonomies.push('event_type');
  }
  if (contentTypes.distribution.some(ct => ct.type === 'product')) {
    suggestedTaxonomies.push('product_category');
  }

  return {
    suggestedParagraphTypes: Array.from(paragraphTypes),
    suggestedContentTypes: Array.from(drupalContentTypes),
    suggestedTaxonomies,
    suggestedMediaTypes: ['image', 'video', 'document'],
    estimatedViews: estimateViewCount(contentTypes),
  };
}
```

---

## 8. INTEGRATION POINTS FÜR WEBSITE AUDIT SKILL

### 8.1 Expected Integration Pattern

```
Website Audit Skill (MCP)
        ↓
┌───────────────────────────────────────────┐
│ Input:                                    │
│ - Website URL                             │
│ - BID Opportunity Details                 │
│ - Business Context                        │
└──────────────┬──────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ runQuickScanWithStreaming()                │
│ lib/quick-scan/agent.ts                   │
│                                           │
│ PHASE 1: COLLECT (Parallel)              │
│ - techStackDetection()                    │
│ - navigationCrawler()                     │
│ - componentExtractor()                    │
│ - decisionMakerResearch()                 │
│ - contentAnalysis()                       │
│                                           │
│ PHASE 2: SYNTHESIZE (Sequential)         │
│ - businessUnitRecommendation()            │
│ - drupalMappingHints() <-- NEW!          │
│ - migrationComplexity()                   │
│ - decisionMakerSummary()                  │
└──────────────┬──────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ Output:                                   │
│ - QuickScanResult (all fields)            │
│ - ActivityLog (streaming events)          │
│ - DrupalMappingData (Paragraph Types,    │
│   Content Types, Taxonomies, Entities)   │
│ - CMSComparison Matrix hints              │
│ - AI Opportunities (for deeper analysis) │
└───────────────────────────────────────────┘
```

### 8.2 Schema Mapping für Website Audit

| QuickScan Output                    | Website Audit Use        | Drupal Mapping                    |
| ----------------------------------- | ------------------------ | --------------------------------- |
| `techStack.cms`                     | CMS Selection            | Drupal vs Alternatives            |
| `contentTypes`                      | Content Structure        | Paragraph Types, Content Types    |
| `extractedComponents.contentBlocks` | Block Types              | Paragraph Type Recommendations    |
| `siteTree`                          | Information Architecture | Views + Entity Reference Fields   |
| `migrationComplexity`               | Effort Estimation        | PT Estimation                     |
| `navigationStructure`               | Menu Structure           | Navigation Block Configuration    |
| `decisionMakers`                    | Stakeholder Analysis     | Key Contacts for Drupal Migration |

---

## 9. KOMPONENTEN-HIERARCHIE

### 9.1 AI Elements Stack

```
Parent Component (quickScanResults or similar)
  ├─ AgentActivityView (ai-elements/agent-activity-view.tsx)
  │  ├─ Collapsible per Agent
  │  │  ├─ AgentMessage (ai-elements/agent-message.tsx) x N
  │  │  │  ├─ Badge (Agent Name + Color)
  │  │  │  ├─ ConfidenceIndicator
  │  │  │  ├─ Tool Calls Display
  │  │  │  ├─ Reasoning (Collapsible)
  │  │  │  └─ Sources
  │  │  └─ Duration Display
  │  └─ Overall Progress Bar
  │
  └─ Activity Stream (ai-elements/activity-stream.tsx)
     └─ Timeline View (Alternative)
```

### 9.2 Neue Phase-Events UI (Proposal)

```
PhaseProgressCard (NEW)
  ├─ Phase Badge ("COLLECT" / "SYNTHESIZE")
  ├─ Phase Status (Running / Complete)
  ├─ Task Checklist
  │  ├─ Task 1 (checkmark or spinner)
  │  ├─ Task 2 (checkmark or spinner)
  │  └─ Task N
  ├─ Phase Duration
  └─ Phase Details (Collapsible)
     └─ Sub-event Timeline
```

---

## 10. KEY DATEIPFADE REFERENZ

### 10.1 Core Agent Files

```
Streaming & Events:
  lib/streaming/event-types.ts             (Lines 1-126)
    ├─ AgentEventType enum
    ├─ PhaseStartData, AnalysisCompleteData
    └─ AgentEventData union type

  lib/streaming/event-emitter.ts           (Lines 1-71)
    ├─ createAgentEventStream()
    └─ createSSEResponse()

  app/api/rfps/[id]/quick-scan/stream/route.ts  (Lines 1-200)
    ├─ Authentication & Authorization
    ├─ Replay completed scans
    └─ Stream live activity

Server Actions:
  lib/quick-scan/actions.ts                (Lines 1-260)
    ├─ startQuickScan()
    ├─ retriggerQuickScan()
    └─ getQuickScanResult() [ALL JSON fields]

Agent Orchestration:
  lib/quick-scan/agent.ts                  (Lines 1-3000+)
    ├─ getBusinessUnitsOnce() [SINGLETON]
    ├─ runTechStackDetection()
    └─ runQuickScanWithStreaming()

Schemas:
  lib/quick-scan/schema.ts                 (Lines 1-717)
    ├─ techStackSchema, contentVolumeSchema
    ├─ siteTreeSchema, contentTypeDistributionSchema
    ├─ migrationComplexitySchema
    ├─ decisionMakersResearchSchema
    ├─ extractedComponentsSchema (with drupalMapping)
    └─ extendedQuickScan2Schema (full output)

  lib/quick-scan/types.ts                  (Lines 1-459)
    ├─ TechStackData, ContentVolumeData, FeaturesData
    ├─ DrupalMappingData [DRUPAL HINTS]
    ├─ ExtractedComponentsData [with drupalMapping field]
    └─ QuickScanResultsData [combined type]
```

### 10.2 UI Components

```
AI Elements:
  components/ai-elements/agent-activity-view.tsx  (Lines 1-281)
    ├─ AgentActivityView component
    ├─ Agent grouping logic
    ├─ Progress calculation
    └─ Agent color mapping

  components/ai-elements/agent-message.tsx        (Lines 1-201)
    ├─ AgentMessage component
    ├─ Copy to clipboard
    ├─ Confidence display
    ├─ Tool calls rendering
    ├─ Reasoning collapsible
    └─ Sources display

  components/ai-elements/index.ts                 (exports)
```

### 10.3 Tools

```
Multi-Page Analysis:
  lib/quick-scan/tools/multi-page-analyzer.ts     (Lines 1-400+)
    ├─ PageData, AggregatedTechResult interfaces
    ├─ CMS detection patterns (Drupal, WordPress, TYPO3, Joomla, Contao)
    └─ Technology aggregation

Component Extraction:
  lib/quick-scan/tools/component-extractor.ts     (Lines 1-400+)
    ├─ Navigation detection patterns
    ├─ Content block patterns
    ├─ Form detection
    ├─ Media element patterns
    └─ Component summary calculation

Migration Analysis:
  lib/quick-scan/tools/migration-analyzer.ts      (Lines 1-250+)
    ├─ CMS export capabilities database
    ├─ Content complexity estimation
    ├─ Integration complexity assessment
    └─ Effort estimation

Decision Maker Research:
  lib/quick-scan/tools/decision-maker-research.ts (Lines 1-150+)
    ├─ Web search strategies
    ├─ Email derivation patterns
    └─ Research quality metrics
```

### 10.4 Database

```
  lib/db/schema.ts
    ├─ quickScans table (Lines 412-479)
    │  ├─ Core fields (id, rfpId, websiteUrl, status)
    │  ├─ Results (techStack, cms, framework, hosting, etc.)
    │  ├─ Enhanced audits (Lines 440-447)
    │  ├─ QuickScan 2.0 fields (Lines 449-455)
    │  ├─ Business unit recommendation
    │  ├─ Activity & visualization
    │  └─ CMS evaluation cache
    │
    └─ Index: quick_scans_rfp_idx on rfpId
```

---

## 11. REFACTORING CHECKLIST FÜR 2-PHASEN WORKFLOW

### PHASE 1: Infrastructure

- [ ] **Event Type System**
  - [ ] Verify PHASE_START event is emitted for both "multi_page" and "synthesis" phases
  - [ ] Verify ANALYSIS_COMPLETE event includes phase name
  - [ ] Add optional "phaseDuration" to AnalysisCompleteData
  - [ ] Line reference: event-types.ts lines 11-31

- [ ] **Business Units Cache**
  - [ ] Verify getBusinessUnitsOnce() called once per session
  - [ ] Add logging for cache hits vs. misses
  - [ ] Test cache invalidation scenarios
  - [ ] Line reference: agent.ts lines 66-92

- [ ] **Streaming Headers**
  - [ ] Confirm SSE headers include X-Accel-Buffering: no
  - [ ] Test with nginx/reverse proxies
  - [ ] Line reference: event-emitter.ts lines 61-70

### PHASE 2: Data Collection (COLLECT)

- [ ] **Multi-Page Analyzer**
  - [ ] Parallelize 10-page sample analysis
  - [ ] Aggregate CMS detection confidence
  - [ ] Emit AGENT_PROGRESS events per page analyzed
  - [ ] Line reference: multi-page-analyzer.ts

- [ ] **Component Extraction**
  - [ ] Extract navigation patterns
  - [ ] Identify content block types (hero, cards, accordion, etc.)
  - [ ] Map to paragraph types
  - [ ] Generate drupalMapping hints
  - [ ] Line reference: component-extractor.ts

- [ ] **Decision Maker Research**
  - [ ] Use web search instead of manual iteration
  - [ ] Derive emails with confidence levels
  - [ ] Line reference: decision-maker-research.ts lines 1-100

### PHASE 3: Data Synthesis (SYNTHESIZE)

- [ ] **Business Unit Recommendation**
  - [ ] Use cached Business Units
  - [ ] Calculate confidence score
  - [ ] Emit AGENT_COMPLETE with result
  - [ ] Line reference: agent.ts (BL recommendation section)

- [ ] **Drupal Mapping Generation**
  - [ ] Generate paragraph types list
  - [ ] Suggest content types
  - [ ] Recommend taxonomies
  - [ ] Estimate Views count
  - [ ] Output: DrupalMappingData structure
  - [ ] Line reference: types.ts lines 392-399

- [ ] **Migration Complexity**
  - [ ] Calculate CMS export score
  - [ ] Estimate effort in PT
  - [ ] Provide warnings & opportunities
  - [ ] Line reference: migration-analyzer.ts

### PHASE 4: Database & Response

- [ ] **Persist All Results**
  - [ ] Save all 15+ JSON fields to DB
  - [ ] Line reference: app/api/rfps/[id]/quick-scan/stream/route.ts lines 132-162

- [ ] **Activity Log**
  - [ ] Structure with phase information
  - [ ] Include phase start/end events
  - [ ] Replay capability for UI
  - [ ] Line reference: actions.ts lines 238

### PHASE 5: UI Components

- [ ] **Phase Progress Indicator (NEW)**
  - [ ] Show COLLECT phase progress
  - [ ] Show SYNTHESIZE phase progress
  - [ ] Emit PHASE_START/ANALYSIS_COMPLETE events
  - [ ] Base: agent-activity-view.tsx

- [ ] **Task Timeline (NEW)**
  - [ ] Display per-phase task list
  - [ ] Show completion status
  - [ ] Base: agent-message.tsx + new PhaseProgressCard

- [ ] **Drupal Hints Display (NEW)**
  - [ ] Show suggested paragraph types
  - [ ] Show suggested content types
  - [ ] Show estimated Views count
  - [ ] Create new component for rendering

---

## 12. TESTING STRATEGY

### 12.1 Unit Tests

```typescript
// Test Business Units Cache
describe('getBusinessUnitsOnce', () => {
  it('should load from DB on first call', async () => {
    const units = await getBusinessUnitsOnce();
    expect(units.length).toBeGreaterThan(0);
  });

  it('should return cached value on second call', async () => {
    const call1 = await getBusinessUnitsOnce();
    const call2 = await getBusinessUnitsOnce();
    expect(call1).toBe(call2); // Same reference
  });
});

// Test Phase Events
describe('Phase Events', () => {
  it('should emit PHASE_START for COLLECT', done => {
    stream.on('data', event => {
      if (event.type === 'phase-start' && event.data.phase === 'multi_page') {
        expect(event.data.message).toContain('Collecting');
        done();
      }
    });
  });
});
```

### 12.2 Integration Tests

```typescript
// Test Full 2-Phase Workflow
describe('QuickScan 2-Phase Workflow', () => {
  it('should complete COLLECT phase before SYNTHESIZE', async () => {
    const events = [];
    stream.on('data', evt => events.push(evt));

    await runQuickScanWithStreaming({ url }, emit);

    const collectIdx = events.findIndex(e => e.data?.phase === 'multi_page');
    const synthesisIdx = events.findIndex(e => e.data?.phase === 'synthesis');

    expect(collectIdx).toBeLessThan(synthesisIdx);
  });
});
```

---

## 13. PERFORMANCE CONSIDERATIONS

### 13.1 Current State

| Metric                        | Value               | Status        |
| ----------------------------- | ------------------- | ------------- |
| Business Units DB Query       | Once per session    | ✅ Optimized  |
| Page Analysis Parallelization | Yes (10 pages)      | ✅ Good       |
| Event Streaming Latency       | Real-time SSE       | ✅ Good       |
| Database Persistence          | Single batch update | ✅ Efficient  |
| Cache Overhead                | Minimal (8 BUs)     | ✅ Negligible |

### 13.2 Potential Bottlenecks

- **Web Search Delays** in Decision Maker Research (mitigated by parallel execution)
- **HTML Parsing** on 10 pages (mitigated by multi-page parallelization)
- **AI Synthesis Calls** (mitigated by generateObject batching)

---

## 14. ZUSAMMENFASSUNG & NÄCHSTE SCHRITTE

### 14.1 Zusammenfassung

Das QuickScan-System ist eine **robuste, produktionsreife Architektur** mit:

✅ **Stärken:**

- Vollständiger SSE-Streaming mit Web Streams API
- Business Units Singleton Cache (KERN-PATTERN!)
- Phase Events bereits vorhanden (PHASE_START, ANALYSIS_COMPLETE)
- Umfassende Schema-Definitionen für alle Analysen
- 10 spezialisierte Sub-Tools (parallel execution)
- AI Elements UI Components für Live Agent Activity

⚠️ **Refactoring-Chancen:**

- Explizite 2-Phasen-Struktur (COLLECT + SYNTHESIZE)
- Drupal-Mapping-Hints Integration
- Phase Progress UI
- Website Audit Skill Integration

### 14.2 Nächste Schritte

**Priorität 1 (MUSS):**

1. Implement 2-Phase Event Emitting Pattern (agent.ts)
2. Generate DrupalMappingData in SYNTHESIZE phase
3. Persist drupalMapping to DB (schema already ready)
4. Create Phase Progress UI component

**Priorität 2 (SOLLTE):**

1. Test Parallelization in COLLECT phase
2. Optimize Business Unit Matching performance
3. Add Web Audit Skill integration tests

**Priorität 3 (KANN):**

1. Create Drupal-specific UI for mapping hints
2. Add Drupal baseline comparison logic
3. Generate "Ten Questions for BL" from Drupal hints

---

## APPENDIX: CODE REFERENCES

### A.1 Critical Files (Read-Only)

All absolute paths are validated as of 2026-01-20:

```
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/agent.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/actions.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/schema.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/types.ts
/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-types.ts
/Users/marc.philipps/Sites/dealhunter/lib/streaming/event-emitter.ts
/Users/marc.philipps/Sites/dealhunter/app/api/rfps/[id]/quick-scan/stream/route.ts
/Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-activity-view.tsx
/Users/marc.philipps/Sites/dealhunter/components/ai-elements/agent-message.tsx
/Users/marc.philipps/Sites/dealhunter/lib/db/schema.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/multi-page-analyzer.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/migration-analyzer.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/component-extractor.ts
/Users/marc.philipps/Sites/dealhunter/lib/quick-scan/tools/decision-maker-research.ts
```

### A.2 Database Indexes

```sql
CREATE INDEX quick_scans_rfp_idx ON quick_scans(rfp_id);
```

### A.3 Environment Setup

From CLAUDE.md:

```bash
npm run d3k              # Dev Server (not npm run dev!)
npm run db:push         # Apply schema
npm run db:studio       # Inspect DB
```

---

**Generated:** 2026-01-20
**Analyst:** Repository Research System
**Status:** COMPLETE - Ready for Implementation
