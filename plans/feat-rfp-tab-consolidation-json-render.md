# feat: RFP Tab-Konsolidierung mit json-render

## Enhancement Summary

**Deepened on:** 2025-01-19
**Sections enhanced:** 6
**Research agents used:** 11 (json-render, ShadCN, Decision Matrix, Streaming, Drizzle, Architecture, Simplicity, Performance, Security, Frontend Design)

### Key Improvements

1. **Critical simplification** - json-render entfernt durch Simplicity-Review
2. **Performance-first approach** - Separate Tabelle für große JSON-Daten
3. **Security hardening** - Prompt Injection Protection, Zod-Validierung
4. **UX optimization** - Sub-Tabs statt 15+ Accordions

### Major Direction Change

Nach der Analyse wird **json-render NICHT verwendet** - es ist Over-Engineering für statische Daten. Die Lösung ist statische React-Komponenten mit optimiertem Rendering.

---

## Übersicht

Konsolidierung der 4 aktuellen RFP-Detail-Tabs zu 2 Tabs mit erweiterter Datenspeicherung und verbesserter Visualisierung.

**Entscheidung nach Review:** json-render wird **nicht verwendet** - statische React-Komponenten sind ausreichend und erheblich einfacher.

## Aktueller Stand

**Aktuelle 4 Tabs:**

1. **Overview** - Quick Scan Ergebnisse, Tech Stack, Features, Audits
2. **BU Matching** - Business Unit Matching mit Scores
3. **10 Fragen** - BIT-Entscheidungsfragen
4. **Workflow** - Gescrapte Fakten, CMS Evaluation, BL-Forwarding

**Dateien:**

- `components/bids/bid-tabs.tsx` - Tab-Navigation
- `components/bids/quick-scan-results.tsx` - Quick Scan UI (1829 Zeilen!)
- `components/bids/cms-evaluation-matrix.tsx` - CMS Matrix
- `components/bids/phases/scraped-facts-phase.tsx` - Gescrapte Fakten (1917 Zeilen!)

## Problemstellung

1. **Zu viele Tabs** - Inhalte sind auf 4 Tabs verteilt, User muss zwischen Tabs wechseln
2. **Unzureichende Darstellung** - Gescrapte Daten sind nicht ausführlich sichtbar
3. **Datenverlust** - Nicht alle gescrapten Daten werden gespeichert
4. **Monolithische Komponenten** - StaticResultsView (1829 Zeilen) und ScrapedFactsPhase (1917 Zeilen)

## Lösung (Aktualisiert nach Reviews)

### Neue Tab-Struktur (2 Tabs mit Sub-Navigation)

```
┌─────────────────────────────────────────────────────────────┐
│ RFP: [Name]                                   [BIT] [NO BIT] │
├─────────────────────────────────────────────────────────────┤
│ [Fakten]                    [Entscheidungs-Matrix]           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  FAKTEN TAB - Mit Sub-Tabs zur Organisation                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Übersicht] [Technisch] [Inhalt] [Qualität] [Business]│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ÜBERSICHT: Key Metrics auf einen Blick                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • BL Empfehlung: CX (85%)                              │   │
│  │ • Migration Complexity: Mittel                          │   │
│  │ • Tech Stack: 24 Technologien                           │   │
│  │ • Accessibility Score: AA (82/100)                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  TECHNISCH: (Accordion)                                    │
│  • Tech Stack, Integrations, Performance                    │
│                                                               │
│  INHALT: (Accordion)                                       │
│  • Content-Struktur, Navigation, Site Tree                   │
│                                                               │
│  QUALITÄT: (Accordion)                                      │
│  • Accessibility Audit, SEO Audit, Legal Compliance          │
│                                                               │
│  BUSINESS: (Accordion)                                      │
│  • Company Intelligence, Decision Makers, BL Recommendation    │
│                                                               │
│  ENTSCHEIDUNGS-MATRIX TAB                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Radar Chart + Gewichtete Tabelle                      │   │
│  │  EMPFEHLUNG: BIT (Konfidenz: 85%)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technischer Ansatz (Aktualisiert)

### Phase 1: Schema-Optimierung (Performance)

**Problemt:** Die `quickScans` Tabelle hat bereits 13 JSON-Spalten. Weitere Spalten würden die Performance beeinträchtigen.

**Lösung:** Separate Tabelle für große Daten + Generated Columns für Indizierung.

```typescript
// lib/db/schema.ts - Neue separate Tabelle
export const quickScanDetails = sqliteTable(
  'quick_scan_details',
  {
    id: text('id').primaryKey(),
    quickScanId: text('quick_scan_id')
      .notNull()
      .references(() => quickScans.id),

    // Alle Audit-Daten zusammen (oder einzeln für Granularität)
    fullAuditData: text('full_audit_data'), // JSON - optional, lazy loaded

    // Decision Matrix (nur wenn generiert)
    decisionMatrix: text('decision_matrix'), // JSON - validiert mit Zod

    // Metadata für Cache-Invalidation
    dataHash: text('data_hash'), // Hash aller Audit-Daten für Cache
    generatedAt: integer('generated_at', { mode: 'timestamp' }),
  },
  table => ({
    quickScanIdIdx: index('quick_scan_details_quick_scan_id_idx').on(table.quickScanId),
    dataHashIdx: index('quick_scan_details_data_hash_idx').on(table.dataHash),
  })
);

// Original Tabelle - Generated Columns für Performance
export const quickScans = sqliteTable(
  'quick_scans',
  {
    // ... existierende Felder ...

    // Generated Columns für häufige Queries (SQLite Pattern)
    confidenceScore: integer('confidence_score').generatedAlwaysAs(
      sql`CAST(json_extract(${decisionEvaluation}, '$.confidence') AS INTEGER)`
    ),
    recommendedBL: text('recommended_bl').generatedAlwaysAs(
      sql`json_extract(${decisionEvaluation}, '$.recommendedBL')`
    ),
  },
  table => ({
    // Partial Index für aktive RFPs
    activeStatusIdx: index('rfps_active_status_idx')
      .on(table.status)
      .where(sql`status != 'archived'`),
  })
);
```

**Performance-Erkenntnisse:**

- SQLite hat keine direkten JSON-Indizies, aber **Generated Columns** sind die Lösung
- Separate Tabelle verhindert unnötiges Laden von großen JSON-Spalten
- `dataHash` ermöglicht effiziente Cache-Invalidation

### Phase 2: Tab-Konsolidierung mit Sub-Navigation

Statt json-render wird eine clean React-Komponente mit Sub-Tabs verwendet:

```typescript
// components/bids/facts-tab.tsx
'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs";
import { FactsOverview } from './facts/overview';
import { FactsTechnical } from './facts/technical';
import { FactsContent } from './facts/content';
import { FactsQuality } from './facts/quality';
import { FactsBusiness } from './facts/business';

export function FactsTab({ quickScan }: { quickScan: QuickScan }) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Übersicht</TabsTrigger>
        <TabsTrigger value="technical">Technisch</TabsTrigger>
        <TabsTrigger value="content">Inhalt</TabsTrigger>
        <TabsTrigger value="quality">Qualität</TabsTrigger>
        <TabsTrigger value="business">Business</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <FactsOverview quickScan={quickScan} />
      </TabsContent>

      <TabsContent value="technical">
        <FactsTechnical quickScan={quickScan} />
      </TabsContent>

      <TabsContent value="content">
        <FactsContent quickScan={quickScan} />
      </TabsContent>

      <TabsContent value="quality">
        <FactsQuality quickScan={quickScan} />
      </TabsContent>

      <TabsContent value="business">
        <FactsBusiness quickScan={quickScan} />
      </TabsContent>
    </Tabs>
  );
}
```

### Phase 3: Entscheidungsmatrix Tab

```typescript
// components/bids/decision-matrix-tab.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { CriteriaTable } from './criteria-table';

interface DecisionMatrixTabProps {
  decisionMatrix: DecisionMatrix;
  onEditCriteria?: () => void;
}

export function DecisionMatrixTab({ decisionMatrix, onEditCriteria }: DecisionMatrixTabProps) {
  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle>Entscheidungs-Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-4xl font-bold">
              {decisionMatrix.overallScore.toFixed(1)}/10
            </div>
            <div className="flex-1">
              <Progress
                value={decisionMatrix.overallScore * 10}
                className="h-3"
              />
            </div>
            <Badge
              variant={
                decisionMatrix.recommendation === 'bid' ? 'default' :
                decisionMatrix.recommendation === 'no_bid' ? 'destructive' : 'secondary'
              }
              className="px-3 py-1"
            >
              {decisionMatrix.recommendation === 'bid' ? 'BIT' : 'NO BIT'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Konfidenz: {decisionMatrix.confidence}%
          </p>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Kategorie-Vergleich</CardTitle>
        </CardHeader>
        <CardContent>
          <RadarChartVisualization data={formatForRadar(decisionMatrix.scoresByCategory)} />
        </CardContent>
      </Card>

      {/* Criteria Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kriterien</CardTitle>
          {onEditCriteria && (
            <Button onClick={onEditCriteria} variant="outline" size="sm">
              Bearbeiten
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <CriteriaTable criteria={decisionMatrix.criteria} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Phase 4: Performance-Optimierte Accordion-Komponente

```typescript
// components/bids/facts/technical-accordion.tsx
'use client';

import { useState, useMemo, memo, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { VirtualAccordion } from '@/components/ui/virtual-accordion';

// Memoisiertes Item für Performance
const AccordionSection = memo(function AccordionSection({
  category,
  items,
  defaultOpen
}: {
  category: string;
  items: FactItem[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <AccordionItem value={category} className="border rounded-lg">
      <AccordionTrigger
        onClick={() => setIsOpen(!isOpen)}
        className="hover:no-underline hover:bg-muted/50 px-4"
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          <span className="capitalize">{category}</span>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <PaginatedContent items={items} pageSize={20} />
      </AccordionContent>
    </AccordionItem>
  );
});

// Paginated Content für große Listen
const PaginatedContent = memo(function PaginatedContent({
  items,
  pageSize = 20
}: {
  items: FactItem[];
  pageSize?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <div className="space-y-2">
      {visibleItems.map((item) => (
        <FactItem key={item.id} item={item} />
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisibleCount(c => c + pageSize)}
          className="w-full"
        >
          Weitere {Math.min(pageSize, items.length - visibleCount)} laden
        </Button>
      )}
    </div>
  );
});
```

### Phase 5: Decision Matrix Schema mit Zod-Validierung

```typescript
// lib/types.ts - Validierte Schemas
import { z } from 'zod';

export const DecisionCriterionSchema = z.object({
  id: z.string().max(50),
  name: z.string().max(200),
  category: z.enum(['technical', 'commercial', 'risk', 'references', 'capacity']),
  weight: z.number().min(0).max(100),
  score: z.number().min(0).max(10),
  weightedScore: z.number(),
  rationale: z.string().max(1000).optional(),
  dataSource: z.enum(['extracted', 'detected', 'inferred', 'manual']),
});

export const DecisionMatrixSchema = z.object({
  criteria: z.array(DecisionCriterionSchema).max(50),
  scoresByCategory: z.record(
    z.object({
      totalWeight: z.number(),
      weightedScore: z.number(),
      normalizedScore: z.number().min(0).max(10),
    })
  ),
  overallScore: z.number().min(0).max(10),
  recommendation: z.enum(['bid', 'no_bid', 'uncertain']),
  confidence: z.number().min(0).max(100),
  metadata: z.object({
    generatedAt: z.string().datetime(),
    totalCriteria: z.number(),
    dataCompleteness: z.number().min(0).max(100),
  }),
});

export type DecisionMatrix = z.infer<typeof DecisionMatrixSchema>;
```

## Akzeptanzkriterien

### Funktional

- [ ] 2 Tabs: "Fakten" und "Entscheidungs-Matrix"
- [ ] Fakten-Tab mit 5 Sub-Tabs: Übersicht, Technisch, Inhalt, Qualität, Business
- [ ] Entscheidungsmatrix mit gewichteter Tabelle
- [ ] Radar Chart für Kategorie-Vergleich
- [ ] Cache für Decision Matrix

### Daten

- [ ] Separate `quickScanDetails` Tabelle
- [ ] `decisionMatrix` Schema mit Zod-Validierung
- [ ] Generated Columns für Performance
- [ ] `dataHash` für Cache-Invalidation

### UI/UX

- [ ] Progressive Disclosure - Zusammenfassung zuerst
- [ ] Color-Coding für Scores (grün > 7, gelb 4-7, rot < 4)
- [ ] Pagination für große Listen (>20 Items)
- [ ] Responsive Design
- [ ] Keyboard Navigation für Accordions

### Performance

- [ ] Selective Column Loading (kein SELECT \*)
- [ ] Separate Tabelle für große JSONs
- [ ] Virtual Scrolling für 100+ Items
- [ ] Response Caching mit ETag

### Security

- [ ] Zod-Validierung für alle JSON-Felder
- [ ] Prompt Injection Protection (falls AI verwendet)
- [ ] Prototype Pollution Protection beim JSON-Parsing
- [ ] Output Sanitization für User Content

## Implementierungsphasen

### Phase 1: Database Schema (1h)

- [ ] `quickScanDetails` Tabelle erstellen
- [ ] Generated Columns für `quickScans`
- [ ] Migration für bestehende Daten
- [ ] Indexes für Performance

### Phase 2: Data Layer (1h)

- [ ] Zod Schemas für Decision Matrix
- [ ] Helper für Selective Column Loading
- [ ] Cache-Invalidation mit dataHash

### Phase 3: UI Komponenten (3h)

- [ ] `FactsTab` mit Sub-Tabs
- [ ] `DecisionMatrixTab` mit Radar Chart
- [ ] `BidTabs` Refactoring auf 2 Tabs
- [ ] Sub-Tab Komponenten (Overview, Technical, etc.)

### Phase 4: Performance (2h)

- [ ] Pagination für große Listen
- [ ] Virtual Scrolling (optional für 100+ Items)
- [ ] Response Caching

### Phase 5: Testing & Polish (1h)

- [ ] Browser-Tests
- [ ] Security-Tests
- [ ] Performance-Tests

## Referenzen

### Intern

- `components/bids/bid-tabs.tsx` - Aktuelle Tab-Implementierung
- `components/bids/quick-scan-results.tsx` - Quick Scan UI (1829 Zeilen)
- `components/bids/phases/scraped-facts-phase.tsx` - Gescrapte Fakten (1917 Zeilen)
- `lib/db/schema.ts` - Datenbank-Schema
- `lib/quick-scan/schema.ts` - Quick Scan Schema

### Extern

- https://ui.shadcn.com/docs/components - ShadCN Components
- https://recharts.github.io/ - Recharts Radar Charts
- https://tanstack.com/table/latest/docs/react/react-table - TanStack Table
- https://ui.shadcn.com/docs/components/accordion - Accordion Patterns
- https://orm.drizzle.team/docs/indexes-constraints - Drizzle Indexes

## Research Insights

### Best Practices

- **Accordion Pattern**: Verwende `type="multiple"` mit intelligenten `defaultValue` - wichtige Sektionen standardmäßig öffnen
- **Pagination**: 20 Items pro Seite mit "Load More" Button statt unendlichem Scroll
- **Color Coding**: Semantische Farben mit Text-Labels (nicht nur Farbe)
- **Generated Columns**: SQLite-Pattern für JSON-Indizierung über Virtual Columns

### Performance Considerations

- **Selective Loading**: Liste-Queries nur mit notwendigen Spalten
- **Separate Tables**: Große JSONs in separater Tabelle für bessere Query-Performance
- **Cache Invalidation**: Hash-basierte Invalidierung statt zeitbasierter
- **Virtual Scrolling**: Ab 100 Items notwendig, darunter Pagination reicht

### Security Considerations

- **Zod Validation**: Alle JSON-Felder vor dem Speichern validieren
- **Prototype Pollution**: JSON.parse mit Reviver für `__proto__`, `constructor`, `prototype`
- **Input Sanitization**: User-Inputs vor AI-Prompt verwenden
- **Rate Limiting**: AI-Generation Endpoints mit Rate Limit schützen
