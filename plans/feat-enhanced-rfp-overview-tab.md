# feat: Enhanced RFP Overview-Tab mit Company Intelligence & Tech Stack Visualisierung

**Erstellt:** 2026-01-18
**Status:** Draft → **Deepened**
**Detail Level:** A LOT (Comprehensive)
**Deepened:** 2026-01-18

---

## Enhancement Summary

**Research Agents verwendet:**

- Next.js Reviewer (Architecture, Data Fetching, Revalidation)
- Performance Oracle (Bundle Size, CLS, JSON Parsing)
- Security Sentinel (IDOR, XSS, Authorization)
- Code Simplicity Reviewer (Component Consolidation)
- Architecture Strategist (Pattern Consistency)
- Pattern Recognition Specialist (Duplication Analysis)
- nextjs-frontend Skill (App Router Best Practices)
- frontend-design Skill (B2B Dashboard Patterns)
- react-best-practices Skill (Performance Optimizations)

### Key Improvements from Research

1. **CRITICAL SECURITY:** Fix IDOR vulnerability before implementing (cross-BU access)
2. **SIMPLIFICATION:** Reduce from 11 components to 3-4 consolidated components
3. **PERFORMANCE:** Dynamic import Recharts, useMemo for JSON parsing
4. **ARCHITECTURE:** Use `safeJsonParseOrNull` instead of direct `JSON.parse`
5. **REVALIDATION:** Add `revalidatePath` to QuickScan Server Actions

### Critical Security Blockers

⚠️ **DO NOT SHIP until these are fixed:**

- `lib/team/actions.ts` - Missing BU ownership check (IDOR)
- `app/api/rfps/[id]/bu-matching/route.ts` - No auth check
- `lib/routing/actions.ts` - No auth check in `assignBusinessUnit`

---

## Overview

Die RFP Overview-Tab zeigt aktuell zu wenig Informationen. QuickScan-Daten sind **vorhanden aber ungenutzt**. Dieses Feature erweitert die Overview-Tab um:

- **Umfassende Company Intelligence** (alles was wir über das Unternehmen wissen)
- **Tech Stack Visualisierung** (kategorisierte Badges + Donut Chart)
- **Content Analysis Dashboard** (Accessibility, SEO, Performance Scores)

---

## Problem Statement / Motivation

### Aktueller Zustand

Die Overview-Tab in `/app/(dashboard)/bl-review/[id]/page.tsx` (Zeilen 262-371) zeigt nur:

- Customer Name, Industry, Project Description (aus `extractedDataTyped`)
- BIT/NO BIT Badge
- Technologies List (einfache Badge-Liste)
- Action Buttons (Next Steps)

### Was fehlt

Der `quickScan`-Parameter wird in der Overview-Tab **NICHT verwendet** (obwohl er geladen wird - Zeile 105-111). Verfügbare aber ungenutzte Daten:

| Datentyp       | DB-Feld                            | Schema                             |
| -------------- | ---------------------------------- | ---------------------------------- |
| Company Info   | `quickScans.companyIntelligence`   | `lib/quick-scan/schema.ts:277-340` |
| Tech Stack     | `quickScans.techStack`             | `lib/quick-scan/schema.ts:6-31`    |
| Content Volume | `quickScans.contentVolume`         | `lib/quick-scan/schema.ts:38-58`   |
| Navigation     | `quickScans.navigationStructure`   | `lib/quick-scan/schema.ts:240-272` |
| Accessibility  | `quickScans.accessibilityAudit`    | `lib/quick-scan/schema.ts:63-98`   |
| SEO            | `quickScans.seoAudit`              | `lib/quick-scan/schema.ts:121-146` |
| Performance    | `quickScans.performanceIndicators` | `lib/quick-scan/schema.ts:167-201` |

### Business Value

- **BD-Team sieht sofort ALLE relevanten Informationen** zum Kunden
- **Bessere Entscheidungsgrundlage** für BIT/NO BIT
- **Professionellerer Eindruck** der Plattform
- **Keine manuellen Recherchen** mehr nötig

---

## Proposed Solution (SIMPLIFIED)

### Research Insight: Component Consolidation

**Original:** 11 separate component files
**Simplified:** 3-4 consolidated components

```
components/rfp-overview/
├── overview-section.tsx          # Server Component: Main orchestrator
├── tech-stack-chart.tsx          # Client: Donut chart only
├── quality-scores-card.tsx       # Client: Progress bars for scores
└── index.ts                      # Barrel exports
```

**Rationale (from Simplicity Review):**

- 75% code reduction (1,100 LOC → 300 LOC)
- Single file easier to maintain than 11 scattered files
- Show data inline instead of accordion/collapsible patterns
- Replace 3 Radial Charts with simple Progress Bars

### Architektur-Entscheidung: Server Component mit Client Islands

```
┌─────────────────────────────────────────────────────────────┐
│ Server Component: page.tsx (existing)                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Parallel Data Fetching via Promise.all               │   │
│  │ - getRfpById(id)                                    │   │
│  │ - getQuickScanByRfpId(id)                           │   │
│  │ - Parse JSON server-side (NOT in client)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ OverviewSection (Server Component)                   │   │
│  │ - Company Profile (inline, no accordion)             │   │
│  │ - Tech Stack Badges (categorized grid)               │   │
│  │ - Quality Metrics (progress bars, inline)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Client Island (dynamic import)                       │   │
│  │ - TechStackChart (Recharts Donut)                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Approach (UPDATED)

### Research Insights Applied

#### 1. JSON Parsing - Use safeJsonParseOrNull (Architecture Review)

```typescript
// ❌ WRONG: Plan originally proposed
const companyIntelligence = quickScan?.companyIntelligence
  ? CompanyIntelligenceSchema.safeParse(JSON.parse(quickScan.companyIntelligence))
  : null;

// ✅ CORRECT: Use existing utility
import { safeJsonParseOrNull } from '@/lib/utils/parse';

const companyIntelligence = safeJsonParseOrNull<CompanyIntelligence>(
  quickScan?.companyIntelligence
);
```

#### 2. Suspense Boundaries - Remove Incorrect Usage (Next.js Review)

```typescript
// ❌ WRONG: Plan shows Suspense around sync client component
<Suspense fallback={<ChartSkeleton />}>
  <TechStackChart data={quickScan?.techStack} />  // Already has data!
</Suspense>

// ✅ CORRECT: No Suspense needed (data already loaded via Promise.all)
<TechStackChart data={parsedTechStack} />

// ✅ ALTERNATIVE: Use loading.tsx for route-level loading
// app/(dashboard)/bl-review/[id]/loading.tsx
export default function Loading() {
  return <PageSkeleton />
}
```

#### 3. Dynamic Import for Recharts (Performance Review)

```typescript
// ✅ CORRECT: Lazy-load Recharts (~155KB savings)
import dynamic from 'next/dynamic'

const TechStackChart = dynamic(
  () => import('./tech-stack-chart').then(m => m.TechStackChart),
  {
    ssr: false,
    loading: () => <div className="aspect-square w-full max-w-[250px]" />
  }
)
```

#### 4. Fixed-Height Containers for CLS (Performance Review)

```typescript
// ✅ CORRECT: Reserve space to prevent layout shift
<div className="aspect-square w-full max-w-[250px]">
  <TechStackChart data={data} />
</div>
```

#### 5. Revalidation Strategy (Next.js Review)

```typescript
// lib/quick-scan/actions.ts - ADD THIS
import { revalidatePath } from 'next/cache';

export async function runQuickScanAction(rfpId: string) {
  await runQuickScan(rfpId);
  revalidatePath(`/bl-review/${rfpId}`); // Invalidate cache
}
```

### Phase 1: Security Fixes (MUST DO FIRST)

**Before ANY feature work, fix these critical issues:**

```typescript
// lib/team/actions.ts - ADD BU ownership check
export async function suggestTeamForBid(bidId: string): Promise<SuggestTeamResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Nicht authentifiziert' };
  }

  const [bid] = await db.select().from(rfps).where(eq(rfps.id, bidId)).limit(1);

  // ADD THIS: BU ownership validation
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (user?.role === 'bl' && bid.assignedBusinessUnitId !== user?.businessUnitId) {
    return { success: false, error: 'Keine Berechtigung fur diesen Bid' };
  }

  // ... rest of function
}
```

### Phase 2: Data Integration

```typescript
// app/(dashboard)/bl-review/[id]/page.tsx

// Parse ALL JSON fields server-side, pass typed objects to components
const overviewData = quickScan ? {
  companyIntelligence: safeJsonParseOrNull<CompanyIntelligence>(quickScan.companyIntelligence),
  techStack: safeJsonParseOrNull<TechStackData>(quickScan.techStack),
  accessibilityAudit: safeJsonParseOrNull<AccessibilityAuditData>(quickScan.accessibilityAudit),
  seoAudit: safeJsonParseOrNull<SEOAuditData>(quickScan.seoAudit),
  performanceIndicators: safeJsonParseOrNull<PerformanceData>(quickScan.performanceIndicators),
  contentVolume: safeJsonParseOrNull<ContentVolumeData>(quickScan.contentVolume),
  navigationStructure: safeJsonParseOrNull<NavigationData>(quickScan.navigationStructure),
} : null

// Pass to Overview tab content
{activeTab === 'overview' && (
  <OverviewSection data={overviewData} bid={bid} />
)}
```

### Phase 3: Simplified Overview Section

```typescript
// components/rfp-overview/overview-section.tsx

interface OverviewSectionProps {
  data: OverviewData | null
  bid: Rfp
}

export function OverviewSection({ data, bid }: OverviewSectionProps) {
  if (!data) {
    return <EmptyOverview onRunQuickScan={() => runQuickScanAction(bid.id)} />
  }

  return (
    <div className="space-y-6">
      {/* Company Profile - ALL INLINE, no accordions */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 rounded-lg">
              <AvatarFallback>
                {data.companyIntelligence?.basicInfo?.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{data.companyIntelligence?.basicInfo?.name}</CardTitle>
              <CardDescription>{data.companyIntelligence?.basicInfo?.industry}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Key Metrics - 2-column grid, always visible */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Gegründet" value={data.companyIntelligence?.basicInfo?.foundedYear} />
            <Stat label="Mitarbeiter" value={data.companyIntelligence?.basicInfo?.employeeCount} />
            <Stat label="Standort" value={data.companyIntelligence?.basicInfo?.headquarters} />
            <Stat label="Umsatz" value={data.companyIntelligence?.financials?.revenueClass} />
          </div>

          {/* Leadership - simple inline list */}
          {data.companyIntelligence?.leadership && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Leadership</p>
              <div className="flex flex-wrap gap-2">
                {data.companyIntelligence.leadership.ceo && (
                  <Badge variant="outline">CEO: {data.companyIntelligence.leadership.ceo}</Badge>
                )}
                {data.companyIntelligence.leadership.cto && (
                  <Badge variant="outline">CTO: {data.companyIntelligence.leadership.cto}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tech Stack - Badges + Donut Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tech Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Categorized Badges */}
            <div className="space-y-4">
              {data.techStack?.cms && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">CMS</p>
                  <Badge>{data.techStack.cms}</Badge>
                </div>
              )}
              {data.techStack?.framework && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Framework</p>
                  <Badge variant="secondary">{data.techStack.framework}</Badge>
                </div>
              )}
              {data.techStack?.backend?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Backend</p>
                  <div className="flex flex-wrap gap-1">
                    {data.techStack.backend.map(tech => (
                      <Badge key={tech} variant="outline">{tech}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Donut Chart - Client Component */}
            <div className="aspect-square w-full max-w-[200px]">
              <TechStackChart data={data.techStack} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Scores - Progress Bars (NOT Radial Charts) */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreBar
            label="Accessibility"
            value={data.accessibilityAudit?.score}
            badge={data.accessibilityAudit?.wcagLevel}
          />
          <ScoreBar
            label="SEO"
            value={data.seoAudit?.score}
            issues={data.seoAudit?.issues?.length}
          />
          <ScoreBar
            label="Performance"
            value={data.performanceIndicators?.mobileScore}
            metrics={`LCP: ${data.performanceIndicators?.lcp}s`}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// Simple reusable components
function Stat({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? '-'}</p>
    </div>
  )
}

function ScoreBar({ label, value, badge, issues, metrics }: {
  label: string
  value?: number | null
  badge?: string
  issues?: number
  metrics?: string
}) {
  const score = value ?? 0
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{score}/100</span>
      </div>
      <Progress value={score} className="h-2" indicatorClassName={color} />
      <div className="flex gap-2 mt-1">
        {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
        {issues !== undefined && <span className="text-xs text-muted-foreground">{issues} Issues</span>}
        {metrics && <span className="text-xs text-muted-foreground">{metrics}</span>}
      </div>
    </div>
  )
}
```

### Phase 4: Tech Stack Donut Chart (Client Component)

```typescript
// components/rfp-overview/tech-stack-chart.tsx
'use client'

import { Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface TechStackData {
  cms?: string
  framework?: string
  backend?: string[]
  libraries?: string[]
  analytics?: string[]
  marketing?: string[]
}

const chartConfig = {
  count: { label: "Technologies" },
  frontend: { label: "Frontend", color: "var(--chart-1)" },
  backend: { label: "Backend", color: "var(--chart-2)" },
  infrastructure: { label: "Infrastructure", color: "var(--chart-3)" },
  analytics: { label: "Analytics", color: "var(--chart-4)" },
  marketing: { label: "Marketing", color: "var(--chart-5)" },
} satisfies ChartConfig

export function TechStackChart({ data }: { data: TechStackData | null }) {
  if (!data) return null

  const chartData = [
    { category: "frontend", count: (data.framework ? 1 : 0) + (data.libraries?.length ?? 0), fill: "var(--color-frontend)" },
    { category: "backend", count: data.backend?.length ?? 0, fill: "var(--color-backend)" },
    { category: "infrastructure", count: (data.cms ? 1 : 0), fill: "var(--color-infrastructure)" },
    { category: "analytics", count: data.analytics?.length ?? 0, fill: "var(--color-analytics)" },
    { category: "marketing", count: data.marketing?.length ?? 0, fill: "var(--color-marketing)" },
  ].filter(d => d.count > 0)

  if (chartData.length === 0) return null

  return (
    <ChartContainer config={chartConfig} className="aspect-square">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="category"
          innerRadius={40}
          strokeWidth={4}
        />
      </PieChart>
    </ChartContainer>
  )
}
```

---

## Acceptance Criteria (UPDATED)

### Functional Requirements

- [ ] **F1:** Company Info zeigt name, industry, foundedYear, headquarters, employeeCount, revenueClass INLINE (kein Accordion)
- [ ] **F2:** Leadership zeigt CEO, CTO als inline Badges (nicht als separate Section)
- [ ] **F3:** Tech Stack zeigt kategorisierte Badges für CMS, Framework, Backend
- [ ] **F4:** Tech Stack Donut Chart zeigt Verteilung nach Kategorie (dynamic import)
- [ ] **F5:** Quality Scores als Progress Bars (nicht Radial Charts) für Accessibility, SEO, Performance
- [ ] **F6:** Empty State wenn QuickScan fehlt mit "Run QuickScan" Button

### Non-Functional Requirements (UPDATED)

- [ ] **NF1:** Page Load < 2s (dynamic import Recharts = -155KB bundle)
- [ ] **NF2:** CLS < 0.1 (fixed-height containers für Charts)
- [ ] **NF3:** Mobile-responsive (Stacked Layout unter 768px)
- [ ] **NF4:** Alle externen Links mit `target="_blank" rel="noopener noreferrer"`
- [ ] **NF5:** JSON parsing server-side mit `safeJsonParseOrNull`
- [ ] **NF6:** Revalidation via `revalidatePath` nach QuickScan updates

### Security Requirements (NEW - CRITICAL)

- [ ] **S1:** Fix IDOR in `lib/team/actions.ts` - Add BU ownership check
- [ ] **S2:** Add auth check to `app/api/rfps/[id]/bu-matching/route.ts`
- [ ] **S3:** Add auth check to `lib/routing/actions.ts` assignBusinessUnit
- [ ] **S4:** Validate all external URLs (company website, news links)

### Quality Gates

- [ ] **Q1:** TypeScript strict mode, keine `any` Types
- [ ] **Q2:** Use `safeJsonParseOrNull` für alle JSON-Felder
- [ ] **Q3:** Route-level error.tsx error boundary
- [ ] **Q4:** Visual Regression Test via Chrome DevTools Screenshot

---

## Implementation Phases (SIMPLIFIED)

### Phase 0: Security Fixes (BLOCKING)

- [ ] Fix IDOR vulnerability in `lib/team/actions.ts`
- [ ] Add auth to `app/api/rfps/[id]/bu-matching/route.ts`
- [ ] Add auth to `lib/routing/actions.ts`

### Phase 1: Data Integration

- [ ] Parse all QuickScan JSON fields server-side in page.tsx
- [ ] Create typed `overviewData` object
- [ ] Add `revalidatePath` to QuickScan actions

### Phase 2: Overview Section (MVP)

- [ ] Create `components/rfp-overview/overview-section.tsx`
- [ ] Implement Company Profile card (inline data)
- [ ] Implement Tech Stack badges grid
- [ ] Implement Quality Scores progress bars
- [ ] Create Empty State with "Run QuickScan" action

### Phase 3: Tech Stack Chart (Enhancement)

- [ ] Create `components/rfp-overview/tech-stack-chart.tsx`
- [ ] Dynamic import with `ssr: false`
- [ ] Fixed-height container for CLS prevention

### Phase 4: Testing

- [ ] Chrome DevTools Screenshot verification
- [ ] Mobile responsive testing
- [ ] Error state testing

---

## Risk Analysis & Mitigation (UPDATED)

| Risk                        | Impact       | Mitigation                                     |
| --------------------------- | ------------ | ---------------------------------------------- |
| **IDOR Cross-BU Access**    | **CRITICAL** | Fix before shipping - add BU ownership checks  |
| QuickScan-Daten fehlend     | Medium       | Graceful Degradation mit Empty States          |
| Chart Rendering Performance | Low          | Dynamic import Recharts (-155KB)               |
| Layout Shift (CLS)          | Medium       | Fixed-height containers                        |
| JSON Parsing Errors         | Medium       | Use `safeJsonParseOrNull`                      |
| External Link Security      | Medium       | Validate URLs, use `rel="noopener noreferrer"` |

---

## Code Examples from ShadCN MCP

### Donut Chart Pattern (from registry)

```tsx
'use client';

import { Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartData = [
  { category: 'frontend', count: 5, fill: 'var(--color-frontend)' },
  { category: 'backend', count: 3, fill: 'var(--color-backend)' },
  { category: 'infrastructure', count: 2, fill: 'var(--color-infrastructure)' },
];

const chartConfig = {
  count: { label: 'Technologies' },
  frontend: { label: 'Frontend', color: 'var(--chart-1)' },
  backend: { label: 'Backend', color: 'var(--chart-2)' },
  infrastructure: { label: 'Infrastructure', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function TechStackDonut() {
  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie data={chartData} dataKey="count" nameKey="category" innerRadius={60} />
      </PieChart>
    </ChartContainer>
  );
}
```

---

## References

### Internal References

- Aktuelle Overview-Tab: `app/(dashboard)/bl-review/[id]/page.tsx:262-371`
- QuickScan Schema: `lib/quick-scan/schema.ts`
- DB Schema: `lib/db/schema.ts:405-458`
- Safe JSON Parse: `lib/utils/parse.ts`
- Existing BU Matching Tab: `components/bl-review/bu-matching-tab.tsx`

### External References

- [ShadCN Chart Component](https://ui.shadcn.com/docs/components/chart)
- [Next.js Server Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Recharts Documentation](https://recharts.org/en-US)

### Research References (from Deepening)

- Next.js Reviewer: Revalidation patterns, Suspense usage
- Performance Oracle: Bundle optimization, CLS prevention
- Security Sentinel: IDOR vulnerabilities, auth patterns
- Code Simplicity Reviewer: Component consolidation (11 → 3)
- Architecture Strategist: Pattern consistency with existing tabs
