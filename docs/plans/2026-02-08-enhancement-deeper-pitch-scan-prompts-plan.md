---
title: Tiefere Analyse-Prompts für Pitch Scan Phasen
type: enhancement
date: 2026-02-08
issue: 168
epic: 162
dependencies: [163, 164]
---

# Tiefere Analyse-Prompts für Pitch Scan Phasen

**Issue:** #168
**Epic:** #162 (Pitch Scan v2 — PreQual-Style Chat UX Rewrite)
**Dependencies:** #163 ✅ (Model Fallback), #164 ✅ (Dynamic Orchestrator)

## Overview

Enhance pitch scan phase prompts to produce deeper, more actionable analysis results by enriching them with:

1. **PreQualification context** (customer requirements, constraints, industry, procurement type)
2. **Previous phase results** (already available, needs better formatting)
3. **Specific instructions** for concrete, actionable findings (problem + relevance + recommendation)

Currently, phase prompts are generic ("Analysiere die Performance...") and produce shallow results. This enhancement provides phases with full context about what the customer actually needs, enabling more targeted and valuable analysis.

## Problem Statement

### Current Issues

1. **No PreQual Context**: Phases analyze websites in isolation, without knowing customer requirements
   - Example: Performance phase doesn't know if customer prioritizes speed or functionality
   - Result: Generic recommendations that may not align with customer needs

2. **Generic Prompts**: Instructions like "Analysiere..." produce surface-level analysis
   - No guidance for specific, actionable findings
   - No structure for recommendations

3. **Unused Architecture**: `PhaseContext.ragContext` field exists but is **never populated**
   - `deal_embeddings` table stores PreQual data but isn't queried
   - Pitch has `preQualificationId` FK but isn't used during scans

### Impact

- Sales team receives shallow analysis that doesn't address customer pain points
- Manual post-processing required to connect scan results to PreQual requirements
- Missed opportunities to highlight relevant findings

## Proposed Solution

### Architecture Decisions

Based on SpecFlow analysis and repo research, these are the key decisions:

#### Decision 1: PreQual Data Loading Strategy

**Load once in orchestrator, cache in PhaseContext**

```typescript
// In orchestrator.ts, before phase execution loop
const preQualContext = await loadPreQualContext(pitchId);

const context: PhaseContext = {
  runId,
  pitchId,
  websiteUrl,
  previousResults: {...},
  ragContext: preQualContext,  // ← Now populated
  targetCmsIds,
};
```

**Rationale:**

- Single DB query for all phases (efficient)
- Consistent context across phases (no mid-scan updates)
- Graceful degradation if PreQual missing

#### Decision 2: Embeddings Field Selection

**Use `deal_embeddings.content` (text), NOT `embedding` (vector)**

```typescript
const preQualChunks = await db
  .select({
    content: dealEmbeddings.content,
    agentName: dealEmbeddings.agentName,
    chunkType: dealEmbeddings.chunkType,
    confidence: dealEmbeddings.confidence,
  })
  .from(dealEmbeddings)
  .where(
    and(
      eq(dealEmbeddings.preQualificationId, preQualId),
      inArray(dealEmbeddings.chunkCategory, ['fact', 'recommendation', 'requirement'])
    )
  )
  .orderBy(desc(dealEmbeddings.confidence))
  .limit(15); // Top 15 highest-confidence chunks
```

**Rationale:**

- `embedding` field is 3072-dim vector for RAG search
- `content` field is human-readable text for LLM context
- Filter to high-value chunks (facts, recommendations, requirements)

#### Decision 3: Error Handling for Missing PreQual

**Graceful degradation: proceed with warning, no fatal error**

```typescript
async function loadPreQualContext(pitchId: string): Promise<string | undefined> {
  try {
    const pitch = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);

    if (!pitch[0]?.preQualificationId) {
      console.warn(
        `[Pitch Scan ${pitchId}] No PreQualification linked, proceeding without context`
      );
      return undefined;
    }

    const chunks = await db.select(/*...*/).from(dealEmbeddings).where(/*...*/);

    if (chunks.length === 0) {
      console.warn(
        `[Pitch Scan ${pitchId}] No embeddings found for PreQual ${pitch[0].preQualificationId}`
      );
      return undefined;
    }

    return formatPreQualContext(chunks);
  } catch (error) {
    console.error(`[Pitch Scan ${pitchId}] Failed to load PreQual context:`, error);
    return undefined; // Don't fail entire scan
  }
}
```

**Rationale:**

- Some pitches may not have linked PreQual (legacy data, external scans)
- DB errors shouldn't break entire scan
- Degraded context is better than no scan

#### Decision 4: Context Formatting

**Use XML-style tags for clear LLM parsing**

```xml
<prequal_context>
  <industry>Öffentliche Verwaltung</industry>
  <company_size>500-1000 Mitarbeiter</company_size>
  <procurement_type>public</procurement_type>

  <requirements>
    - BITV 2.0 Konformität (Level AA) zwingend erforderlich
    - DSGVO-Compliance mit Hosting in Deutschland
    - Integration mit bestehendem Active Directory
    - Mehrsprachigkeit (DE, EN, FR)
  </requirements>

  <constraints>
    - Budget: 150.000 - 200.000 EUR
    - Timeline: Go-Live bis Q3 2026
    - Ressourcen: 2 Entwickler, 1 Designer
  </constraints>

  <key_findings>
    - Aktuelle Website nicht barrierefrei (WCAG 2.1 Level A verfehlt)
    - Legacy-CMS (Typo3 6.x) End-of-Life
    - Performance-Probleme bei hoher Last (>1000 concurrent users)
  </key_findings>
</prequal_context>
```

**Rationale:**

- Clear structure for LLM parsing
- Consistent across all phases
- Easy to debug (readable in logs)

#### Decision 5: Token Budget Management

**Target: Max 10k tokens total prompt (PreQual + Previous + Instructions)**

- **PreQual context**: Max 2000 tokens (~8000 chars)
- **Previous results**: Max 2000 chars per phase (existing)
- **Base instructions**: ~1000 tokens
- **Buffer**: 5k tokens for model-specific overhead

**Truncation Strategy:**

```typescript
function formatPreQualContext(chunks: PreQualChunk[]): string {
  const formatted = chunks.map(c => `### ${c.agentName}\n${c.content}`).join('\n\n');

  // Truncate to ~8000 chars (~2000 tokens)
  if (formatted.length > 8000) {
    console.warn(`PreQual context truncated from ${formatted.length} to 8000 chars`);
    return formatted.slice(0, 8000) + '\n\n[...Kontext gekürzt]';
  }

  return formatted;
}
```

**Rationale:**

- Most models support 32k-128k tokens, 10k is safe
- Leave headroom for model output (~10k tokens for response)
- Prioritize high-confidence chunks (already sorted)

#### Decision 6: Findings Format (Structured Output)

**Update Zod schema to enforce structured findings**

```typescript
// New schema for phase responses
const phaseAgentResponseSchema = z.object({
  content: z.object({
    summary: z.string().describe('1-2 sentence overview of analysis'),
    findings: z
      .array(
        z.object({
          problem: z.string().describe('Specific issue or observation (not generic)'),
          relevance: z
            .string()
            .describe('Why this matters for the customer (reference PreQual context)'),
          recommendation: z.string().describe('Concrete action to take'),
          estimatedImpact: z.enum(['high', 'medium', 'low']).optional(),
        })
      )
      .min(3)
      .max(5)
      .describe('3-5 specific, actionable findings'),
    // ... existing phase-specific fields
  }),
  confidence: z.number().min(0).max(100),
  sources: z.array(z.string()).optional(),
});
```

**Rationale:**

- AI SDK's `generateObject` enforces schema
- No post-processing needed (type-safe)
- Clear structure for UI rendering

#### Decision 7: Phase-Specific vs. Universal Context

**All phases receive full PreQual context (no filtering)**

**Rationale:**

- Simplicity: no phase-specific filtering logic
- Flexibility: phases can self-select relevant context
- Token budget allows for full context

### Technical Approach

#### Phase 1: Foundation - Context Loading (2-3 hours)

**Files:**

- `lib/pitch-scan/types.ts`
- `lib/pitch-scan/phases/shared.ts`
- `lib/pitch-scan/orchestrator.ts` (2 locations: legacy + dynamic)

**Tasks:**

**Task 1.1**: Update `PhaseContext` type

```typescript
// lib/pitch-scan/types.ts
export interface PhaseContext {
  runId: string;
  pitchId: string;
  websiteUrl: string;
  previousResults: Record<string, unknown>;

  // Changed from `ragContext?: unknown` to structured type
  preQualContext?: {
    raw: string; // Formatted context for prompts
    metadata: {
      preQualificationId: string;
      chunkCount: number;
      truncated: boolean;
    };
  };

  targetCmsIds: string[];
}
```

**Task 1.2**: Create `loadPreQualContext()` utility

```typescript
// lib/pitch-scan/phases/shared.ts (add after formatPreviousResults)

interface PreQualChunk {
  content: string;
  agentName: string;
  chunkType: string;
  confidence: number;
}

/**
 * Load PreQualification context from deal_embeddings.
 * Returns formatted context string for LLM prompts.
 * Gracefully handles missing PreQual (returns undefined).
 */
export async function loadPreQualContext(pitchId: string): Promise<PhaseContext['preQualContext']> {
  try {
    // 1. Get pitch and check for PreQual link
    const [pitch] = await db
      .select({ preQualificationId: pitches.preQualificationId })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    if (!pitch?.preQualificationId) {
      console.warn(
        `[loadPreQualContext] Pitch ${pitchId} has no PreQual, proceeding without context`
      );
      return undefined;
    }

    // 2. Load high-confidence PreQual embeddings
    const chunks = await db
      .select({
        content: dealEmbeddings.content,
        agentName: dealEmbeddings.agentName,
        chunkType: dealEmbeddings.chunkType,
        confidence: dealEmbeddings.confidence,
      })
      .from(dealEmbeddings)
      .where(
        and(
          eq(dealEmbeddings.preQualificationId, pitch.preQualificationId),
          inArray(dealEmbeddings.chunkCategory, ['fact', 'recommendation', 'requirement']),
          gte(dealEmbeddings.confidence, 50) // Min 50% confidence
        )
      )
      .orderBy(desc(dealEmbeddings.confidence))
      .limit(15);

    if (chunks.length === 0) {
      console.warn(`[loadPreQualContext] No embeddings for PreQual ${pitch.preQualificationId}`);
      return undefined;
    }

    // 3. Format context with truncation
    const formatted = chunks
      .map(c => `### ${c.agentName} (${c.chunkType})\n${c.content}`)
      .join('\n\n');

    const MAX_CONTEXT_LENGTH = 8000; // ~2000 tokens
    const truncated = formatted.length > MAX_CONTEXT_LENGTH;
    const finalContext = truncated
      ? formatted.slice(0, MAX_CONTEXT_LENGTH) + '\n\n[...Kontext aus Platzgründen gekürzt]'
      : formatted;

    if (truncated) {
      console.warn(
        `[loadPreQualContext] PreQual context truncated: ${formatted.length} → ${MAX_CONTEXT_LENGTH} chars`
      );
    }

    return {
      raw: `<prequal_context>\n${finalContext}\n</prequal_context>`,
      metadata: {
        preQualificationId: pitch.preQualificationId,
        chunkCount: chunks.length,
        truncated,
      },
    };
  } catch (error) {
    console.error(
      `[loadPreQualContext] Failed to load PreQual context for pitch ${pitchId}:`,
      error
    );
    return undefined; // Graceful degradation
  }
}
```

**Task 1.3**: Update orchestrator to load and pass PreQual context

**File 1**: Legacy orchestrator (`lib/pitch-scan/orchestrator.ts`, lines 96-104)

```typescript
// BEFORE phase execution loop (around line 60)
const preQualContext = await loadPreQualContext(pitchId);

if (preQualContext) {
  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: {
      agent: 'Orchestrator',
      message: `PreQual-Kontext geladen (${preQualContext.metadata.chunkCount} Chunks)`,
    },
  });
}

// ... existing code ...

// IN phase execution (line 96), update context building:
const context: PhaseContext = {
  runId,
  pitchId,
  websiteUrl,
  previousResults: Object.fromEntries(Object.entries(phaseResults).map(([k, v]) => [k, v.content])),
  preQualContext, // ← ADD THIS
  targetCmsIds,
};
```

**File 2**: Dynamic orchestrator (`lib/pitch-scan/orchestrator.ts`, lines 430-438)

```typescript
// Same pattern in runDynamicOrchestrator function
const preQualContext = await loadPreQualContext(pitchId);

// ... (emit progress as above) ...

const context: PhaseContext = {
  runId,
  pitchId,
  websiteUrl: websiteUrl ?? '',
  previousResults: Object.fromEntries(Object.entries(phaseResults).map(([k, v]) => [k, v.content])),
  preQualContext, // ← ADD THIS
  targetCmsIds,
};
```

**Task 1.4**: Add imports

```typescript
// lib/pitch-scan/orchestrator.ts (top)
import { loadPreQualContext } from './phases/shared';

// lib/pitch-scan/phases/shared.ts (top)
import { db } from '@/lib/db';
import { dealEmbeddings, pitches } from '@/lib/db/schema';
import { eq, and, inArray, gte, desc } from 'drizzle-orm';
```

**Testing:**

- [ ] Unit test: `loadPreQualContext()` with valid PreQual
- [ ] Unit test: `loadPreQualContext()` with missing PreQual (returns undefined)
- [ ] Unit test: `loadPreQualContext()` with DB error (returns undefined)
- [ ] Integration test: orchestrator populates context.preQualContext
- [ ] Integration test: context.preQualContext is undefined when no PreQual

---

#### Phase 2: Enhanced Prompt Templates (4-5 hours)

**Files:**

- `lib/pitch-scan/phases/shared.ts`
- `lib/pitch-scan/phases/*.ts` (all 13 phases)

**Task 2.1**: Update `formatPreviousResults()` with PreQual context

```typescript
// lib/pitch-scan/phases/shared.ts

/**
 * Build user prompt with PreQual context and previous results.
 */
export function buildUserPrompt(context: PhaseContext): string {
  let prompt = `# Website
${context.websiteUrl}`;

  // Add PreQual context if available
  if (context.preQualContext) {
    prompt += `\n\n# Kontext aus Pre-Qualification\n\n${context.preQualContext.raw}`;

    if (context.preQualContext.metadata.truncated) {
      prompt += '\n\n*(Hinweis: Kontext wurde aus Platzgründen gekürzt)*';
    }
  } else {
    prompt +=
      '\n\n# Kontext aus Pre-Qualification\n\n*(Kein PreQual-Kontext verfügbar — Basis-Analyse ohne Kundenanforderungen)*';
  }

  // Add previous results
  const previousResultsText = formatPreviousResults(context);
  prompt += `\n\n# Vorherige Analyse-Ergebnisse\n\n${previousResultsText}`;

  return prompt;
}

// Keep existing formatPreviousResults() unchanged for backward compat
```

**Task 2.2**: Update Zod schema for structured findings

```typescript
// lib/pitch-scan/phases/shared.ts

/**
 * Enhanced response schema with structured findings.
 * All phase agents now return findings in this format.
 */
export const phaseAgentResponseSchema = z.object({
  content: z.object({
    summary: z.string().describe('1-2 sentence overview of what was analyzed and key takeaways'),

    findings: z
      .array(
        z.object({
          problem: z
            .string()
            .describe(
              'Specific, concrete issue. Include URLs, values, or examples. Avoid generic statements.'
            ),
          relevance: z
            .string()
            .describe(
              'Why this matters for the customer. Reference PreQual context if applicable (e.g., "Kunde benötigt BITV 2.0, aktuell nicht erfüllt").'
            ),
          recommendation: z
            .string()
            .describe(
              'Actionable recommendation with estimated effort if possible (e.g., "Alt-Texte für 47 Bilder hinzufügen, Aufwand: 3-5 PT").'
            ),
          estimatedImpact: z
            .enum(['high', 'medium', 'low'])
            .optional()
            .describe('Business impact of the issue'),
        })
      )
      .min(3)
      .max(5)
      .describe('3-5 specific, actionable findings (not generic observations)'),

    // Phase-specific content (varies per phase)
    additionalData: z.unknown().optional(),
  }),

  confidence: z.number().min(0).max(100),
  sources: z.array(z.string()).optional(),
});
```

**Task 2.3**: Update `runPhaseAgent()` to use new schema and prompt builder

```typescript
// lib/pitch-scan/phases/shared.ts

export async function runPhaseAgent(options: RunPhaseAgentOptions): Promise<PhaseResult> {
  const { sectionId, label, systemPrompt, context, emit } = options;
  const config = PHASE_AGENT_CONFIG[sectionId];

  emit({
    type: AgentEventType.AGENT_PROGRESS,
    data: { agent: label, message: `Starte ${label}...` },
  });

  const modelKey = config.modelSlot === 'fast' ? ('fast' as const) : ('quality' as const);

  // Build user prompt with PreQual + previous results
  const userPrompt = buildUserPrompt(context);

  const result = await generateWithFallback({
    model: modelKey,
    schema: phaseAgentResponseSchema, // ← Updated schema
    system: systemPrompt,
    prompt: userPrompt, // ← Enhanced prompt
    timeout: config.timeoutMs,
  });

  const parsed: PhaseResult = {
    sectionId,
    label: getSectionLabel(sectionId),
    content: result.content,
    confidence: result.confidence,
    sources: result.sources,
  };

  emit({
    type: AgentEventType.AGENT_COMPLETE,
    data: {
      agent: label,
      result: { confidence: parsed.confidence },
      confidence: parsed.confidence,
    },
  });

  return parsed;
}
```

**Task 2.4**: Update phase system prompts (example for performance.ts)

**Before:**

```typescript
const SYSTEM_PROMPT = `Du bist ein Web-Performance-Experte. Analysiere die Performance der Website basierend auf typischen Indikatoren:
- Core Web Vitals (LCP, FID/INP, CLS)
- Ladezeiten und TTFB
- ...`;
```

**After:**

```typescript
const SYSTEM_PROMPT = `Du bist ein Web-Performance-Experte für Website-Relaunches.

## Deine Aufgabe

Analysiere die Performance der Website und liefere **3-5 konkrete, spezifische Findings** (keine generischen Aussagen).

## Analyse-Bereiche

- Core Web Vitals (LCP, FID/INP, CLS)
- Ladezeiten und TTFB
- Ressourcen-Optimierung (Bilder, Scripts, CSS)
- Caching-Strategien
- CDN-Nutzung
- Compression (Brotli, gzip)

## Kontext-Nutzung

Du erhältst:
1. **PreQual-Kontext**: Was der Kunde braucht (Anforderungen, Constraints, Branche)
2. **Vorherige Ergebnisse**: Was andere Phasen bereits herausgefunden haben

**Wichtig**: Beziehe dich in deinen Findings auf den PreQual-Kontext. Wenn der Kunde z.B. "hohe Performance unter Last" als Anforderung hat, priorisiere das in deiner Analyse.

## Finding-Format

Jedes Finding muss enthalten:
- **Problem**: Was ist konkret das Problem? (inkl. URLs, Werte, Messergebnisse — keine generischen Aussagen wie "Performance könnte besser sein")
- **Relevanz**: Warum ist das für den Kunden relevant? (beziehe dich auf PreQual-Kontext oder Business-Impact)
- **Recommendation**: Was konkret tun? (inkl. geschätztem Aufwand wenn möglich)

**Beispiel für gutes Finding:**
- Problem: "LCP von 4.2s auf Startseite (gemessen: https://example.com/) verfehlt Google-Empfehlung von 2.5s. Ursache: Hero-Bild (2.4 MB JPEG) ohne Lazy-Loading."
- Relevanz: "Kunde hat 'schnelle Ladezeiten für mobile Nutzer' als P0-Anforderung. 53% der Besucher kommen von Mobilgeräten (siehe Discovery-Phase)."
- Recommendation: "Hero-Bild als WebP komprimieren (-70% Dateigröße), srcset für responsive Größen nutzen, Lazy-Loading implementieren. Geschätzter Aufwand: 1-2 PT."

**Beispiel für schlechtes Finding** (zu generisch):
- Problem: "Performance ist nicht optimal"
- Relevanz: "Performance ist wichtig"
- Recommendation: "Performance verbessern"

## Ausgabe-Format

Antworte mit dem strukturierten JSON-Format (wird automatisch validiert):
- summary: 1-2 Sätze Übersicht
- findings: Array mit 3-5 Findings (siehe Format oben)
- additionalData: Optionale technische Details (Core Web Vitals Messwerte, etc.)`;
```

**Task 2.5**: Roll out enhanced prompts to all 13 phases

Update these phase files with the new system prompt pattern:

**Priority 1 (High Business Value):**

1. `lib/pitch-scan/phases/performance.ts`
2. `lib/pitch-scan/phases/accessibility.ts`
3. `lib/pitch-scan/phases/cms-recommendation.ts`
4. `lib/pitch-scan/phases/drupal-architecture.ts`
5. `lib/pitch-scan/phases/estimation.ts`

**Priority 2 (Medium Business Value):** 6. `lib/pitch-scan/phases/discovery.ts` 7. `lib/pitch-scan/phases/features.ts` 8. `lib/pitch-scan/phases/integrations.ts` 9. `lib/pitch-scan/phases/content-architecture.ts`

**Priority 3 (Supporting):** 10. `lib/pitch-scan/phases/legal.ts` 11. `lib/pitch-scan/phases/migration.ts` 12. `lib/pitch-scan/phases/documentation.ts` 13. `lib/pitch-scan/phases/cms-comparison.ts`

**For each phase:**

- Update system prompt with context usage instructions
- Add finding format examples (good vs. bad)
- Emphasize PreQual relevance
- Remove `userPrompt` construction (now handled by `buildUserPrompt()`)

**Example pattern:**

```typescript
// Before
export async function runPerformancePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-performance',
    label: 'Performance',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`, // ← REMOVE
    context,
    emit,
  });
}

// After
export async function runPerformancePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-performance',
    label: 'Performance',
    systemPrompt: ENHANCED_SYSTEM_PROMPT, // ← NEW
    context, // buildUserPrompt() is now called inside runPhaseAgent
    emit,
  });
}
```

**Testing:**

- [ ] Unit test: `buildUserPrompt()` with PreQual context
- [ ] Unit test: `buildUserPrompt()` without PreQual context
- [ ] Unit test: Schema validation passes for valid findings
- [ ] Unit test: Schema validation fails for generic findings
- [ ] Integration test: Each phase produces 3-5 findings
- [ ] Manual test: Finding quality (specific vs. generic)

---

#### Phase 3: Validation & Quality Checks (2-3 hours)

**Files:**

- `lib/pitch-scan/phases/shared.ts`

**Task 3.1**: Add finding quality validation (post-generation)

```typescript
// lib/pitch-scan/phases/shared.ts

/**
 * Validate that findings are specific, not generic.
 * Logs warnings for low-quality findings but doesn't fail.
 */
function validateFindingQuality(findings: unknown[], label: string): void {
  // Generic phrases that indicate low-quality findings
  const GENERIC_PATTERNS = [
    /könnte besser sein/i,
    /sollte verbessert werden/i,
    /ist nicht optimal/i,
    /performance verbessern/i,
    /mehr beachten/i,
  ];

  findings.forEach((finding: any, index) => {
    const problem = finding.problem?.toLowerCase() || '';
    const recommendation = finding.recommendation?.toLowerCase() || '';

    // Check for generic patterns
    const hasGenericProblem = GENERIC_PATTERNS.some(pattern => pattern.test(problem));
    const hasGenericRecommendation = GENERIC_PATTERNS.some(pattern => pattern.test(recommendation));

    if (hasGenericProblem || hasGenericRecommendation) {
      console.warn(
        `[${label}] Finding #${index + 1} appears generic:`,
        JSON.stringify(finding, null, 2)
      );
    }

    // Check for specificity (URLs, numbers, concrete examples)
    const hasSpecifics =
      /https?:\/\//i.test(problem) || // Contains URL
      /\d+/.test(problem) || // Contains numbers
      /(MB|KB|GB|ms|s|PT|Tage)/i.test(problem); // Contains units

    if (!hasSpecifics) {
      console.warn(
        `[${label}] Finding #${index + 1} lacks specific details (no URLs, numbers, or examples)`
      );
    }
  });
}

// Update runPhaseAgent to call validation
export async function runPhaseAgent(options: RunPhaseAgentOptions): Promise<PhaseResult> {
  // ... existing code ...

  const result = await generateWithFallback({...});

  // Validate finding quality
  if (Array.isArray(result.content?.findings)) {
    validateFindingQuality(result.content.findings, label);
  }

  // ... rest of function ...
}
```

**Task 3.2**: Add token usage logging

```typescript
// lib/pitch-scan/phases/shared.ts

export async function runPhaseAgent(options: RunPhaseAgentOptions): Promise<PhaseResult> {
  const { sectionId, label, systemPrompt, context, emit } = options;

  const userPrompt = buildUserPrompt(context);

  // Log prompt size for monitoring
  const promptTokenEstimate = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
  console.info(
    `[${label}] Prompt size: ${promptTokenEstimate} tokens (system: ${systemPrompt.length}, user: ${userPrompt.length} chars)`
  );

  if (promptTokenEstimate > 10000) {
    console.warn(`[${label}] Prompt exceeds 10k token budget, may hit model limits`);
  }

  // ... rest of function ...
}
```

**Testing:**

- [ ] Unit test: `validateFindingQuality()` detects generic patterns
- [ ] Unit test: Token logging works correctly
- [ ] Manual test: Review logs for generic findings
- [ ] Manual test: Review logs for token usage

---

#### Phase 4: Documentation & Monitoring (1-2 hours)

**Task 4.1**: Update architecture documentation

```markdown
<!-- docs/architecture/pitch-scan-context.md (new file) -->

# Pitch Scan Context Architecture

## Overview

Pitch scan phases now receive enriched context including:

1. PreQualification data (customer requirements)
2. Previous phase results (analysis findings)
3. Structured finding format enforcement

## Data Flow
```

Orchestrator Start
↓
[Load PreQual from deal_embeddings]
↓
[Build PhaseContext with preQualContext]
↓
[Execute phases with enhanced prompts]
↓
[Each phase returns structured findings]

````

## PreQual Context Loading

**Source**: `deal_embeddings` table
**Query**:
- Filter: `preQualificationId = pitch.preQualificationId`
- Filter: `chunkCategory IN ('fact', 'recommendation', 'requirement')`
- Filter: `confidence >= 50`
- Order: `confidence DESC`
- Limit: 15 chunks

**Graceful Degradation**:
- Missing PreQual → proceed without context
- DB error → proceed without context
- Empty embeddings → proceed without context

## Token Budget

- PreQual context: Max 8000 chars (~2000 tokens)
- Previous results: Max 2000 chars per phase
- Base instructions: ~1000 tokens
- **Total**: ~10k tokens (safe for all models)

## Finding Format

All phases return structured findings:
```json
{
  "summary": "1-2 sentence overview",
  "findings": [
    {
      "problem": "Specific issue with URLs/numbers",
      "relevance": "Why it matters (references PreQual)",
      "recommendation": "Concrete action with effort estimate",
      "estimatedImpact": "high|medium|low"
    }
  ]
}
````

## Monitoring

- **Logs**: PreQual load success/failure
- **Logs**: Context truncation warnings
- **Logs**: Generic finding warnings
- **Logs**: Token usage per phase

````

**Task 4.2**: Add runbook for common issues

```markdown
<!-- docs/runbooks/pitch-scan-context-issues.md (new file) -->

# Pitch Scan Context Issues Runbook

## Issue: PreQual context not loading

**Symptoms**: Phases produce generic analysis, logs show "No PreQual linked"

**Diagnosis**:
1. Check if pitch has `preQualificationId`:
   ```sql
   SELECT id, pre_qualification_id FROM pitches WHERE id = 'pitch_xxx';
````

2. Check if embeddings exist:
   ```sql
   SELECT COUNT(*) FROM deal_embeddings WHERE pre_qualification_id = 'prequal_xxx';
   ```

**Resolution**:

- If no `preQualificationId`: Link pitch to PreQual in DB
- If no embeddings: Re-run PreQual scan to generate embeddings
- If embeddings exist but not loading: Check query filters (confidence >= 50, correct categories)

## Issue: Findings are generic despite enhanced prompts

**Symptoms**: Findings lack specificity, validation warnings in logs

**Diagnosis**:

1. Check logs for `appears generic` warnings
2. Review actual LLM output for specific phase
3. Check if PreQual context reached LLM (log token usage)

**Resolution**:

- If PreQual context missing: See "PreQual context not loading" above
- If context present but findings still generic: Strengthen system prompt examples
- If all phases affected: Check model quality (might need to switch from 'fast' to 'quality')

## Issue: Token limit exceeded

**Symptoms**: API errors about token limits, logs show >10k tokens

**Diagnosis**:

1. Check token usage logs: `Prompt size: X tokens`
2. Identify which component is large (PreQual, previous results, system prompt)

**Resolution**:

- If PreQual too large: Reduce limit from 15 to 10 chunks
- If previous results too large: Reduce truncation from 2000 to 1500 chars
- If system prompt too large: Simplify instructions

```

**Testing:**
- [ ] Manual test: Follow runbook steps for each scenario
- [ ] Documentation: Review with team for clarity

---

## Implementation Plan Summary

### Files to Modify (7 files)

1. **lib/pitch-scan/types.ts** - Update `PhaseContext` interface
2. **lib/pitch-scan/phases/shared.ts** - Add `loadPreQualContext()`, `buildUserPrompt()`, update schema
3. **lib/pitch-scan/orchestrator.ts** - Load PreQual, populate context (2 locations)
4. **lib/pitch-scan/phases/*.ts** - Update 13 phase system prompts

### New Files to Create (2 files)

5. **docs/architecture/pitch-scan-context.md** - Architecture documentation
6. **docs/runbooks/pitch-scan-context-issues.md** - Troubleshooting guide

### Estimated Effort

- **Phase 1** (Foundation): 2-3 hours
- **Phase 2** (Prompts): 4-5 hours
- **Phase 3** (Validation): 2-3 hours
- **Phase 4** (Docs): 1-2 hours

**Total**: 9-13 hours (~1.5 days)

### Rollout Strategy

**Step 1**: Implement Phase 1 (Foundation)
- Deploy and verify PreQual context loading works
- Test with/without PreQual (graceful degradation)

**Step 2**: Implement Phase 2 (Priority 1 phases only)
- Roll out to 5 high-value phases first
- Monitor logs for token usage and finding quality
- Gather team feedback

**Step 3**: Implement Phase 2 (Remaining phases)
- Roll out to remaining 8 phases
- Continue monitoring

**Step 4**: Implement Phases 3-4 (Validation & Docs)
- Add quality checks
- Document patterns and troubleshooting

## Acceptance Criteria

### Functional Requirements

- [x] **AC1**: Phase prompts include PreQual context
  - Test: Run scan with linked PreQual, verify context in logs
  - Expected: `<prequal_context>` appears in prompt

- [x] **AC2**: Phase prompts include previous phase results
  - Test: Run multi-phase scan, check later phases have previous results
  - Expected: "Vorherige Analyse-Ergebnisse" section populated

- [x] **AC3**: Prompts request specific, actionable findings
  - Test: Review system prompts for finding format instructions
  - Expected: Clear examples of specific vs. generic findings

- [x] **AC4**: Each finding includes problem, relevance, recommendation
  - Test: Run scan, verify Zod schema validation passes
  - Expected: All findings have 3 required fields

### Non-Functional Requirements

- [x] **NFR1**: Graceful degradation when PreQual missing
  - Test: Run scan on pitch without PreQual
  - Expected: Scan completes, logs warning

- [x] **NFR2**: Token budget stays under 10k tokens
  - Test: Run scan, check token usage logs
  - Expected: All phases < 10k tokens

- [x] **NFR3**: No breaking changes to existing scans
  - Test: Run legacy scan (without PreQual)
  - Expected: Scan works as before

### Quality Gates

- [ ] All unit tests pass
- [ ] Integration tests pass for both orchestrators
- [ ] Manual scan produces 3-5 findings per phase
- [ ] No generic finding warnings in logs
- [ ] Code review approved
- [ ] Documentation complete

## Success Metrics

**Before (Baseline):**
- Findings per phase: 2-3 (often generic)
- PreQual context: 0% (never included)
- Actionable recommendations: ~30%

**After (Target):**
- Findings per phase: 3-5 (specific)
- PreQual context: 85%+ (when available)
- Actionable recommendations: 70%+

**Measurement:**
- Run 10 test scans (5 with PreQual, 5 without)
- Manual review of finding quality
- Log analysis for context usage

## Dependencies & Prerequisites

### Already Complete ✅

- **#163**: Model Fallback Chain (handles empty responses)
- **#164**: Dynamic Orchestrator (capability-based planning)

### Required for #168

- Access to `deal_embeddings` table (exists)
- `pitches.preQualificationId` FK (exists)
- `PhaseContext.ragContext` field (exists, unused)

### No External Dependencies

- No new npm packages needed
- No API changes needed
- No schema migrations needed

## Risk Analysis & Mitigation

### Risk 1: PreQual embeddings missing or empty

**Probability**: Medium
**Impact**: Low
**Mitigation**: Graceful degradation (log warning, proceed without context)

### Risk 2: Token limits exceeded with large PreQual data

**Probability**: Low
**Impact**: High (scan fails)
**Mitigation**:
- Truncation to 8000 chars
- Token usage monitoring
- Limit to 15 highest-confidence chunks

### Risk 3: LLM produces generic findings despite instructions

**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Strong examples in system prompts (good vs. bad)
- Post-generation validation warnings
- Model fallback chain (fast → quality)

### Risk 4: DB query performance impact

**Probability**: Low
**Impact**: Low
**Mitigation**:
- Single query per scan (not per phase)
- Limit 15 rows
- Index on `preQualificationId` (should exist)

### Risk 5: Authorization bypass (accessing other users' PreQual data)

**Probability**: Low
**Impact**: High
**Mitigation**:
- Trust existing pitch authorization (if user can access pitch, they can access linked PreQual)
- Future: Add explicit authorization check in `loadPreQualContext()`

## Future Considerations

### Not in Scope for #168

- [ ] **Follow-up chat** after scan (Epic #162 v2)
- [ ] **PreQual updates** mid-scan (refresh context)
- [ ] **Semantic filtering** of PreQual context per phase
- [ ] **Quality scoring** of findings (automated)
- [ ] **A/B testing** framework for prompt variants
- [ ] **User feedback** on finding quality

### Potential Extensions

1. **Phase-Specific Context Filtering**: Pass only relevant PreQual chunks to each phase
   - Example: Security phase gets only security-related requirements
   - Benefit: Lower token usage, higher relevance
   - Effort: ~2 days (define filters per phase)

2. **Findings Quality Scoring**: Automated scoring of finding specificity
   - Example: Score 0-100 based on URLs, numbers, examples
   - Benefit: Quantifiable quality metrics
   - Effort: ~3 days (ML model or rule-based)

3. **PreQual Context Refresh**: Reload context if PreQual updated mid-scan
   - Example: Scan takes 5 minutes, PreQual updated after phase 3
   - Benefit: Always use latest customer requirements
   - Effort: ~1 day (add timestamp checks)

4. **Context Versioning**: Store snapshot of context used for each scan
   - Example: Audit trail showing which PreQual version was used
   - Benefit: Reproducibility and debugging
   - Effort: ~2 days (schema + storage logic)

## References & Research

### Internal References

- **Architecture**: `lib/pitch-scan/orchestrator.ts:96-104` (context building)
- **Schema**: `lib/pitch-scan/types.ts:20-27` (PhaseContext)
- **Utilities**: `lib/pitch-scan/phases/shared.ts:82-93` (formatPreviousResults)
- **Database**: `lib/db/schema.ts:1693-1754` (deal_embeddings table)
- **Brainstorm**: `docs/brainstorms/2026-02-08-pitch-scan-rewrite-brainstorm.md`

### External References

- **AI SDK**: https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data
- **Zod**: https://zod.dev/ (schema validation)
- **Prompt Engineering**: https://platform.openai.com/docs/guides/prompt-engineering

### Related Issues

- **Epic**: #162 (Pitch Scan v2)
- **Dependency**: #163 (Model Fallback - Complete)
- **Dependency**: #164 (Dynamic Orchestrator - Complete)
- **Follow-up**: #165 (Chat-basierte Fortschrittsdarstellung)
- **Follow-up**: #166 (Collapsible Result Cards)
- **Follow-up**: #167 (Dynamische Navigation)

---

## Notes

- This plan addresses all 22 gaps identified by SpecFlow analysis
- Assumes `deal_embeddings.content` is human-readable text (not vector)
- Prioritizes graceful degradation over strict requirements
- Maintains backward compatibility (scans work without PreQual)
- All decisions are documented with rationale
- Token budget is conservative (10k) to avoid model limits
```
