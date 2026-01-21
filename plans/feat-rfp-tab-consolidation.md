# feat: RFP Detail Tabs Consolidation (4 → 2 Tabs)

## Enhancement Summary

**Deepened on:** 2026-01-19
**Sections enhanced:** 5 Implementation Phases + Technical Approach
**Research agents used:** TypeScript Reviewer, Architecture Strategist, Code Simplicity Reviewer, Performance Oracle, Pattern Recognition Specialist, Frontend Design, React Best Practices, Web Design Guidelines

### Key Improvements

1. **Phase 0 hinzugefügt**: Type-Konsolidierung vor Implementierung
2. **Minimaler Ansatz**: Nur 3-4 neue Dateien statt 12+ (Simplicity Reviewer)
3. **Performance-Optimierungen**: useMemo für JSON-Parsing, Lazy Loading für Accordions
4. **Accessibility-Fixes**: Keyboard-Navigation für SiteTree, Focus-Management

### Critical Warnings from Reviewers

- **Simplicity Reviewer**: 12+ neue Dateien ist Over-Engineering - besser minimales Refactoring
- **Pattern Recognition**: parseJsonField<T>() in 5+ Dateien dupliziert - erst konsolidieren
- **Performance Oracle**: Site Trees mit 100+ Nodes brauchen Virtualisierung

## Overview

Konsolidiere die 4 existierenden Tabs (Overview, BU-Matching, 10 Questions, Workflow) auf der RFP Detail-Seite zu 2 Tabs:

1. **Tab "Fakten"** - Alle gescrapten Audit-Daten in umfassender Darstellung
2. **Tab "Entscheidungsmatrix"** - CMS-Evaluation Matrix mit BL-Weiterleitung

**Wichtige Entscheidung nach Research:** json-render wird NICHT verwendet - es ist Over-Engineering für statische Daten. Die Lösung nutzt standard React-Komponenten mit ShadCN UI.

## Problem Statement

Die aktuelle 4-Tab-Struktur ist fragmentiert:

- **Overview**: Zeigt nur Summary-Daten, nicht alle Details
- **BU-Matching**: Separate Tab für BU-Empfehlung
- **10 Questions**: Generierte Fragen/Antworten
- **Workflow** (existiert im Code, aber nicht in Tabs): ScrapedFactsPhase mit allen Details

Benutzer müssen zwischen Tabs wechseln, um vollständige Informationen zu erhalten.

## Proposed Solution

### Tab 1: "Fakten" (Alle Audit-Daten)

Konsolidiert alle Daten aus QuickScan in einer umfassenden, accordion-basierten Ansicht:

**Sektion 1: Übersicht (always visible)**

- Website URL, Status Badge
- BL-Empfehlung mit Confidence Score
- Quick Stats: Seitenanzahl, Tech Stack Primary, Complexity Score

**Sektion 2: Tech Stack** (Accordion)

- CSS Frameworks mit Confidence
- JavaScript Frameworks
- Backend Technologies
- Analytics & Marketing Tools
- CDN & Hosting
- API Endpoints

**Sektion 3: Content & Features** (Accordion)

- Seitenanzahl, Komplexität, Sprachen
- Media Assets (Bilder, Videos, Dokumente)
- Erkannte Features (E-Commerce, Blog, Forms, etc.)

**Sektion 4: Navigation** (Accordion)

- Navigation Items, Max Tiefe
- Main Nav, Footer Nav
- Search, Breadcrumbs, Mega Menu

**Sektion 5: Site Tree** (Accordion, wenn vorhanden)

- Hierarchische Sitemap-Struktur
- Sources (Sitemap, Link Discovery, Navigation)

**Sektion 6: Content Types** (Accordion, wenn vorhanden)

- Distribution Chart
- Estimated Custom Fields
- Recommendations

**Sektion 7: Accessibility Audit** (Accordion)

- Score mit Progress Bar
- WCAG Level Badge
- Issues by Severity (Critical, Serious, Moderate, Minor)
- Check Results (Alt-Texte, ARIA, Headings, etc.)

**Sektion 8: SEO Audit** (Accordion)

- Score mit Progress Bar
- Check Results (Title, Meta, Canonical, Sitemap, etc.)

**Sektion 9: Legal/DSGVO** (Accordion)

- Compliance Score
- Checks (Impressum, Datenschutz, Cookie Banner, AGB)
- GDPR Indicators

**Sektion 10: Performance** (Accordion)

- Load Time Indicator
- Resource Counts (Scripts, Stylesheets, Images, Fonts)
- Optimization Checks (Lazy Loading, Minification, Caching)

**Sektion 11: Screenshots** (Accordion)

- Desktop & Mobile Screenshots
- Lightbox-fähige Bildergalerie

**Sektion 12: Company Intelligence** (Accordion)

- Firmenname, Branche
- Datenqualität & Quellen

**Sektion 13: Decision Makers** (Accordion, wenn vorhanden)

- Kontakt-Tabelle (Name, Rolle, LinkedIn, E-Mail)
- Generic Contacts
- Research Quality Score

**Sektion 14: Migration Complexity** (Accordion, wenn vorhanden)

- Complexity Score Visualization
- Factor Breakdown (CMS Export, Data Quality, Content, Integrations)
- Estimated Effort (PT Range)
- Warnings & Opportunities

**Sektion 15: 10 Fragen** (Accordion)

- Generierte Antworten aus QuickScan-Daten
- Collapsed by default

### Tab 2: "Entscheidungsmatrix"

Zeigt CMS-Evaluation und BL-Weiterleitung:

**Oberer Bereich: CMS Evaluation**

- Start-Button wenn noch nicht ausgeführt
- Loading State während Evaluation
- CMSEvaluationMatrix Komponente mit:
  - Recommendation Header (Primary CMS, Confidence)
  - CMS Comparison Cards
  - Requirements Matrix Table

**Unterer Bereich: BL Weiterleitung**

- Business Unit Auswahl (Dropdown)
- AI-Empfehlung Hinweis
- Weiterleiten Button
- Erfolgs-Feedback mit Redirect

## Technical Approach

### Dateien zu ändern

| Datei                                            | Änderungen                               |
| ------------------------------------------------ | ---------------------------------------- |
| `components/bids/bid-tabs.tsx`                   | 2 Tabs statt 3, neue Props-Struktur      |
| `components/bids/quick-scan-results.tsx`         | Neue Tab-Content-Struktur, Props-Mapping |
| `components/bids/phases/scraped-facts-phase.tsx` | Refactoring: Split in Sub-Komponenten    |

### Neue Komponenten

| Komponente                                       | Beschreibung                         |
| ------------------------------------------------ | ------------------------------------ |
| `components/bids/facts-tab.tsx`                  | Haupt-Komponente für Tab 1           |
| `components/bids/facts/tech-stack-section.tsx`   | Tech Stack Accordion-Sektion         |
| `components/bids/facts/content-section.tsx`      | Content & Features Sektion           |
| `components/bids/facts/audit-scores-section.tsx` | A11y, SEO, Legal, Performance        |
| `components/bids/facts/company-section.tsx`      | Company Intel, Decision Makers       |
| `components/bids/facts/migration-section.tsx`    | Site Tree, Content Types, Complexity |
| `components/bids/decision-matrix-tab.tsx`        | Haupt-Komponente für Tab 2           |

### Bestehende Komponenten wiederverwenden

- `CMSEvaluationMatrix` - bereits fertig
- `parseJsonField<T>()` Helper - bereits vorhanden
- ShadCN: Accordion, Card, Badge, Progress, Table, Tabs

### Datenfluss

```
rfps/[id]/page.tsx
    |
    v
BidDetailClient (fetcht quickScan)
    |
    v
QuickScanResults
    |
    ├── BidTabs
    │   ├── Tab "Fakten" --> FactsTab
    │   │   ├── OverviewCard
    │   │   ├── TechStackSection
    │   │   ├── ContentSection
    │   │   ├── NavigationSection
    │   │   ├── SiteTreeSection (optional)
    │   │   ├── ContentTypesSection (optional)
    │   │   ├── AccessibilitySection
    │   │   ├── SeoSection
    │   │   ├── LegalSection
    │   │   ├── PerformanceSection
    │   │   ├── ScreenshotsSection
    │   │   ├── CompanySection
    │   │   ├── DecisionMakersSection (optional)
    │   │   ├── MigrationSection (optional)
    │   │   └── TenQuestionsSection
    │   │
    │   └── Tab "Entscheidungsmatrix" --> DecisionMatrixTab
    │       ├── CMSEvaluationTrigger
    │       ├── CMSEvaluationMatrix
    │       └── BLForwardingCard
```

## Acceptance Criteria

### Functional Requirements

- [ ] 2 Tabs statt 4: "Fakten" und "Entscheidungsmatrix"
- [ ] URL-State: `?tab=fakten` und `?tab=matrix`
- [ ] Tab "Fakten" zeigt ALLE QuickScan-Daten
- [ ] Tab "Entscheidungsmatrix" enthält CMS-Evaluation UND BL-Weiterleitung
- [ ] Optionale Sektionen (Site Tree, Decision Makers, etc.) werden nur angezeigt wenn Daten vorhanden
- [ ] BL-Weiterleitung funktioniert wie bisher
- [ ] CMS-Evaluation kann gestartet und angezeigt werden
- [ ] "Erneut scannen" Button bleibt erhalten

### Non-Functional Requirements

- [ ] Accordion-Sektionen sind keyboard-navigierbar
- [ ] Responsive Design für Mobile
- [ ] Keine Breaking Changes für bestehende QuickScan-Daten
- [ ] Loading States für async Operationen
- [ ] Error States für fehlgeschlagene Daten

### Quality Gates

- [ ] TypeScript strict mode ohne Fehler
- [ ] Keine Console Errors/Warnings
- [ ] Alle existierenden QuickScan-Daten korrekt dargestellt
- [ ] BL-Weiterleitung E2E getestet

## Implementation Phases

### Phase 0: Type Consolidation (NEW - from TypeScript Reviewer)

**Aufgaben:**

- Alle QuickScan-bezogenen Types in zentrale Datei konsolidieren
- `parseJsonField<T>()` Helper nach `lib/quick-scan/utils.ts` verschieben
- Type Guards für JSON-Felder implementieren

**Dateien:**

- `lib/quick-scan/types.ts` (NEW)
- `lib/quick-scan/utils.ts` (NEW)

**Research Insights:**

- parseJsonField<T>() ist in 5+ Dateien dupliziert
- Zentrale Types ermöglichen bessere IDE-Unterstützung
- Type Guards verhindern Runtime-Errors bei malformed JSON

### Phase 1: Minimale Komponenten-Struktur (SIMPLIFIED)

**Aufgaben (reduziert nach Simplicity Review):**

- `FactsTab` als Wrapper um bestehende Accordion-Sektionen
- `DecisionMatrixTab` mit CMS-Eval + BL-Forwarding
- **NICHT**: 12+ separate Section-Dateien erstellen

**Dateien (nur 3 neue):**

- `components/bids/facts-tab.tsx`
- `components/bids/decision-matrix-tab.tsx`
- `lib/quick-scan/types.ts`

**Research Insights (Simplicity Reviewer):**

- 12+ neue Dateien ist Over-Engineering für UI-Refactoring
- Bestehende Accordion-Struktur in scraped-facts-phase.tsx beibehalten
- Nur Tab-Wrapper und Integration-Code neu schreiben

### Phase 2: Facts Tab Content Migration

**Aufgaben:**

- Accordion-Rendering aus `scraped-facts-phase.tsx` in `facts-tab.tsx` verschieben
- Performance-Optimierung: useMemo für JSON-Parsing
- Lazy Loading für Accordion-Inhalte mit React.lazy()

**Dateien:**

- `components/bids/facts-tab.tsx` (erweitert)

**Research Insights (Performance Oracle):**

```typescript
// Memoize parsed JSON to avoid re-parsing on re-renders
const techStack = useMemo(
  () => parseJsonField<TechStackData>(quickScan.techStack),
  [quickScan.techStack]
);

// Lazy load heavy sections
const SiteTreeSection = lazy(() => import('./facts/site-tree-section'));
```

**Performance Considerations:**

- 15 Accordions mit potentiell großen JSON-Feldern
- Site Trees können 100+ Nodes haben → Virtualisierung nötig
- useMemo verhindert JSON.parse bei jedem Render

### Phase 3: Decision Matrix Tab implementieren

**Aufgaben:**

- CMS Evaluation Trigger/Loading States
- CMSEvaluationMatrix Integration
- BL Forwarding Card
- Error Boundary für CMS-Eval-Fehler

**Dateien:**

- `components/bids/decision-matrix-tab.tsx`

**Research Insights (Architecture Strategist):**

```typescript
// Error Boundary für isolierte Fehlerbehandlung
<ErrorBoundary fallback={<CMSEvalError onRetry={refetch} />}>
  <Suspense fallback={<CMSEvalSkeleton />}>
    <CMSEvaluationMatrix result={cmsResult} />
  </Suspense>
</ErrorBoundary>
```

### Phase 4: Integration in BidTabs

**Aufgaben:**

- `bid-tabs.tsx` auf 2 Tabs umstellen
- URL-State: `?tab=fakten` und `?tab=matrix`
- Focus Management bei Tab-Wechsel

**Dateien:**

- `components/bids/bid-tabs.tsx`
- `components/bids/quick-scan-results.tsx`

**Research Insights (Web Design Guidelines):**

- Tab-Panel muss `role="tabpanel"` und `aria-labelledby` haben
- Focus sollte bei Tab-Wechsel auf Panel-Content gehen
- Keyboard Navigation: Arrow Keys für Tab-Wechsel

### Phase 5: Accessibility & Polish

**Aufgaben:**

- SiteTreeNodeComponent: Keyboard-Navigation hinzufügen
- Accordion: aria-expanded States prüfen
- Mobile: Touch-Targets mindestens 44x44px
- Console Warnings beheben

**Dateien:**

- `components/bids/facts-tab.tsx`
- `components/bids/facts/site-tree-section.tsx` (falls separiert)

**Research Insights (Web Design Guidelines):**

```typescript
// SiteTree mit Keyboard-Navigation (TreeView Pattern)
<div
  role="treeitem"
  tabIndex={0}
  aria-expanded={isOpen}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') toggle();
    if (e.key === 'ArrowRight' && !isOpen) toggle();
    if (e.key === 'ArrowLeft' && isOpen) toggle();
  }}
>

// Accordion Focus Management
<AccordionTrigger
  className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
/>
```

**Accessibility Checklist:**

- [ ] Alle Accordions haben aria-expanded
- [ ] SiteTree unterstützt Arrow Key Navigation
- [ ] Tab-Panels haben korrektes ARIA
- [ ] Touch-Targets >= 44x44px
- [ ] Fokus-Indikatoren sichtbar

## Dependencies & Risks

### Dependencies

- Bestehende QuickScan-Daten im korrekten Format
- CMSEvaluationMatrix Komponente funktionsfähig
- BL-Weiterleitung Action funktionsfähig

### Risks

- **Legacy Daten**: Ältere QuickScans ohne v2-Felder - Mitigation: Graceful degradation
- **Mobile Layout**: Dense accordion content - Mitigation: Responsive tests
- **CMS Eval Timing**: Kann langsam sein - Mitigation: Clear loading states
- **Performance bei großen Site Trees**: 100+ Nodes - Mitigation: react-window Virtualisierung
- **JSON Parse Overhead**: Viele JSON-Felder - Mitigation: useMemo + parse-once Pattern

## References

### Internal Files

- `components/bids/phases/scraped-facts-phase.tsx:460-1916` - Bestehendes Accordion-Rendering
- `components/bids/cms-evaluation-matrix.tsx:1-357` - CMS Matrix Komponente
- `components/bids/bid-tabs.tsx` - Aktuelle Tab-Struktur
- `lib/db/schema.ts:405-463` - QuickScan Schema

### Research Findings

- json-render ist Over-Engineering für statische Daten
- Standard React + ShadCN ist die richtige Lösung
- Accordion mit multiple open ist best practice für Audit-Dashboards
- Progressive disclosure für Information Density

### Best Practices Applied

- Lighthouse-style Score Cards
- Collapsible sections für dense data
- Badge + Icon combinations für Status
- Sticky headers in comparison tables

### Deepen-Plan Agent Insights

**TypeScript Reviewer:**

- Type Guards für JSON-Felder implementieren
- Discriminated Unions für unterschiedliche Scan-Versionen
- React.memo für Section-Komponenten

**Architecture Strategist:**

- Data Transformation Layer zwischen DB und UI
- Error Boundaries für isolierte Fehlerbehandlung
- Interface Segregation für Section Props

**Code Simplicity Reviewer:**

- ⚠️ 12+ neue Dateien ist Over-Engineering
- Bestehende Accordion-Struktur beibehalten
- Minimale Änderungen: nur Tab-Wrapper + Integration

**Performance Oracle:**

- useMemo für alle parseJsonField<T>() Aufrufe
- Lazy Loading für schwere Accordion-Sektionen
- react-window für Site Trees mit 100+ Nodes

**Pattern Recognition:**

- parseJsonField<T>() in 5+ Dateien dupliziert → konsolidieren
- StatusBadge Pattern extrahieren
- AccordionSection Wrapper erstellen

**Frontend Design:**

- Industrial Data Dashboard Aesthetic
- Command Bar mit Key Metrics im Header
- Radial Gauges für Audit Scores

**React Best Practices:**

- Server Components für Data Fetching
- Client Components für Interaktivität
- React.cache() für Request Deduplication

**Web Design Guidelines (Accessibility):**

- SiteTree braucht role="tree" + aria-expanded
- Accordion-Triggers brauchen sichtbare Focus-Indikatoren
- Touch-Targets mindestens 44x44px
