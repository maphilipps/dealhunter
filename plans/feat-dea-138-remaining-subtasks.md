# DEA-138 Remaining Subtasks: Lead Detail Page Completion

## Enhancement Summary

**Deepened on:** 2026-01-22
**Sections enhanced:** 3 (Legal, References, CMS)
**Research agents used:** security-sentinel, performance-oracle, kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer, pattern-recognition-specialist, data-integrity-guardian, nextjs-reviewer, best-practices-researcher, framework-docs-researcher

### Key Improvements from Research

1. **Security**: SSRF prevention für URL-Aufrufe, Rate Limiting, Input Validation
2. **Performance**: sqlite-vec für RAG Queries, Caching Layer, DB Indexes
3. **Data Integrity**: FK Enforcement aktivieren, Junction Table statt JSON Array
4. **Simplification**: Single-pass Legal Check, Flat Reference Scoring, 2-Factor CMS

### Critical Findings

- ⚠️ **FK Enforcement fehlt**: `pragma('foreign_keys = ON')` in `lib/db/index.ts` hinzufügen
- ⚠️ **Junction Table empfohlen**: `businessUnitCms` statt JSON Array für BU-CMS Relation

---

## Overview

Drei Subtasks aus DEA-138 sind noch im Backlog und müssen implementiert werden:

1. **DEA-149**: Legal Check Agent - Branchenspezifisch
2. **DEA-150**: References Agent - Empfehlung mit Begründung
3. **DEA-151**: CMS Selection - BU-spezifische Filterung

Alle anderen 13 Subtasks sind bereits als "Done" markiert.

---

## Phase 1: DEA-149 - Legal Check Agent

### Ziel

Agent für umfassende Legal-Prüfung inkl. branchenspezifischer Regularien.

### Dateien zu erstellen/ändern

#### 1.1 `lib/agents/legal-check-agent.ts` (NEU)

```typescript
interface LegalCheckResult {
  baseChecks: {
    dsgvo: { compliant: boolean; issues: string[]; recommendations: string[] };
    cookieBanner: { detected: boolean; compliant: boolean; issues: string[] };
    impressum: { found: boolean; valid: boolean; issues: string[] };
    agb: { found: boolean; riskScore: number; issues: string[] };
  };
  licenseChecks: {
    openSource: { detected: string[]; compliant: boolean; issues: string[] };
    softwareLicenses: { licenses: string[]; issues: string[] };
    imageRights: { stockPhotosDetected: boolean; issues: string[] };
  };
  industryChecks: {
    industry: string;
    regulations: string[];
    compliance: {
      regulation: string;
      status: 'compliant' | 'non-compliant' | 'unknown';
      issues: string[];
    }[];
  };
  riskScores: {
    overall: number;
    dsgvo: number;
    licenses: number;
    industry: number;
  };
  recommendations: string[];
  confidence: number;
  sources: string[];
}
```

**Funktionen:**

- `checkDSGVOCompliance(websiteUrl: string)` - DSGVO Prüfung
- `checkCookieBanner(websiteUrl: string)` - Cookie Consent Check
- `checkImpressum(websiteUrl: string)` - Impressum Validierung
- `checkAGBRisks(websiteUrl: string)` - AGB Analyse
- `checkOpenSourceLicenses(techStack: string[])` - OSS Compliance
- `checkIndustryRegulations(industry: string)` - Branchenspezifische Checks
- `calculateRiskScores(results)` - Risk Score Aggregation

**Branchenspezifische Checks:**

- **Finanz**: BaFin, MiFID II, PSD2
- **Gesundheit**: MDR, HIPAA-ähnlich, DiGA
- **E-Commerce**: Verbraucherrecht, Widerrufsrecht
- **Öffentlich**: Barrierefreiheit (BITV 2.0), WCAG

#### 1.2 `lib/agents/deep-scan-orchestrator.ts` (ÄNDERN)

Update des `legal` Agent-Stubs in AGENT_REGISTRY:

```typescript
legal: async (leadId, rfpId) => {
  const legalResult = await runLegalCheckAgent(leadId, rfpId);
  return {
    content: legalResult,
    confidence: legalResult.confidence,
    sources: legalResult.sources,
  };
},
```

### Research Insights (Phase 1)

**Security Best Practices:**

- SSRF-Schutz bei URL-Aufrufen: Whitelist erlaubter Domains
- Rate Limiting für externe API-Calls (max 10 req/min pro Lead)
- Input Validation: Alle URLs mit Zod URL-Schema validieren
- Keine sensiblen Daten in Error Messages loggen

**Performance Considerations:**

- Parallele Ausführung der Basis-Checks mit `Promise.allSettled`
- Caching: Legal-Ergebnisse in `leadSectionData` für 24h
- Timeout: Max 30s pro externem Check

**Simplified Implementation (MVP):**

```typescript
// Single-pass statt Multi-Function Approach
export async function runLegalCheckAgent(leadId: string): Promise<LegalCheckResult> {
  const lead = await getLeadWithWebsite(leadId);
  const websiteContent = await fetchWebsiteContent(lead.websiteUrl);

  // Alle Checks in einem generateObject Call
  return generateObject({
    model: openai('gpt-4o'),
    schema: LegalCheckResultSchema,
    prompt: buildLegalPrompt(websiteContent, lead.industry),
  });
}
```

**Zod Schema Pattern:**

```typescript
const LegalCheckResultSchema = z.object({
  baseChecks: z.object({
    dsgvo: z.object({
      compliant: z.boolean(),
      issues: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
    // ... weitere Checks
  }),
  riskScores: z.object({
    overall: z.number().min(0).max(100),
    dsgvo: z.number().min(0).max(100),
  }),
  confidence: z.number().min(0).max(100),
});
```

### Akzeptanzkriterien

- [ ] Alle Basis-Checks (DSGVO, Cookie, Impressum, AGB) funktionieren
- [ ] Branchenspezifische Checks aktivieren sich basierend auf Lead.industry
- [ ] Risk Scores werden berechnet (0-100)
- [ ] Empfehlungen sind actionable und konkret
- [ ] Tests vorhanden für Agent-Logik
- [ ] SSRF-Schutz implementiert
- [ ] URL Input Validation mit Zod

---

## Phase 2: DEA-150 - References Agent

### Ziel

Agent der passende Referenzprojekte empfiehlt mit detaillierter Begründung.

### Dateien zu erstellen/ändern

#### 2.1 `lib/agents/references-agent.ts` (NEU)

```typescript
interface ReferenceRecommendation {
  referenceId: string;
  projectName: string;
  customerName: string;
  score: number;
  reasoning: string;
  matchFactors: {
    industry: number; // 30%
    tech: number; // 25%
    budget: number; // 20%
    size: number; // 15%
    recency: number; // 10%
  };
  highlights: string[];
}

interface ReferencesAgentResult {
  recommendations: ReferenceRecommendation[];
  totalMatches: number;
  searchCriteria: {
    industry: string;
    technologies: string[];
    budgetRange: string;
    teamSize: number;
  };
  confidence: number;
  sources: string[];
}
```

**Funktionen:**

- `analyzeLeadAttributes(leadId: string)` - Extrahiert Branche, Tech, Budget, Scope
- `queryReferences(criteria)` - DB Query mit Filtern
- `queryRAGForSimilarity(leadDescription: string)` - Semantische Suche
- `calculateMatchScore(reference, criteria)` - Scoring mit Gewichtung
- `generateReasoning(reference, matchFactors)` - AI-generierte Begründung
- `rankAndSelectTop(matches, limit: 10)` - Finale Auswahl

**Ranking-Algorithmus:**

```
score = (industryMatch * 0.30) +
        (techStackMatch * 0.25) +
        (budgetRangeMatch * 0.20) +
        (projectSizeMatch * 0.15) +
        (recencyBonus * 0.10)
```

#### 2.2 `lib/agents/deep-scan-orchestrator.ts` (ÄNDERN)

Update des `references` Agent-Stubs:

```typescript
references: async (leadId, rfpId) => {
  const referencesResult = await runReferencesAgent(leadId, rfpId);
  return {
    content: referencesResult,
    confidence: referencesResult.confidence,
    sources: referencesResult.sources,
  };
},
```

#### 2.3 `app/(dashboard)/leads/[id]/references/page.tsx` (ERWEITERN)

Erweiterte UI für Referenz-Empfehlungen:

- Cards mit Score-Badge
- Match-Faktoren Visualisierung (Radar Chart oder Progress Bars)
- Reasoning-Anzeige
- Link zu Referenz-Details

### Research Insights (Phase 2)

**Performance Optimizations:**

- sqlite-vec für semantische Ähnlichkeitssuche nutzen (wenn verfügbar)
- Index auf `references.industry` und `references.technologies`
- Limit initial query auf 50 Kandidaten, dann re-rank

**Simplified Scoring (Flat statt Weighted):**

```typescript
// Vereinfachtes 2-Faktor Scoring für MVP
function calculateSimpleScore(ref: Reference, lead: Lead): number {
  const industryMatch = ref.industry === lead.industry ? 50 : 0;
  const techOverlap = calculateTechOverlap(ref.technologies, lead.requiredTech);
  return industryMatch + techOverlap * 50;
}
```

**AI-Generated Reasoning Pattern:**

```typescript
const reasoning = await generateText({
  model: openai('gpt-4o-mini'), // Kostengünstig für Begründungen
  prompt: `Erkläre in 2-3 Sätzen, warum "${ref.projectName}"
           gut zu diesem Lead passt: ${lead.description}`,
});
```

**UI Best Practices (Next.js Server Components):**

```typescript
// app/(dashboard)/leads/[id]/references/page.tsx
export default async function ReferencesPage({ params }) {
  return (
    <Suspense fallback={<ReferencesSkeleton />}>
      <ReferencesContent leadId={params.id} />
    </Suspense>
  );
}

async function ReferencesContent({ leadId }: { leadId: string }) {
  const result = await getReferencesForLead(leadId);
  return <ReferencesGrid recommendations={result.recommendations} />;
}
```

**Edge Cases:**

- Keine Referenzen vorhanden → Helpful Empty State mit CTA
- Alle Referenzen haben Score < 30 → Warning anzeigen
- Lead ohne Industry → Fallback auf Tech-Stack-Matching

### Akzeptanzkriterien

- [ ] Referenzen werden korrekt nach Relevanz gerankt
- [ ] Begründungen sind verständlich und spezifisch
- [ ] Match-Faktoren sind transparent angezeigt
- [ ] Mindestens 5 Referenzen werden empfohlen (wenn vorhanden)
- [ ] Leere Zustände bei fehlenden Referenzen
- [ ] Tests für Ranking-Algorithmus
- [ ] Server Component mit Suspense Boundary
- [ ] Skeleton Loading State

---

## Phase 3: DEA-151 - CMS Selection BU-Filter

### Ziel

CMS-Auswahl auf die für die Business Unit verfügbaren CMS beschränken.

### Dateien zu erstellen/ändern

#### 3.1 `lib/db/schema.ts` (ÄNDERN)

Erweiterung der `businessUnits` Tabelle:

```typescript
export const businessUnits = sqliteTable('business_units', {
  // ... existing fields ...

  // NEU: Available CMS for this BU
  availableCms: text('available_cms'), // JSON array of technology IDs
});
```

#### 3.2 Migration erstellen

```bash
npm run db:generate
npm run db:push
```

#### 3.3 `app/(dashboard)/admin/business-units/[id]/page.tsx` (ÄNDERN)

Admin UI für CMS-Konfiguration pro BU:

- Multi-Select für verfügbare CMS aus `technologies` Tabelle
- Speichern als JSON Array in `availableCms`
- Validation: Mindestens 1 CMS erforderlich

#### 3.4 `lib/agents/cms-comparison-agent.ts` (NEU oder ÄNDERN)

Wenn existiert: Anpassen. Sonst neu erstellen.

```typescript
interface CMSComparisonResult {
  availableCms: {
    id: string;
    name: string;
    score: number;
    pros: string[];
    cons: string[];
    fit: 'excellent' | 'good' | 'moderate' | 'poor';
  }[];
  recommendation: {
    cmsId: string;
    cmsName: string;
    reasoning: string;
    confidence: number;
  };
  unavailableCms: {
    name: string;
    reason: string; // "Nicht in Business Unit verfügbar"
  }[];
}
```

**Logik:**

1. Lead → Business Unit ermitteln
2. `businessUnits.availableCms` laden
3. Nur diese CMS vergleichen
4. Andere CMS mit Begründung "nicht verfügbar" markieren

#### 3.5 `app/(dashboard)/leads/[id]/cms-comparison/page.tsx` (ERWEITERN)

UI-Erweiterungen:

- Nur BU-verfügbare CMS in Cards/Dropdown
- Info-Banner: "CMS-Auswahl basiert auf Ihrer Business Unit"
- Collapsed Section: "Nicht verfügbare CMS" mit Begründung
- Finale Auswahl speichern auf Lead (`selectedCmsId`)

#### 3.6 `lib/db/schema.ts` - leads Tabelle (ÄNDERN)

```typescript
export const leads = sqliteTable('leads', {
  // ... existing fields ...

  // NEU: Selected CMS
  selectedCmsId: text('selected_cms_id').references(() => technologies.id),
});
```

### Research Insights (Phase 3)

**Data Integrity (CRITICAL):**

- ⚠️ **Junction Table statt JSON Array** für bessere Referential Integrity:

```typescript
// EMPFOHLEN: businessUnitCms Junction Table
export const businessUnitCms = sqliteTable('business_unit_cms', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  businessUnitId: text('business_unit_id')
    .notNull()
    .references(() => businessUnits.id, { onDelete: 'cascade' }),
  technologyId: text('technology_id')
    .notNull()
    .references(() => technologies.id, { onDelete: 'cascade' }),
});

// Index für schnelle Lookups
export const businessUnitCmsIndex = index('bu_cms_idx').on(businessUnitCms.businessUnitId);
```

- ⚠️ **FK Enforcement aktivieren** in `lib/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
const sqlite = new Database(process.env.DATABASE_URL);
sqlite.pragma('foreign_keys = ON'); // CRITICAL!
export const db = drizzle(sqlite);
```

**Simplified CMS Scoring (2-Factor MVP):**

```typescript
// Statt komplexem Multi-Faktor Scoring
function scoreCmsForLead(cms: CMS, lead: Lead): number {
  const techFit = calculateTechFit(cms, lead.requiredTech); // 0-50
  const budgetFit = calculateBudgetFit(cms, lead.budget); // 0-50
  return techFit + budgetFit;
}
```

**Architecture Pattern (Repository):**

```typescript
// lib/repositories/business-unit-repository.ts
export const businessUnitRepository = {
  async getAvailableCms(buId: string): Promise<Technology[]> {
    return db
      .select({ technology: technologies })
      .from(businessUnitCms)
      .innerJoin(technologies, eq(businessUnitCms.technologyId, technologies.id))
      .where(eq(businessUnitCms.businessUnitId, buId));
  },

  async setAvailableCms(buId: string, cmsIds: string[]): Promise<void> {
    await db.transaction(async tx => {
      await tx.delete(businessUnitCms).where(eq(businessUnitCms.businessUnitId, buId));
      if (cmsIds.length > 0) {
        await tx
          .insert(businessUnitCms)
          .values(cmsIds.map(id => ({ businessUnitId: buId, technologyId: id })));
      }
    });
  },
};
```

**UI Info Banner Pattern:**

```tsx
<Alert variant="info" className="mb-4">
  <Info className="h-4 w-4" />
  <AlertDescription>
    CMS-Auswahl basiert auf Ihrer Business Unit: {businessUnit.name}
  </AlertDescription>
</Alert>
```

### Akzeptanzkriterien

- [ ] `businessUnitCms` Junction Table existiert (statt JSON)
- [ ] FK Enforcement aktiviert in db/index.ts
- [ ] Admin kann CMS pro BU konfigurieren
- [ ] CMS Comparison Agent filtert nach BU
- [ ] UI zeigt nur verfügbare CMS
- [ ] Nicht-verfügbare CMS werden erklärt
- [ ] Finale CMS-Auswahl wird auf Lead gespeichert
- [ ] Tests für BU-Filter-Logik
- [ ] Repository Pattern für DB-Zugriffe

---

## Implementation Order

1. **Phase 1: DEA-149** - Legal Check Agent (unabhängig)
2. **Phase 2: DEA-150** - References Agent (unabhängig)
3. **Phase 3: DEA-151** - CMS Selection (benötigt Schema-Migration)

Phasen 1 und 2 können parallel implementiert werden.

---

## Technical Notes

### Bestehende Patterns nutzen

- `SectionPageTemplate` für konsistente Section-Pages
- `AGENT_REGISTRY` in `deep-scan-orchestrator.ts` für Agent-Integration
- `queryRagForLead()` für RAG-Abfragen
- `generateObject()` von AI SDK für strukturierte Outputs

### AI SDK v5 Best Practices

**generateObject für strukturierte Outputs:**

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateObject({
  model: openai('gpt-4o'),
  schema: ResultSchema, // Zod Schema
  prompt: buildPrompt(data),
  // Error handling via try/catch
});
```

**Retry Strategy:**

```typescript
import { retry } from '@lifeomic/attempt';

const result = await retry(() => generateObject({ model, schema, prompt }), {
  maxAttempts: 3,
  delay: 1000,
});
```

### Test-Strategie

- Unit Tests für Agent-Logik (Vitest)
- Integration Tests für DB-Queries
- E2E Tests mit agent-browser für UI
- **Minimum 80% Test Coverage**

### Performance

- Agents laufen parallel via `Promise.allSettled`
- Ergebnisse werden in `leadSectionData` gecached
- RAG Embeddings für spätere semantische Suche
- **Index-Strategie:**
  - `idx_references_industry` auf `references.industry`
  - `idx_leads_business_unit` auf `leads.businessUnitId`
  - `idx_bu_cms` auf `businessUnitCms.businessUnitId`

### Security Checklist

- [ ] SSRF-Schutz bei URL-Fetching (Domain Whitelist)
- [ ] Input Validation mit Zod für alle User-Inputs
- [ ] Rate Limiting für externe API Calls
- [ ] Keine sensiblen Daten in Logs
- [ ] FK Enforcement aktiviert

---

## References

- PRD: [DEA-138](https://linear.app/adessocms/issue/DEA-138)
- Legal Agent: [DEA-149](https://linear.app/adessocms/issue/DEA-149)
- References Agent: [DEA-150](https://linear.app/adessocms/issue/DEA-150)
- CMS Selection: [DEA-151](https://linear.app/adessocms/issue/DEA-151)
- Existing Orchestrator: `lib/agents/deep-scan-orchestrator.ts`
- Navigation Config: `lib/leads/navigation-config.ts`
