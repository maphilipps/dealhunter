# PreQualification Orchestrator-Worker Pattern

## Übersicht

Das PreQualification-System verwendet ein **Orchestrator-Worker Pattern** für die parallele Verarbeitung von BD-Fragen (Section-Analysen).

### Architektur

```
ORCHESTRATOR (AI-geplant)
    ↓
7 BD-WORKERS (parallel)
    ↓
EVALUATOR (optional)
    ↓
CMS MATRIX
    ↓
DECISION (Bid/No Bid)
```

## 7 BD-Fragen (Sections)

| Section-ID | Frage |
|------------|-------|
| `budget` | Budget und Laufzeit |
| `timing` | Ausschreibungszeitplan, Shortlisting |
| `contracts` | Vertragstyp (EVB-IT, Werk, Dienst, SLA) |
| `deliverables` | Geforderte Leistungen |
| `references` | Referenzanforderungen |
| `award-criteria` | Zuschlagskriterien im Detail |
| `offer-structure` | Angebotsstruktur (was muss Team erarbeiten) |

**Entfernte Sections:** `legal`, `tech-stack`, `facts`, `contacts`

## Performance

- **Vorher (sequentiell):** ~120 Sekunden für 10 Sections
- **Nachher (parallel):** ~25-35 Sekunden für 7 Sections
- **Verbesserung:** ~70-80% schneller

## Konfiguration

```typescript
await runPreQualSectionOrchestrator(preQualificationId, {
  maxConcurrency: 5,        // Max. parallele Workers
  enableEvaluation: true,   // Evaluator aktivieren
  qualityThreshold: 60,     // Min. Qualitätsscore (0-100)
  maxRetries: 1,            // Retries pro Section
  skipPlanning: false,      // AI-Planung überspringen
  onProgress: (completed, total, sectionId) => {
    // Progress-Callback
  },
});
```

## Dateien

- **orchestrator-worker.ts**: Hauptlogik (Orchestrator + Workers + Evaluator + Decision)
- **section-queries.ts**: Query-Templates für die 7 BD-Fragen
- **prequal-processing-worker.ts**: BullMQ Worker-Integration

## Workflow

### 1. ORCHESTRATOR (AI-geplant)

Der Orchestrator analysiert die Dokument-Preview und erstellt einen Execution-Plan:

- Welche Sections sind kritisch?
- Welche profitieren von Web-Enrichment?
- Wie viele können parallel laufen?

**Output:** `OrchestratorPlan` mit Tasks und Strategie

### 2. WORKERS (parallel)

7 Workers verarbeiten die Sections parallel mit kontrollierter Concurrency:

```typescript
await runWithConcurrency(
  plan.tasks,
  async (task) => executeSectionWorker(...),
  maxConcurrency
);
```

### 3. EVALUATOR (optional)

Prüft die Qualität jeder Section:

- **qualityScore**: 0-100%
- **confidence**: Konfidenz der Antwort
- **completeness**: Vollständigkeit
- **needsRetry**: Retry erforderlich?

Bei Score < `qualityThreshold` → Retry mit Web-Enrichment

### 4. DECISION (Bid/No Bid)

Synthese aller Sections zu einer Empfehlung:

- **bid**: Klare Empfehlung mitbieten
- **no-bid**: Nicht mitbieten
- **conditional-bid**: Unter Bedingungen mitbieten

```typescript
{
  recommendation: 'bid',
  confidence: 75,
  reasoning: '...',
  strengths: ['...'],
  weaknesses: ['...'],
  conditions: ['...']  // nur bei conditional-bid
}
```

## Integration

Der Orchestrator wird automatisch vom BullMQ PreQual Worker aufgerufen:

```typescript
// lib/bullmq/workers/prequal-processing-worker.ts

const result = await runPreQualSectionOrchestrator(preQualificationId, {
  maxConcurrency: 5,
  enableEvaluation: true,
  qualityThreshold: 60,
  onProgress: (completed, total, sectionId) => {
    // Update Job-Progress
  },
});
```

## Phase 2 Features (TODO)

- [ ] **LLM-basierter Evaluator**: Aktuell vereinfachte Implementierung
- [ ] **Streaming-Progress**: SSE an Frontend für Live-Updates
- [ ] **Adaptive Concurrency**: Bei 429-Errors automatisch reduzieren
- [ ] **GUI**: Decision-Card mit Bid/No Bid Empfehlung

## Concurrency Control

Die `runWithConcurrency`-Funktion verhindert Pool-Exhaustion:

```typescript
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]>
```

**Funktionsweise:**
1. Startet max. `concurrency` parallele Promises
2. Wenn Limit erreicht, wartet auf `Promise.race(executing)`
3. Entfernt abgeschlossene Promises aus dem Pool
4. Startet nächste Promise

## Monitoring

```typescript
console.log('[Orchestrator] Plan erstellt: 7 Tasks');
console.log('[Workers] Starte 7 Section-Workers mit Concurrency 5');
console.log('[Worker:budget] Start (Retry: 0, WebEnrichment: true)');
console.log('[Worker:budget] Erfolgreich abgeschlossen');
console.log('[Evaluator] Section budget needs retry (Score: 45)');
console.log('[Decision] Empfehlung: bid (Confidence: 75%)');
```

## Fehlerbehandlung

- **Section-Fehler**: Einzelne Section-Fehler brechen nicht den gesamten Job ab
- **Retry-Logik**: Bei niedrigem Quality-Score automatischer Retry mit Web-Enrichment
- **Rate-Limits**: Concurrency-Control verhindert 429-Errors
- **Fallback**: Bei skipPlanning=true wird Standard-Plan verwendet

## Beispiel-Output

```typescript
{
  success: true,
  completedSections: 7,
  failedSections: [],
  plan: {
    tasks: [/* 7 Tasks */],
    strategy: { mode: 'hybrid', maxConcurrency: 5 }
  },
  decision: {
    recommendation: 'bid',
    confidence: 75,
    reasoning: 'Budget passt, Fristen machbar, starke Referenzen',
    strengths: ['Passende Technologie', 'Gute Referenzen'],
    weaknesses: ['Knappe Fristen'],
    conditions: []
  }
}
```
