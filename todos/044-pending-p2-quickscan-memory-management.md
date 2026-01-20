---
status: pending
priority: p2
issue_id: "044"
tags: [code-review, performance, quickscan, memory]
dependencies: []
---

# QuickScan Memory Management für Parallel Operations

## Problem Statement

Der geplante 2-Phasen-Workflow führt in Phase 1.3 bis zu 11 Operationen parallel aus. Bei großen Websites könnte dies zu Memory-Spitzen von 450-750MB führen und den Server destabilisieren.

## Findings

**Source:** performance-oracle Review Agent (Plan Review)

**Kritische Parallel-Operationen in Phase 1.3:**
```typescript
const [
  techStack,        // ~20MB (DOM parsing)
  components,       // ~50MB (large HTML trees)
  contentTypes,     // ~30MB
  navigation,       // ~20MB
  accessibility,    // ~100MB (Playwright)
  seo,              // ~50MB (Playwright)
  legal,            // ~30MB
  performance,      // ~50MB
  screenshots,      // ~200MB (5 Screenshots)
  companyIntel,     // ~20MB (API response)
  decisionMakers,   // ~20MB (API response)
] = await Promise.all([...]);
```

**Geschätzte Memory-Peak:** 450-750MB pro QuickScan

**Probleme:**
1. Kein Chunking für Screenshot-Capture
2. Alle Ergebnisse gleichzeitig im Memory
3. Keine Garbage Collection Hints
4. Browser-Instanzen werden nicht gepoolt

## Proposed Solutions

### Option A: Semaphore-basiertes Concurrency Limit (Empfohlen)

**Pros:** Kontrollierte Parallelität, einfach zu implementieren
**Cons:** Längere Laufzeit
**Effort:** Small (2-4h)
**Risk:** Low

```typescript
import pLimit from 'p-limit';

const limit = pLimit(4); // Max 4 parallel operations

const results = await Promise.all([
  limit(() => aggregateTechStack(pages)),
  limit(() => extractComponents(pages)),
  limit(() => runAccessibilityAudit(url)),
  // ... etc
]);
```

### Option B: Browser Instance Pooling

**Pros:** Spart 2 Browser-Starts, ~100MB pro Instanz
**Cons:** Komplexere Verwaltung
**Effort:** Medium (4-8h)
**Risk:** Medium

```typescript
// Statt 3x browser launch: 1x mit Reuse
const browser = await chromium.launch();
try {
  await runAccessibilityAudit(browser, url);
  await runSeoAudit(browser, url);
  await captureScreenshots(browser, urls);
} finally {
  await browser.close();
}
```

### Option C: Stream-basierte Verarbeitung

**Pros:** Niedrigster Memory Footprint
**Cons:** Kompletter Rewrite, längste Implementierung
**Effort:** Large (2-3 Tage)
**Risk:** High

## Recommended Action

Option A + B kombinieren: Semaphore für Concurrency + Browser Pooling.

## Technical Details

**Affected Files:**
- `lib/quick-scan/agent.ts` - Hauptlogik
- `lib/quick-scan/tools/playwright.ts` - Browser Management

**Dependencies:**
- `p-limit` Package (bereits in vielen Node-Projekten genutzt)

## Acceptance Criteria

- [ ] Memory Peak unter 300MB pro QuickScan
- [ ] Max 4 parallele Operationen gleichzeitig
- [ ] Browser wird nur 1x gestartet und wiederverwendet
- [ ] Screenshots werden sequentiell erfasst (nicht parallel)
- [ ] Memory Metrics in Logs sichtbar
- [ ] Keine OOM Errors bei 10 parallelen QuickScans

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-20 | Todo erstellt aus Plan Review | performance-oracle identifizierte Memory-Risiko |

## Resources

- Plan: `/Users/marc.philipps/.claude/plans/composed-percolating-falcon.md`
- p-limit: https://github.com/sindresorhus/p-limit
