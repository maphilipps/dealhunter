# QuickScan 2-Phasen-Workflow Refactoring für Website Audit Skill

## Overview

Umfassendes Refactoring des QuickScan-Workflows auf eine klare 2-Phasen-Architektur (COLLECT → SYNTHESIZE), um als Basis für den Website Audit Skill zu dienen. Alle Features bleiben erhalten, Streaming wird verbessert, und Drupal-Mapping-Hints werden generiert.

## Problem Statement / Motivation

### Identifizierte Probleme (13 kritische Issues)

| #   | Problem                                                       | Schwere | Fix                                        |
| --- | ------------------------------------------------------------- | ------- | ------------------------------------------ |
| 1   | Tech Stack Detection 3x ausgeführt                            | HOCH    | Einmal ausführen, Ergebnis wiederverwenden |
| 2   | Data Flow Widerspruch (Ergebnisse nach Nutzung überschrieben) | HOCH    | Reihenfolge korrigieren                    |
| 3   | 4 CMS-Quellen ohne Priorität                                  | MITTEL  | Klare Hierarchie definieren                |
| 4   | BL Recommendation VOR Phase 4 (incomplete data)               | HOCH    | Nach allen Analysen verschieben            |
| 5   | Playwright Audit hat keinen Tech-Kontext                      | MITTEL  | Tech-Ergebnisse übergeben                  |
| 6   | Null-Returns in kritischen Pfaden                             | MITTEL  | Defensive Coding                           |
| 7   | contentTypes übersprungen bei < 10 URLs                       | NIEDRIG | Threshold entfernen                        |
| 8   | Feature Detection Fallback ohne Tracking                      | NIEDRIG | Confidence-Tracking                        |
| 9   | Wappalyzer 2x geparsed                                        | MITTEL  | Einmal cachen                              |
| 10  | Tech Stack 3x gemerged                                        | HOCH    | Single Merge Point                         |
| 11  | Business Units 2x geladen                                     | NIEDRIG | Einmal laden, cachen                       |
| 12  | Content Analysis VOR Page Sampling                            | HOCH    | Reihenfolge fixieren                       |
| 13  | Non-Streaming/Streaming keine Parität                         | MITTEL  | Unified Flow                               |

### Warum dieses Refactoring kritisch ist

1. **Website Audit Skill braucht vollständige Datenlage** - keine Teilanalysen
2. **Streaming UI zeigt inkonsistente Phasen** - verwirrt Benutzer
3. **Redundante API-Aufrufe** - verschwendet Ressourcen und Zeit
4. **BL Recommendation mit unvollständigen Daten** - produziert schlechte Empfehlungen

---

## Proposed Solution

### Neuer 2-Phasen-Workflow

```
┌──────────────────────────────────────────────────────────────┐
│  PHASE 1: COLLECT (Maximal Parallel)                        │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Schritt 1.1: Bootstrap (Parallel)                          │
│  ├─ fetchSitemapWithFallback(url)  → URL Pool               │
│  ├─ fetchWebsiteData(url)          → Homepage Data          │
│  └─ getBusinessUnitsOnce()         → BU Cache               │
│                                                              │
│  Schritt 1.2: Multi-Page Fetch (Parallel, 10 Seiten)        │
│  └─ fetchPagesParallel(selectedUrls) → PageData[]           │
│                                                              │
│  Schritt 1.3: Alle Analysen (Maximal Parallel)              │
│  ├─ aggregateTechStack(pages)      → Tech Stack (FINAL)     │
│  ├─ extractComponents(pages)       → Komponenten            │
│  ├─ classifyContentTypes(pages)    → Content Types          │
│  ├─ analyzeNavigation(pages)       → Site Structure         │
│  ├─ runAccessibilityAudit(url)     → A11y Score             │
│  ├─ runSeoAudit(url)               → SEO Score              │
│  ├─ runLegalCheck(url)             → Legal Compliance       │
│  ├─ runPerformanceCheck(pages)     → Performance            │
│  ├─ captureScreenshots(urls)       → Screenshots            │
│  ├─ researchCompany(url)           → Company Intel          │
│  └─ researchDecisionMakers(url)    → Decision Makers        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼ Alle Rohdaten verfügbar
┌──────────────────────────────────────────────────────────────┐
│  PHASE 2: SYNTHESIZE (Sequential, braucht alles)            │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Schritt 2.1: Derived Calculations                          │
│  ├─ detectFeatures(techStack, pages)  → Features            │
│  ├─ generateDrupalMappingHints(...)   → Drupal Mapping      │
│  └─ calculateMigrationComplexity(...) → Migration Score     │
│                                                              │
│  Schritt 2.2: BL Recommendation (LETZTE Aktion)             │
│  └─ recommendBusinessLine(allData, cachedBUs)               │
│                                                              │
│  Schritt 2.3: Assemble Final Result                         │
│  └─ QuickScanResult JSON → DB speichern                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Vorteile

1. **Keine Redundanz**: Jede Analyse läuft genau 1x
2. **Maximale Parallelität**: Phase 1.3 führt ~11 Analysen parallel aus
3. **Klare Datenflüsse**: Rohdaten → Synthese → Result
4. **BL Recommendation hat ALLE Daten**: Wird garantiert zuletzt ausgeführt
5. **Audit Skill bekommt komplettes Result**: Keine Teilzustände

---

## Technical Approach

### Architecture

#### Phase Events für UI-Streaming

```typescript
// lib/streaming/event-types.ts
export type QuickScanPhase =
  | 'bootstrap' // URL discovery + BU cache load
  | 'multi_page' // Diverse pages fetching
  | 'analysis' // Parallel tool execution
  | 'synthesis' // Sequential derivation + BL recommendation
  | 'complete'; // Final result ready

export interface PhaseStartEvent {
  type: AgentEventType.PHASE_START;
  data: {
    phase: QuickScanPhase;
    message: string;
    timestamp: number;
  };
}

export interface AnalysisCompleteEvent {
  type: AgentEventType.ANALYSIS_COMPLETE;
  data: {
    analysis: string; // z.B. 'techStack', 'accessibility'
    success: boolean;
    duration: number;
    details?: string;
  };
}
```

#### Business Units Singleton Cache

```typescript
// lib/quick-scan/agent.ts
type CachedBusinessUnit = { name: string; keywords: string[] };
let cachedBusinessUnits: CachedBusinessUnit[] | null = null;

async function getBusinessUnitsOnce(): Promise<CachedBusinessUnit[]> {
  if (!cachedBusinessUnits) {
    const units = await db.select().from(businessUnitsTable);
    cachedBusinessUnits = units.map(unit => ({
      name: unit.name,
      keywords: typeof unit.keywords === 'string' ? JSON.parse(unit.keywords) : unit.keywords || [],
    }));
    console.log(`[QuickScan] Business Units loaded: ${cachedBusinessUnits.length}`);
  }
  return cachedBusinessUnits;
}

function clearBusinessUnitsCache(): void {
  cachedBusinessUnits = null;
}
```

#### Drupal Mapping Hints

```typescript
// lib/quick-scan/types.ts
export interface DrupalMappingData {
  suggestedParagraphTypes: string[]; // ["hero", "cards_grid", "accordion"]
  suggestedContentTypes: string[]; // ["article", "event", "product"]
  suggestedTaxonomies: string[]; // ["category", "tag", "location"]
  suggestedMediaTypes: string[]; // ["image", "video", "document"]
  estimatedViews: number; // Geschätzte Views basierend auf Listen
}

export interface ExtractedComponentsData {
  // Bestehende Felder...
  navigation: NavigationComponentData[];
  contentBlocks: ContentBlockComponentData[];
  forms: FormComponentData[];
  mediaElements: MediaComponentData[];
  interactiveElements: string[];

  // NEU: Drupal-Mapping Hints
  drupalMapping: DrupalMappingData;

  summary: {
    totalComponents: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    uniquePatterns: number;
    estimatedComponentTypes: number;
    // NEU
    estimatedDrupalEntities: {
      contentTypes: number;
      paragraphTypes: number;
      taxonomies: number;
      views: number;
    };
  };
}
```

#### Migration Complexity mit PT-Schätzung

```typescript
// lib/quick-scan/tools/migration-analyzer.ts
export interface MigrationComplexityData {
  score: number;
  recommendation: 'easy' | 'moderate' | 'complex' | 'very_complex';

  factors: {
    cmsExportability: {
      score: number;
      hasRestApi: boolean;
      hasXmlExport: boolean;
      hasCli: boolean;
      knownExportMethods: string[]; // NEU
      notes: string;
    };
    dataQuality: {
      score: number;
      brokenLinks: number;
      duplicateContent: boolean;
      inconsistentStructure: boolean;
      cleanupRequired: 'minimal' | 'moderate' | 'significant'; // NEU
      notes: string;
    };
    contentComplexity: {
      score: number;
      embeddedMedia: boolean;
      customFields: number;
      complexLayouts: boolean;
      richTextComplexity: 'simple' | 'moderate' | 'complex'; // NEU
      notes: string;
    };
    integrationComplexity: {
      score: number;
      externalApis: number;
      ssoRequired: boolean;
      thirdPartyPlugins: number;
      integrationList: string[]; // NEU
      notes: string;
    };
  };

  // NEU: Direkte Aufwandsschätzung
  estimatedEffort: {
    minPT: number;
    maxPT: number;
    confidence: number; // 0-100
    assumptions: string[];
  };

  warnings: string[];
  opportunities: string[];
}
```

### Implementation Phases

#### Phase 1: Core Workflow Refactoring (agent.ts)

**Ziel:** 2-Phasen-Struktur mit korrekter Event-Emission

**Tasks:**

- [ ] Bootstrap-Phase mit parallelem BU-Cache-Load implementieren
- [ ] Multi-Page-Phase mit Diversity-Sampling
- [ ] Analysis-Phase mit Promise.allSettled für Fehlertoleranz
- [ ] Synthesis-Phase mit korrekter Reihenfolge (BL Recommendation zuletzt)
- [ ] Phase Events an allen kritischen Punkten emittieren
- [ ] `emitPhase()` und `emitAnalysisComplete()` Helper verwenden

**Kritische Änderungen in `lib/quick-scan/agent.ts`:**

```typescript
export async function runQuickScanWithStreaming(
  input: QuickScanInput,
  emit: AgentEventEmitter
): Promise<QuickScanResultsData> {
  // Phase Event Helpers
  const emitPhase = (phase: QuickScanPhase, message: string) => {
    emit({
      type: AgentEventType.PHASE_START,
      data: { phase, message, timestamp: Date.now() },
    });
    logActivity(`Phase: ${phase}`, message);
  };

  const emitAnalysisComplete = (
    analysis: string,
    success: boolean,
    duration: number,
    details?: string
  ) => {
    emit({
      type: AgentEventType.ANALYSIS_COMPLETE,
      data: { analysis, success, duration, details },
    });
  };

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: COLLECT (Alles parallel sammeln)
  // ═══════════════════════════════════════════════════════════

  // 1.1 Bootstrap (parallel)
  emitPhase('bootstrap', 'Initialisiere Scan - lade Website und Business Units...');
  const bootstrapStart = Date.now();

  const [websiteData, cachedBusinessUnits] = await Promise.all([
    fetchWebsiteData(input.websiteUrl),
    getBusinessUnitsOnce(),
  ]);

  emitAnalysisComplete(
    'bootstrap',
    true,
    Date.now() - bootstrapStart,
    `Website + ${cachedBusinessUnits.length} Business Units geladen`
  );

  // 1.2 Multi-Page Fetch
  emitPhase('multi_page', 'Lade diverse Seiten für Analyse...');
  const multiPageStart = Date.now();

  const urlDiscovery = await fetchSitemapWithFallback(input.websiteUrl);
  const selectedUrls = selectDiversePages(urlDiscovery.urls, 10);
  const pages = await fetchPagesParallel(selectedUrls);

  emitAnalysisComplete(
    'multi_page',
    true,
    Date.now() - multiPageStart,
    `${pages.length} Seiten geladen`
  );

  // 1.3 Alle Analysen parallel
  emitPhase('analysis', 'Führe alle Analysen parallel aus...');
  const analysisStart = Date.now();

  const analysisResults = await Promise.allSettled([
    runWithTiming('techStack', () => aggregateTechStack(pages)),
    runWithTiming('components', () => extractComponents(pages)),
    runWithTiming('contentTypes', () => classifyContentTypes(pages)),
    runWithTiming('navigation', () => analyzeNavigation(pages)),
    runWithTiming('accessibility', () => runAccessibilityAudit(input.websiteUrl)),
    runWithTiming('seo', () => runSeoAudit(input.websiteUrl)),
    runWithTiming('legal', () => runLegalCheck(input.websiteUrl, websiteData)),
    runWithTiming('performance', () => runPerformanceCheck(pages)),
    runWithTiming('screenshots', () =>
      captureScreenshots(input.websiteUrl, selectedUrls.slice(0, 5))
    ),
    runWithTiming('companyIntel', () => researchCompany(input.websiteUrl)),
    runWithTiming('decisionMakers', () => researchDecisionMakers(input.websiteUrl)),
  ]);

  // Emit individual analysis results
  analysisResults.forEach((result, index) => {
    const names = [
      'techStack',
      'components',
      'contentTypes',
      'navigation',
      'accessibility',
      'seo',
      'legal',
      'performance',
      'screenshots',
      'companyIntel',
      'decisionMakers',
    ];
    if (result.status === 'fulfilled') {
      emitAnalysisComplete(names[index], true, result.value.duration);
    } else {
      emitAnalysisComplete(names[index], false, 0, result.reason?.message);
    }
  });

  // Extract successful results with defaults for failures
  const [
    techStack,
    components,
    contentTypes,
    navigation,
    accessibility,
    seo,
    legal,
    performance,
    screenshots,
    companyIntel,
    decisionMakers,
  ] = extractResultsWithDefaults(analysisResults);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: SYNTHESIZE (Sequential, braucht alle Rohdaten)
  // ═══════════════════════════════════════════════════════════

  emitPhase('synthesis', 'Erstelle Gesamtbild und Empfehlung...');
  const synthesisStart = Date.now();

  // 2.1 Derived Calculations
  const features = detectFeatures(techStack, pages, components);

  const drupalMapping = generateDrupalMappingHints({
    contentTypes,
    components,
    navigation,
  });

  const migrationComplexity = calculateMigrationComplexity({
    techStack,
    contentTypes,
    components,
    features,
    navigation,
  });

  // 2.2 BL Recommendation (ZULETZT - hat alle Daten)
  const blRecommendation = await recommendBusinessLine({
    techStack,
    contentVolume: deriveContentVolume(urlDiscovery, pages),
    features,
    cachedBusinessUnits,
  });

  emitAnalysisComplete(
    'synthesis',
    true,
    Date.now() - synthesisStart,
    `BL: ${blRecommendation.recommended}`
  );

  // 2.3 Final Result Assembly
  emitPhase('complete', 'QuickScan abgeschlossen');

  const result: QuickScanResultsData = {
    techStack,
    contentVolume: deriveContentVolume(urlDiscovery, pages),
    features,
    blRecommendation,
    accessibilityAudit: accessibility,
    seoAudit: seo,
    legalCompliance: legal,
    performanceIndicators: performance,
    navigationStructure: navigation,
    screenshots,
    companyIntelligence: companyIntel,
    siteTree: urlDiscovery.siteTree,
    contentTypes,
    migrationComplexity,
    decisionMakers,
    extractedComponents: { ...components, drupalMapping },
    multiPageAnalysis: {
      pagesAnalyzed: pages.length,
      analyzedUrls: selectedUrls,
      detectionMethod: 'multi-page',
      analysisTimestamp: new Date().toISOString(),
    },
  };

  return result;
}
```

#### Phase 2: Type Extensions

**Ziel:** Drupal-Mapping und erweiterte Migration-Daten

**Tasks:**

- [ ] `DrupalMappingData` Interface in types.ts hinzufügen
- [ ] `estimatedDrupalEntities` in ExtractedComponentsData.summary
- [ ] `estimatedEffort` mit minPT/maxPT in MigrationComplexityData
- [ ] `generateDrupalMappingHints()` Funktion implementieren

**Dateien:**

- `lib/quick-scan/types.ts`
- `lib/quick-scan/tools/migration-analyzer.ts`
- `lib/quick-scan/schema.ts` (Zod Schemas aktualisieren)

#### Phase 3: UI/Streaming Integration

**Ziel:** Phase Events korrekt im UI anzeigen

**Tasks:**

- [ ] `AgentActivityView` für Phase Events erweitern
- [ ] Progress-Indikator für COLLECT vs SYNTHESIZE Phase
- [ ] Tool-Status-Badges (success/error) anzeigen
- [ ] Reasoning-Chain für Synthese-Phase sichtbar machen

**Dateien:**

- `components/ai-elements/agent-activity-view.tsx`
- `components/ai-elements/agent-message.tsx`
- `hooks/use-agent-stream.ts`

#### Phase 4: Error Handling & Edge Cases

**Ziel:** Robuste Fehlerbehandlung ohne Datenverlust

**Tasks:**

- [ ] Promise.allSettled statt Promise.all für Fehlertoleranz
- [ ] Minimum Tool Success Threshold (7/11) für SYNTHESIZE
- [ ] Timeout pro Tool (30s) und pro Phase (5min COLLECT, 2min SYNTHESIZE)
- [ ] Retry-Strategie für kritische Tools (3x mit exponential backoff)
- [ ] Graceful Degradation bei teilweisem Scheitern

**Konfiguration:**

```typescript
const QUICKSCAN_CONFIG = {
  TOOL_TIMEOUT_MS: 30_000,
  COLLECT_PHASE_TIMEOUT_MS: 300_000, // 5 min
  SYNTHESIZE_PHASE_TIMEOUT_MS: 120_000, // 2 min
  MIN_SUCCESSFUL_TOOLS: 7,
  MAX_RETRIES: 3,
  RETRY_BACKOFF_MS: [1000, 2000, 4000],
};
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] QuickScan führt 2 klare Phasen aus (COLLECT → SYNTHESIZE)
- [ ] Business Units werden genau 1x geladen (Singleton Cache)
- [ ] Tech Stack Detection läuft genau 1x
- [ ] BL Recommendation hat Zugriff auf ALLE vorherigen Analyseergebnisse
- [ ] Drupal-Mapping-Hints werden generiert
- [ ] Migration Complexity enthält PT-Schätzung (minPT/maxPT)
- [ ] Alle 11+ Analysetools werden ausgeführt (keine Features weggelassen!)

### Non-Functional Requirements

- [ ] Streaming zeigt Phase Events in Echtzeit
- [ ] Tool-Completion wird einzeln gestreamt
- [ ] COLLECT Phase nutzt maximale Parallelität
- [ ] Fehlertoleranz: SYNTHESIZE läuft auch bei 4/11 Tool-Failures
- [ ] Timeout: Gesamter Scan < 7 Minuten

### Quality Gates

- [ ] TypeScript kompiliert ohne Fehler
- [ ] Bestehende Tests passen noch (oder werden angepasst)
- [ ] Manueller Test auf Drupal-Site erfolgreich
- [ ] Manueller Test auf WordPress-Site erfolgreich
- [ ] Facts Tab zeigt alle neuen Felder (drupalMapping, estimatedEffort)

---

## Success Metrics

1. **Redundanz eliminiert**: Tech Stack Detection 3x → 1x
2. **BU Cache Hit Rate**: 100% nach erstem Load
3. **Phase Events sichtbar**: 4 Phasen deutlich im UI erkennbar
4. **Drupal Mapping vorhanden**: suggestedParagraphTypes.length > 0
5. **PT-Schätzung vorhanden**: migrationComplexity.estimatedEffort.minPT > 0

---

## Dependencies & Prerequisites

### Bestehende Infrastruktur (bereits vorhanden)

- `lib/quick-scan/agent.ts` - Hauptworkflow (wird refactored)
- `lib/quick-scan/types.ts` - Type Definitions (wird erweitert)
- `lib/quick-scan/schema.ts` - Zod Schemas (wird erweitert)
- `lib/streaming/event-types.ts` - Event Types (wird erweitert)
- `hooks/use-agent-stream.ts` - Event Batching (bereits optimal)
- `components/ai-elements/` - UI Components (wird angepasst)

### Externe Abhängigkeiten

- Vercel AI SDK v5 (streamText, generateObject)
- Drizzle ORM (SQLite queries)
- Playwright (für Screenshots und Audits)

---

## Risk Analysis & Mitigation

| Risiko                            | Wahrscheinlichkeit | Impact  | Mitigation                              |
| --------------------------------- | ------------------ | ------- | --------------------------------------- |
| agent.ts zu groß für einen Commit | MITTEL             | MITTEL  | In 2-3 PRs aufteilen                    |
| Parallele Analysen schlagen fehl  | HOCH               | MITTEL  | Promise.allSettled + Defaults           |
| Streaming-Events fehlen im UI     | MITTEL             | HOCH    | Event-Typ Definitionen vorher erstellen |
| BL Recommendation crasht          | NIEDRIG            | HOCH    | Defensive Null-Checks                   |
| Timeout bei langsamen Sites       | MITTEL             | MITTEL  | Configurable Timeouts                   |
| Drupal-Mapping-Hints ungenau      | MITTEL             | NIEDRIG | Heuristiken verfeinern                  |

---

## Files to Modify

| Datei                                            | Änderung                                          | Priorität |
| ------------------------------------------------ | ------------------------------------------------- | --------- |
| `lib/quick-scan/agent.ts`                        | **HAUPTARBEIT:** 2-Phasen-Workflow + Phase Events | KRITISCH  |
| `lib/quick-scan/types.ts`                        | `DrupalMappingData` + `estimatedDrupalEntities`   | HOCH      |
| `lib/quick-scan/tools/migration-analyzer.ts`     | `estimatedEffort` (PT Range)                      | HOCH      |
| `lib/quick-scan/schema.ts`                       | Zod Schemas aktualisieren                         | HOCH      |
| `lib/streaming/event-types.ts`                   | PHASE_START, ANALYSIS_COMPLETE Events             | MITTEL    |
| `hooks/use-agent-stream.ts`                      | Phase Event Handling                              | MITTEL    |
| `components/ai-elements/agent-activity-view.tsx` | Phase-Visualisierung                              | MITTEL    |
| `components/bids/quick-scan-results.tsx`         | Neue Felder anzeigen                              | NIEDRIG   |

---

## Implementation Order

### Sprint 1: Core Refactoring

1. **event-types.ts** - Phase Events definieren
2. **agent.ts** - Bootstrap Phase mit BU Singleton
3. **agent.ts** - Multi-Page Phase
4. **agent.ts** - Analysis Phase mit Promise.allSettled
5. **agent.ts** - Synthesis Phase mit BL Recommendation zuletzt
6. **Testen** mit d3k auf localhost

### Sprint 2: Type Extensions

7. **types.ts** - DrupalMappingData Interface
8. **migration-analyzer.ts** - estimatedEffort hinzufügen
9. **schema.ts** - Zod Schemas aktualisieren
10. **agent.ts** - generateDrupalMappingHints() implementieren

### Sprint 3: UI Integration

11. **use-agent-stream.ts** - Phase Event Reducer
12. **agent-activity-view.tsx** - Phase Progress UI
13. **quick-scan-results.tsx** - Neue Felder anzeigen
14. **End-to-End Test** auf verschiedenen Sites

---

## Verification Checklist

### Workflow-Test

- [ ] QuickScan starten auf bekannter Drupal-Site
- [ ] Prüfen: Tech Stack = "Drupal" mit > 80% Confidence
- [ ] Prüfen: Keine doppelten API-Aufrufe in Logs
- [ ] Prüfen: BL Recommendation erst am Ende
- [ ] Prüfen: 4 Phase Events im UI sichtbar

### Daten-Vollständigkeit

- [ ] Facts Tab öffnen
- [ ] Prüfen: Alle Felder für Audit gefüllt:
  - [ ] contentTypes.distribution vorhanden
  - [ ] extractedComponents.drupalMapping vorhanden
  - [ ] migrationComplexity.estimatedEffort vorhanden
  - [ ] techStack.apiEndpoints vorhanden

### Audit Skill Kompatibilität

- [ ] Website Audit Skill starten
- [ ] Prüfen: Kann QuickScan-Daten als Input verwenden
- [ ] Prüfen: Keine "undefined" Werte in Audit-Report

---

## References & Research

### Internal References

- Bestehender Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- QuickScan Agent: `lib/quick-scan/agent.ts`
- Event Types: `lib/streaming/event-types.ts`
- Migration Analyzer: `lib/quick-scan/tools/migration-analyzer.ts`
- Types: `lib/quick-scan/types.ts`

### External References

- [Vercel AI SDK - streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Vercel AI SDK - Workflows and Agents](https://ai-sdk.dev/docs/agents/workflows)
- [Next.js 16 - Streaming SSR](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)

### Research Summaries

- **Repo Analysis:** Business Units Singleton bereits implementiert (agent.ts:66-92), Phase Events definiert (event-types.ts:11-31)
- **Best Practices:** Promise.allSettled für Fehlertoleranz, Event Batching (100ms) für UI Performance
- **SpecFlow Analysis:** 20 kritische Fragen identifiziert, Minimum Tool Threshold (7/11) empfohlen
