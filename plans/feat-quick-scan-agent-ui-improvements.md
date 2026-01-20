# feat: Quick Scan Agent UI & Auto-Start Improvements

## Enhancement Summary

**Deepened on:** 2026-01-19
**Sections enhanced:** 6 Phases
**Research agents used:** architecture-strategist, performance-oracle, code-simplicity-reviewer, agent-native-reviewer, kieran-typescript-reviewer, pattern-recognition-specialist, react-best-practices, framework-docs-researcher

### Key Improvements from Research
1. **Component Split**: `quick-scan-results.tsx` (1742 lines) sollte in kleinere Komponenten aufgeteilt werden
2. **Event Batching**: SSE-Events mit 100ms Intervallen batchen statt einzeln senden
3. **Virtual Scrolling**: Für Tree-View mit 500+ URLs implementieren
4. **Retry Pattern**: Exponential Backoff mit Jitter für DuckDuckGo API fehlt aktuell
5. **Simplicity First**: 7-step Fallback-Kette vereinfachen auf 3-4 effektive Schritte

### Architectural Recommendations
- Discriminated Unions für Event-Typen bereits gut implementiert
- Observer Pattern für SSE Streaming vorhanden
- Missing: Retry/Circuit Breaker Pattern für externe APIs
- React: `useTransition` für non-urgent UI updates nutzen

## Overview

Umfassende Verbesserung des Quick Scan Systems auf der RFP-Detail-Seite (`/rfps/[id]`). Ziel ist eine bessere Agent-Darstellung, zuverlässiger Auto-Start, vollständige Navigation/Sitemap-Visualisierung und funktionierende Company Intelligence.

## Problem Statement

Die aktuelle Quick Scan Implementierung hat mehrere kritische Probleme:

1. **Auto-Start funktioniert nicht zuverlässig** - Der Scan läuft synchron ohne ActivityStream-Visualisierung
2. **Keine Weiterleitung nach Audit** - Nach Completion bleibt der User ohne klare "Next Steps"
3. **Sitemap/Navigation unvollständig** - Zeigt nur "Anmeldung" mit "0" statt vollständigem Baum
4. **Company Intelligence fehlerhaft** - Zeigt "Startseite" statt echten Firmennamen (30% Confidence)
5. **Entscheidungsträger leer** - 0 LinkedIn, 0 Emails trotz vorhandener Impressum-Daten
6. **Agent Activity Darstellung** - Flache Liste ohne Gruppierung, kein Progress-Indikator

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RFP Detail Page (/rfps/[id])                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────────────┐  │
│  │   Status Card   │  │           Documents Sidebar             │  │
│  └─────────────────┘  └─────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Extracted Requirements Card                     │   │
│  │  - Kunde, Technologien, Website URL (clickable/editable)    │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    BidTabs Component                         │   │
│  │  ┌──────────┬─────────────┬────────────┬──────────────────┐ │   │
│  │  │ Overview │ BU Matching │ 10 Fragen  │    Workflow      │ │   │
│  │  └──────────┴─────────────┴────────────┴──────────────────┘ │   │
│  │                                                              │   │
│  │  [Running] → AgentActivityView (NEW - grouped by agent)     │   │
│  │                                                              │   │
│  │  [Completed] → StaticResultsView (enhanced cards)           │   │
│  │    - BL Recommendation Card                                  │   │
│  │    - Tech Stack Card (unchanged)                             │   │
│  │    - Content & Features Card (unchanged)                     │   │
│  │    - Screenshots Card (unchanged)                            │   │
│  │    - Accessibility Card (unchanged)                          │   │
│  │    - SEO & Legal Row (unchanged)                             │   │
│  │    - Performance & Navigation Row (ENHANCED - tree view)     │   │
│  │    - Company Intelligence Card (FIXED - better extraction)   │   │
│  │    - Content Types Card (unchanged)                          │   │
│  │    - Migration Complexity Card (unchanged)                   │   │
│  │    - Decision Makers Card (ENHANCED - retry, Team page)      │   │
│  │    - Analysierte Website Card                                │   │
│  │    - BIT/NO BIT Entscheidung Card (scroll target)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Technical Approach

### Phase 1: Fix Auto-Start & Streaming Flow

**Problem:** `startQuickScan()` läuft synchron und setzt Status direkt auf `completed`, bevor die UI die ActivityStream rendern kann.

**Lösung:** Trennung von Record-Erstellung und Scan-Execution:

1. **`startQuickScan()` ändern** - Nur QuickScan-Record mit `status='running'` erstellen, sofort returnen
2. **`BidDetailClient` anpassen** - Bei `quick_scanning` Status automatisch `QuickScanResults` mit `status='running'` rendern
3. **Streaming Endpoint nutzen** - Der GET-Request auf `/api/rfps/[id]/quick-scan/stream` führt den Scan aus

**Betroffene Dateien:**
- `lib/quick-scan/actions.ts:13-138` - `startQuickScan()` ändern
- `components/bids/bid-detail-client.tsx` - Auto-detect running status
- `app/api/rfps/[id]/quick-scan/stream/route.ts` - Bereits korrekt implementiert

**Research Insights:**
- **Best Practice:** AI SDK v5 nutzt `useChat` mit `onToolCall` für streaming tool execution
- **Performance:** Event batching mit 100ms Intervallen reduziert Re-Renders signifikant
- **Pattern:** Observer Pattern bereits vorhanden, SSE-Implementation korrekt

### Phase 2: Fix Company Name Extraction

**Problem:** `extractCompanyName()` findet "Startseite" im Title und gibt das als Namen zurück.

**Lösung:** Vereinfachte Fallback-Kette (YAGNI - nur effektive Schritte):

```
1. <meta property="og:site_name"> (most reliable)
2. JSON-LD structured data (schema.org Organization/name)
3. <title> cleaned (remove common patterns: "Startseite", "Home", "|", "-")
4. Domain name capitalized (last resort)
```

**Betroffene Dateien:**
- `lib/quick-scan/tools/company-research.ts:21-65` - `extractCompanyName()` erweitern

**Research Insights:**
- **Simplicity:** 7-step Fallback ist Over-Engineering - 4 Schritte reichen
- **Pattern:** Blacklist für deutsche Wörter: "Startseite", "Willkommen", "Home", "Aktuelles"
- **Edge Case:** Title-Cleaning Regex muss ` - `, ` | `, ` :: ` als Separator erkennen

### Phase 3: Fix Decision Makers Research

**Problem:** DuckDuckGo-Suche und Impressum-Extraktion liefern keine Ergebnisse.

**Lösung:**
1. **Debugging hinzufügen** - Logging für jede Suchphase
2. **Team-Seite parsen** - `/team`, `/ueber-uns`, `/about-us` Seiten durchsuchen
3. **Retry mit Backoff** - Bei Rate-Limiting Exponential Backoff
4. **Fehler-Badges** - Wenn LinkedIn fehlschlägt, Warning anzeigen

**Betroffene Dateien:**
- `lib/quick-scan/tools/decision-maker-research.ts` - Erweitern
- `components/bids/quick-scan-results.tsx:1617-1738` - Warning Badge hinzufügen

**Research Insights:**
- **Missing Pattern:** Retry mit Exponential Backoff + Jitter fehlt komplett
- **Implementation:**
  ```typescript
  async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try { return await fn(); }
      catch (e) {
        if (i === maxRetries - 1) throw e;
        await sleep(Math.min(1000 * 2 ** i + Math.random() * 100, 10000));
      }
    }
    throw new Error('Unreachable');
  }
  ```
- **Performance:** Static 500ms delay ersetzen durch dynamisches Backoff

### Phase 4: Enhance Navigation/Sitemap Display

**Problem:** Navigation zeigt nur "Anmeldung" mit "0" - unvollständig.

**Lösung:** Collapsible Tree-View für vollständige Sitemap:

1. **Tree-View Component** - Hierarchische Darstellung der Navigation
2. **Sitemap-URLs integrieren** - sitemap.xml URLs gruppiert nach Pfad-Segmenten
3. **Expandable Sections** - Deep levels sind collapsed by default
4. **URL-Links** - Jeder Eintrag ist ein klickbarer Link

**Betroffene Dateien:**
- `components/bids/quick-scan-results.tsx:1193-1316` - Navigation Card erweitern
- Neue Komponente: `components/bids/site-tree-view.tsx`

**Research Insights:**
- **Performance:** Virtual Scrolling für 500+ URLs mit `@tanstack/react-virtual`
- **UX Pattern:** Lazy Loading für tiefe Hierarchien (load children on expand)
- **Accessibility:** ARIA tree roles für Screen Reader Support
- **Alternative:** ShadCN Accordion statt custom Tree - weniger Code

### Phase 5: Improve Agent Activity Display

**Problem:** Flache Liste ohne Gruppierung, kein Progress-Indikator, keine Hierarchie.

**Lösung:** Neues AgentActivityView mit:

1. **Agent-Gruppierung** - Collapsible Sections pro Agent-Typ (Website Crawler, Tech Stack, Company Intel, etc.)
2. **Progress-Indikator** - Overall progress (X von Y Agents abgeschlossen)
3. **Status-Icons** - ⏳ Running, ✅ Complete, ❌ Failed pro Agent
4. **Duration Tracking** - "Thought for X seconds" wie im AI SDK Reasoning
5. **Expandable Details** - Lange Messages collapsed mit "Show more"

**Betroffene Dateien:**
- `components/ai-elements/activity-stream.tsx` - Refactor zu gruppierten View
- Neue Komponente: `components/ai-elements/agent-activity-view.tsx`

**Research Insights:**
- **React Pattern:** `useTransition` für non-urgent UI updates (Progress Bar)
- **Memoization:** `useMemo` für Event-Gruppierung, `React.memo` für Message-Komponenten
- **AI SDK v5:** `experimental_toolCallStreaming` für live Tool-Call Updates
- **Simplicity:** Circular Buffer (MAX_EVENTS=150) bereits implementiert - gut!
- **Component Split:** ActivityStream von quick-scan-results.tsx extrahieren

### Phase 6: Post-Scan Navigation

**Problem:** Nach Completion keine klare Weiterleitung oder Hinweis auf nächste Schritte.

**Lösung:**
1. **Auto-Scroll** - Nach Completion zum BitDecisionActions scrollen
2. **Highlight Animation** - BIT/NO BIT Card kurz hervorheben
3. **Toast mit CTA** - "Quick Scan abgeschlossen - Entscheidung treffen" mit Scroll-Button

**Betroffene Dateien:**
- `components/bids/quick-scan-results.tsx:373-381` - onComplete Handler erweitern
- `components/bids/bid-detail-client.tsx` - Scroll Logic hinzufügen

**Research Insights:**
- **UX Pattern:** `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- **Animation:** Tailwind `animate-pulse` für 2-3 Sekunden Highlight
- **Toast:** ShadCN `toast` mit Action Button für Scroll-Trigger

## Acceptance Criteria

### Functional Requirements

- [ ] Quick Scan startet automatisch wenn URL aus Dokument extrahiert wird
- [ ] ActivityStream zeigt Live-Fortschritt während Scan läuft
- [ ] Company Name wird korrekt aus Website extrahiert (nicht "Startseite")
- [ ] Entscheidungsträger werden gefunden (LinkedIn, Impressum, Team-Seite)
- [ ] Navigation zeigt vollständigen hierarchischen Baum
- [ ] Nach Scan-Completion wird zu BIT/NO BIT Entscheidung gescrollt
- [ ] Agent Activity ist nach Agent-Typ gruppiert mit Progress-Indikator

### Non-Functional Requirements

- [ ] Scan-Zeit bleibt unter 2 Minuten (Performance-Ziel)
- [ ] ActivityStream updates mindestens alle 500ms (Responsiveness)
- [ ] Tree-View handelt 500+ URLs ohne Performance-Probleme
- [ ] Retry-Mechanismus für externe APIs (DuckDuckGo, LinkedIn)

### Quality Gates

- [ ] Alle bestehenden Quick Scan Tests bestehen weiterhin
- [ ] Manuelle Tests auf 3 verschiedenen Websites
- [ ] Visual Verification via Chrome DevTools Screenshots
- [ ] Console Error Check - keine neuen Errors

## Success Metrics

1. **Company Intelligence Confidence** - Von 30% auf >70% für bekannte Unternehmen
2. **Decision Makers Found** - Mindestens 1 Kontakt für 80% der Websites
3. **Auto-Start Success Rate** - 100% wenn URL in Dokument vorhanden
4. **User Engagement** - Weiterleitung zu BIT/NO BIT Entscheidung

## Dependencies & Prerequisites

- Bestehende Quick Scan Infrastruktur funktioniert grundsätzlich
- DuckDuckGo Search API ist erreichbar
- Playwright für Screenshots und Navigation-Crawling

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| DuckDuckGo Rate Limiting | Decision Makers leer | Exponential Backoff + Caching |
| Synchroner Scan blockiert UI | Schlechte UX | Streaming-basierte Architektur |
| Tree-View Performance bei großen Sites | Langsame Renderzeit | Virtual Scrolling / Lazy Loading |
| Company Name Extraction Edge Cases | Falsche Namen | Erweiterte Fallback-Kette + AI |

## Implementation Order

1. **Phase 1:** Auto-Start & Streaming (kritisch - Basis für alles)
2. **Phase 5:** Agent Activity Display (visuell wichtig)
3. **Phase 2:** Company Name Extraction (Data Quality)
4. **Phase 3:** Decision Makers Research (Data Quality)
5. **Phase 4:** Navigation/Sitemap Display (Feature Enhancement)
6. **Phase 6:** Post-Scan Navigation (UX Polish)

## References & Research

### Internal References
- Quick Scan Agent: `lib/quick-scan/agent.ts`
- Activity Stream: `components/ai-elements/activity-stream.tsx`
- Results View: `components/bids/quick-scan-results.tsx`
- Streaming Route: `app/api/rfps/[id]/quick-scan/stream/route.ts`
- Company Research: `lib/quick-scan/tools/company-research.ts`
- Decision Makers: `lib/quick-scan/tools/decision-maker-research.ts`

### External References
- Vercel AI SDK Elements: https://ai-sdk.dev/elements
- ShadCN Tree Component: https://ui.shadcn.com/docs/components/tree-view
- AG-UI Protocol for Agent UIs: https://www.marktechpost.com/2025/09/18/bringing-ai-agents-into-any-ui

### Related Work
- Previous Quick Scan implementation: `git log --oneline lib/quick-scan/`
- Activity Stream refactor: Components in `components/ai-elements/`
