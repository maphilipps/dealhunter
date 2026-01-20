# QuickScan Spezifikation

## Übersicht

Der QuickScan analysiert Websites automatisch, um technische Details, Content-Struktur und Migrations-Komplexität für Drupal-Relaunch-Projekte zu erfassen.

---

## Workflow (2-Phasen-Architektur)

```
┌──────────────────────────────────────────────────────────────┐
│  PRE-CHECK: URL Erreichbarkeit (Fast-Fail)                  │
│  ─────────────────────────────────────────────────────────  │
│  checkAndSuggestUrl(url)                                     │
│  - 10s Timeout für schnelles Scheitern                       │
│  - Folgt Redirects, erfasst finale URL                       │
│  - Bei Fehler: Schlägt alternative URL vor                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ URL erreichbar
┌──────────────────────────────────────────────────────────────┐
│  PHASE 1: COLLECT (Maximal Parallel)                        │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  1.1 Bootstrap (Parallel)                                    │
│  ├─ fetchWebsiteData(url)      → HTML, Headers, Wappalyzer  │
│  └─ getBusinessUnitsOnce()     → BU Cache (Singleton)       │
│                                                              │
│  1.2 Multi-Page Fetch (10 diverse Seiten)                   │
│  └─ fetchPagesParallel(urls)   → PageData[]                 │
│                                                              │
│  1.3 Alle Analysen (Parallel)                               │
│  ├─ aggregateTechStack(pages)      → Tech Stack             │
│  ├─ extractComponents(pages)       → UI-Komponenten         │
│  ├─ classifyContentTypes(pages)    → Content-Typen          │
│  ├─ analyzeNavigation(pages)       → Site-Struktur          │
│  ├─ runAccessibilityAudit(url)     → A11y Score             │
│  ├─ runSeoAudit(url)               → SEO Score              │
│  ├─ runLegalCheck(url)             → GDPR/Legal             │
│  ├─ runPerformanceCheck(pages)     → Performance            │
│  ├─ captureScreenshots(urls)       → Screenshots            │
│  ├─ researchCompany(url)           → Company Intel          │
│  └─ researchDecisionMakers(url)    → Entscheider            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ Alle Rohdaten verfügbar
┌──────────────────────────────────────────────────────────────┐
│  PHASE 2: SYNTHESIZE (Sequential)                           │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  2.1 Abgeleitete Berechnungen                               │
│  ├─ detectFeatures(techStack, pages)                        │
│  └─ calculateMigrationComplexity(...)                       │
│                                                              │
│  2.2 BL Recommendation (ZULETZT)                            │
│  └─ recommendBusinessLine(allData, cachedBUs)               │
│                                                              │
│  2.3 Final Result Assembly                                  │
│  └─ QuickScanResult → DB speichern                          │
└──────────────────────────────────────────────────────────────┘
```

---

## URL-Erreichbarkeitsprüfung

### Funktion: `checkAndSuggestUrl(url)`

**Zweck:** Schnelles Scheitern bei nicht erreichbaren URLs, bevor teure Operationen starten.

**Ablauf:**
1. URL-Format und Sicherheit validieren (SSRF-Schutz)
2. HEAD-Request mit 10s Timeout
3. Redirects folgen, finale URL erfassen
4. Bei Fehler: Alternative URLs testen

**Rückgabe:**
```typescript
interface UrlCheckResult {
  reachable: boolean;
  finalUrl: string;
  suggestedUrl?: string;      // Alternative wenn nicht erreichbar
  reason?: string;            // Fehlerbeschreibung
  statusCode?: number;
  redirectChain?: string[];   // Redirect-Pfad
}
```

### Fehlerbehandlung und Vorschläge

| Fehler | Vorschlag |
|--------|-----------|
| DNS nicht gefunden (`ENOTFOUND`) | www.domain.com oder domain.com (Toggle) |
| SSL/Zertifikatsfehler | http:// statt https:// |
| 404 Not Found | Homepage (/) statt Unterseite |
| Timeout | Keine Alternative, klare Fehlermeldung |
| 403 Forbidden | Keine Alternative, Hinweis auf Bot-Schutz |

### Funktion: `tryUrlAlternatives(url)`

Testet systematisch alternative URL-Formate:
1. Homepage statt Unterseite
2. Mit/ohne www-Prefix

---

## Streaming Events

### Event-Typen

```typescript
enum AgentEventType {
  START = 'start',
  AGENT_PROGRESS = 'agent-progress',
  AGENT_COMPLETE = 'agent-complete',
  DECISION = 'decision',
  COMPLETE = 'complete',
  ERROR = 'error',
  ABORT = 'abort',
  // QuickScan Phase Events
  PHASE_START = 'phase-start',
  ANALYSIS_COMPLETE = 'analysis-complete',
  // URL Check Events
  URL_CHECK = 'url-check',
  URL_SUGGESTION = 'url-suggestion',
}
```

### URL Check Events

**`url-check`** - Ergebnis der Erreichbarkeitsprüfung:
```typescript
interface UrlCheckData {
  originalUrl: string;
  finalUrl: string;
  reachable: boolean;
  statusCode?: number;
  redirectChain?: string[];
}
```

**`url-suggestion`** - Vorgeschlagene Alternative bei Fehler:
```typescript
interface UrlSuggestionData {
  originalUrl: string;
  suggestedUrl: string;
  reason: string;
}
```

---

## Datenmodell

### QuickScanResult

```typescript
interface QuickScanResult {
  techStack: TechStack;
  contentVolume: ContentVolume;
  features: Features;
  blRecommendation: BLRecommendation;
  accessibilityAudit: AccessibilityAudit;
  seoAudit: SEOAudit;
  legalCompliance: LegalCompliance;
  performanceIndicators: PerformanceIndicators;
  navigationStructure: NavigationStructure;
  screenshots: Screenshots;
  companyIntelligence: CompanyIntelligence;
  siteTree: SiteTree;
  contentTypes: ContentTypes;
  migrationComplexity: MigrationComplexity;
  decisionMakers: DecisionMakers;
  extractedComponents: ExtractedComponents;
  multiPageAnalysis: MultiPageAnalysis;
  activityLog: ActivityLogEntry[];
}
```

### YAGNI-Prinzip (Was NICHT im QuickScan ist)

Folgende Daten werden **nicht** im QuickScan gespeichert, sondern vom Audit Skill on-demand berechnet:

- `drupalMapping` - Drupal Entity Mapping (CMS-spezifisch)
- `estimatedDrupalEntities` - PT-Schätzungen
- `estimatedEffort` - Aufwandsschätzung in PT

**Grund:** QuickScan bleibt CMS-agnostisch. Mapping und Schätzung erfolgen durch separate, konfigurierbare Funktionen im Audit Skill.

---

## UI-Integration

### ActivityStream Komponente

Die `ActivityStream` Komponente zeigt:
- Live-Agent-Aktivität während des Scans
- Fehler mit URL-Vorschlägen
- Button "Mit dieser URL scannen" bei Vorschlag

**Props:**
```typescript
interface ActivityStreamProps {
  streamUrl: string;
  title?: string;
  onComplete?: (decision?: unknown) => void;
  onError?: (error: string) => void;
  onUrlSuggestion?: (suggestedUrl: string) => void;
  autoStart?: boolean;
  grouped?: boolean;
}
```

### useAgentStream Hook

Der Hook verwaltet:
- Event-Batching (100ms Intervall)
- Circular Buffer (max 150 Events)
- Timestamp-Spreading für visuelle Progression
- URL-Suggestion State

**State:**
```typescript
interface StreamState {
  events: AgentEvent[];
  isStreaming: boolean;
  error: string | null;
  decision: DecisionData | null;
  urlSuggestion: UrlSuggestionData | null;
  agentStates: Record<string, AgentState>;
}
```

---

## Sicherheit

### SSRF-Schutz

Die Funktion `validateUrlForFetch(url)` prüft:
- Nur HTTP/HTTPS Protokolle
- Keine lokalen/privaten IP-Bereiche
- Keine localhost/127.0.0.1
- Keine Metadaten-Endpoints (169.254.x.x)

### Rate Limiting (TODO #047)

Externe API-Aufrufe benötigen Rate Limiting:
- Web Search API: max 2 concurrent, 500ms zwischen Aufrufen
- HTTP Fetches: max 5 concurrent, 100ms zwischen Aufrufen

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `lib/quick-scan/agent.ts` | Hauptlogik, Workflow, Streaming |
| `lib/quick-scan/schema.ts` | Zod Schemas für alle Datentypen |
| `lib/quick-scan/types.ts` | TypeScript Interfaces |
| `lib/quick-scan/tools/*.ts` | Einzelne Analyse-Tools |
| `lib/streaming/event-types.ts` | Event-Definitionen |
| `hooks/use-agent-stream.ts` | React Hook für SSE |
| `components/ai-elements/activity-stream.tsx` | UI-Komponente |

---

## Offene TODOs

| # | Beschreibung | Priorität |
|---|--------------|-----------|
| 043 | SSRF Validation in Playwright | P1 |
| 044 | Memory Management für Parallel Operations | P2 |
| 047 | Rate Limiting für externe APIs | P2 |
| 048 | Agent-Native Trigger API Endpoint | P3 |
