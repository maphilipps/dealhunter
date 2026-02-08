# Implementation Plan: Dynamic Orchestrator with Analysis Plan

**GitHub Issue:** #164  
**Epic:** #162 (Pitch Scan v2 — PreQual-Style Chat UX Rewrite)  
**Dependency:** #163 (Model Fallback Chain) ✅ Completed

---

## Executive Summary

Transform the Pitch Scan orchestrator from a **fixed 13-phase pipeline** to a **dynamic capability-based system** where an LLM planner decides which phases to run based on context (Pre-Qualification results, website type, pitch requirements).

### Key Changes

| Current State                          | Target State                              |
| -------------------------------------- | ----------------------------------------- |
| 13 fixed phases always run             | Capability pool with optional phases      |
| Static `PitchScanSectionId` union type | Flexible `string` section IDs             |
| Hardcoded navigation config            | Navigation generated from executed phases |
| No planning phase                      | LLM-driven planning before execution      |

---

## Phase 1: Type System Refactoring

### 1.1 Generalize Section IDs

**File:** `lib/pitch-scan/section-ids.ts`

```typescript
// BEFORE: Fixed union type
export type PitchScanSectionId = (typeof PITCH_SCAN_SECTIONS)[keyof typeof PITCH_SCAN_SECTIONS];

// AFTER: Keep const for built-in phases, but allow any string
export const PITCH_SCAN_SECTIONS = { ... } as const;

// Built-in section IDs (for type safety in core phases)
export type BuiltInSectionId = (typeof PITCH_SCAN_SECTIONS)[keyof typeof PITCH_SCAN_SECTIONS];

// Dynamic section IDs can be any string (for custom/generated phases)
export type DynamicSectionId = string;

// Union for backward compatibility
export type PitchScanSectionId = BuiltInSectionId | DynamicSectionId;

// Type guard for built-in sections
export function isBuiltInSection(id: string): id is BuiltInSectionId {
  return Object.values(PITCH_SCAN_SECTIONS).includes(id as BuiltInSectionId);
}
```

### 1.2 Update PhaseResult Type

**File:** `lib/pitch-scan/types.ts`

```typescript
// BEFORE
export interface PhaseResult {
  sectionId: PitchScanSectionId;
  content: unknown;
  confidence: number;
  sources?: string[];
}

// AFTER: Add dynamic metadata
export interface PhaseResult {
  sectionId: string; // Now accepts any string
  label: string; // Human-readable title
  category?: PhaseCategory; // For UI grouping
  content: unknown;
  confidence: number;
  sources?: string[];
}

export type PhaseCategory =
  | 'discovery' // Initial analysis
  | 'technical' // Performance, accessibility, etc.
  | 'legal' // GDPR, compliance
  | 'cms' // CMS comparison/recommendation
  | 'architecture' // Drupal architecture
  | 'synthesis'; // Estimation, documentation
```

### 1.3 Update Checkpoint Type

**File:** `lib/pitch-scan/types.ts`

```typescript
// BEFORE
export interface PitchScanCheckpoint {
  completedPhases: PitchScanSectionId[];
  phaseResults: Record<string, unknown>;
}

// AFTER: Include planned phases
export interface PitchScanCheckpoint {
  plan: PhasePlan; // The analysis plan
  completedPhases: string[]; // Now accepts any string
  phaseResults: Record<string, unknown>;
  skippedPhases?: SkippedPhase[];
}

export interface SkippedPhase {
  id: string;
  reason: string;
}
```

**Acceptance Criteria:**

- [ ] Type guards work for built-in vs. dynamic sections
- [ ] Existing code using `PitchScanSectionId` still compiles
- [ ] New `PhaseResult` includes label and category

---

## Phase 2: Capability Pool Structure

### 2.1 Define Capability Interface

**File:** `lib/pitch-scan/capabilities.ts` (new file)

```typescript
import type { ModelSlot } from '@/lib/ai/model-config';
import type { PhaseCategory } from './types';

/**
 * A capability is an optional analysis phase that CAN be executed.
 * The planner decides which capabilities to activate based on context.
 */
export interface Capability {
  id: string;
  label: string;
  labelDe: string; // German label for UI
  category: PhaseCategory;
  description: string; // For planner context

  // Execution config
  modelSlot: ModelSlot;
  timeoutMs: number;
  maxRetries: number;

  // DAG dependencies (other capability IDs)
  dependencies: string[];

  // Conditions for when this capability is relevant
  relevance: {
    websiteTypes?: WebsiteType[]; // Only for these website types
    requiresWebsite?: boolean; // Needs a crawlable website
    procurementTypes?: ('public' | 'private' | 'semi-public')[];
    minConfidence?: number; // Min discovery confidence to run
  };

  // Agent function reference
  agentFn: string; // Module path or registry key
}

export type WebsiteType =
  | 'e-commerce'
  | 'portal'
  | 'corporate'
  | 'informational'
  | 'blog'
  | 'multi-site';
```

### 2.2 Convert Phases to Capabilities

**File:** `lib/pitch-scan/capabilities.ts`

```typescript
export const CAPABILITY_POOL: Capability[] = [
  {
    id: 'ps-discovery',
    label: 'Discovery & Tech Stack',
    labelDe: 'Discovery & Tech-Stack',
    category: 'discovery',
    description: 'Detects technologies, frameworks, CMS, hosting, and basic site structure',
    modelSlot: 'fast',
    timeoutMs: 60_000,
    maxRetries: 2,
    dependencies: [],
    relevance: {
      requiresWebsite: true,
    },
    agentFn: 'ps-discovery',
  },
  {
    id: 'ps-content-architecture',
    label: 'Content Architecture',
    labelDe: 'Content-Architektur',
    category: 'technical',
    description: 'Analyzes page types, content models, taxonomies, and information architecture',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: ['ps-discovery'],
    relevance: {
      requiresWebsite: true,
    },
    agentFn: 'ps-content-architecture',
  },
  {
    id: 'ps-accessibility',
    label: 'Accessibility Audit',
    labelDe: 'Barrierefreiheit',
    category: 'technical',
    description: 'WCAG compliance, ARIA usage, keyboard navigation, screen reader compatibility',
    modelSlot: 'fast',
    timeoutMs: 60_000,
    maxRetries: 2,
    dependencies: ['ps-discovery'],
    relevance: {
      requiresWebsite: true,
      procurementTypes: ['public', 'semi-public'], // Most relevant for public sector
    },
    agentFn: 'ps-accessibility',
  },
  {
    id: 'ps-legal',
    label: 'Legal & Compliance',
    labelDe: 'Rechtliches & Compliance',
    category: 'legal',
    description: 'GDPR, cookie consent, imprint, privacy policy, legal requirements',
    modelSlot: 'quality',
    timeoutMs: 120_000,
    maxRetries: 2,
    dependencies: ['ps-discovery', 'ps-features'],
    relevance: {
      requiresWebsite: true,
      procurementTypes: ['public', 'semi-public'],
    },
    agentFn: 'ps-legal',
  },
  // ... remaining capabilities
];

// Quick lookup map
export const CAPABILITY_MAP = new Map(CAPABILITY_POOL.map(cap => [cap.id, cap]));
```

### 2.3 Deprecate Old Constants

**File:** `lib/pitch-scan/constants.ts`

```typescript
/**
 * @deprecated Use CAPABILITY_POOL from capabilities.ts instead
 * Kept for backward compatibility during migration
 */
export const PHASE_DEFINITIONS = ...;

/**
 * @deprecated Use Capability.modelSlot/timeoutMs/maxRetries instead
 */
export const PHASE_AGENT_CONFIG = ...;
```

**Acceptance Criteria:**

- [ ] All 13 phases converted to Capability format
- [ ] Relevance conditions defined for each capability
- [ ] CAPABILITY_MAP provides O(1) lookup
- [ ] Old constants marked deprecated with migration path

---

## Phase 3: Planning LLM Call

### 3.1 Planning Context Schema

**File:** `lib/pitch-scan/planner/schema.ts` (new file)

```typescript
import { z } from 'zod';

/**
 * Input context for the planner LLM
 */
export const planningContextSchema = z.object({
  // From Pre-Qualification
  customerName: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  procurementType: z.enum(['public', 'private', 'semi-public']).optional(),

  // Website info
  websiteUrl: z.string().url().optional(),
  websiteType: z
    .enum(['e-commerce', 'portal', 'corporate', 'informational', 'blog', 'multi-site'])
    .optional(),

  // From discovery (if already run)
  detectedTechnologies: z.array(z.string()).optional(),
  detectedCms: z.string().optional(),

  // Project requirements
  projectGoal: z.string().optional(),
  targetCms: z.array(z.string()).optional(),
  mustHaveFeatures: z.array(z.string()).optional(),

  // Constraints
  timeConstraint: z.enum(['quick', 'standard', 'thorough']).optional(),
});

export type PlanningContext = z.infer<typeof planningContextSchema>;
```

### 3.2 Planning Response Schema

**File:** `lib/pitch-scan/planner/schema.ts`

```typescript
/**
 * LLM planner output
 */
export const phasePlanSchema = z.object({
  websiteType: z.enum(['e-commerce', 'portal', 'corporate', 'informational', 'blog', 'multi-site']),

  enabledPhases: z.array(
    z.object({
      id: z.string(),
      priority: z.enum(['required', 'recommended', 'optional']),
      rationale: z.string(), // Why this phase is relevant
    })
  ),

  skippedPhases: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
    })
  ),

  executionStrategy: z.object({
    parallelism: z.enum(['aggressive', 'balanced', 'sequential']),
    estimatedDurationMinutes: z.number(),
  }),

  customPhases: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        labelDe: z.string(),
        category: z.enum(['discovery', 'technical', 'legal', 'cms', 'architecture', 'synthesis']),
        description: z.string(),
        dependencies: z.array(z.string()),
        promptTemplate: z.string(), // Custom prompt for this phase
      })
    )
    .optional(),
});

export type PhasePlan = z.infer<typeof phasePlanSchema>;
```

### 3.3 Planner Agent

**File:** `lib/pitch-scan/planner/agent.ts` (new file)

```typescript
import { generateWithFallback } from '@/lib/ai/config';
import { CAPABILITY_POOL } from '../capabilities';
import { phasePlanSchema, type PlanningContext, type PhasePlan } from './schema';

const PLANNER_SYSTEM_PROMPT = `Du bist ein Experte für Website-Analyse und CMS-Migration.
Deine Aufgabe ist es, einen optimalen Analyse-Plan für einen Pitch Scan zu erstellen.

## Verfügbare Analyse-Phasen (Capability Pool)

${CAPABILITY_POOL.map(
  cap => `- **${cap.id}**: ${cap.description}
  - Kategorie: ${cap.category}
  - Abhängigkeiten: ${cap.dependencies.length ? cap.dependencies.join(', ') : 'keine'}
  - Relevanz: ${JSON.stringify(cap.relevance)}`
).join('\n\n')}

## Deine Aufgabe

1. Analysiere den Kontext (Kunde, Website-Typ, Anforderungen)
2. Wähle die relevanten Phasen aus dem Capability Pool
3. Überspringe Phasen, die nicht relevant sind (mit Begründung)
4. Ordne Phasen nach Priorität (required/recommended/optional)
5. Schlage ggf. Custom-Phasen vor für spezielle Anforderungen

## Regeln

- ps-discovery ist IMMER required (wenn Website vorhanden)
- ps-estimation und ps-documentation sind IMMER am Ende
- Bei public procurement: ps-accessibility ist required
- Bei E-Commerce: ps-features mit E-Commerce-Fokus
- Ohne Website-URL: Nur dokumentenbasierte Phasen`;

export async function createAnalysisPlan(context: PlanningContext): Promise<PhasePlan> {
  const userPrompt = `Erstelle einen Analyse-Plan für folgenden Kontext:

${JSON.stringify(context, null, 2)}

Gib einen strukturierten Plan zurück.`;

  const plan = await generateWithFallback({
    model: 'quality',
    schema: phasePlanSchema,
    system: PLANNER_SYSTEM_PROMPT,
    prompt: userPrompt,
    timeout: 30_000,
  });

  // Validate dependencies are satisfied
  return validatePlan(plan);
}

function validatePlan(plan: PhasePlan): PhasePlan {
  const enabledIds = new Set(plan.enabledPhases.map(p => p.id));

  // Check all dependencies are satisfied
  for (const phase of plan.enabledPhases) {
    const capability = CAPABILITY_POOL.find(c => c.id === phase.id);
    if (capability) {
      for (const dep of capability.dependencies) {
        if (!enabledIds.has(dep)) {
          // Auto-add missing dependency
          plan.enabledPhases.unshift({
            id: dep,
            priority: 'required',
            rationale: `Required dependency for ${phase.id}`,
          });
          enabledIds.add(dep);
        }
      }
    }
  }

  return plan;
}
```

**Acceptance Criteria:**

- [ ] Planner returns valid PhasePlan with Zod validation
- [ ] Dependencies are auto-resolved if missing
- [ ] Plan respects relevance conditions from capabilities
- [ ] Custom phases can be suggested for edge cases
- [ ] Timeout of 30s with fallback chain

---

## Phase 4: Dynamic Orchestrator

### 4.1 Refactor Orchestrator Interface

**File:** `lib/pitch-scan/orchestrator.ts`

```typescript
export interface DynamicOrchestratorOptions {
  runId: string;
  pitchId: string;
  websiteUrl?: string;
  targetCmsIds: string[];

  // Planning context
  planningContext: PlanningContext;

  // Optional: Skip planning and use provided plan
  providedPlan?: PhasePlan;

  // Resume from checkpoint
  checkpoint?: PitchScanCheckpoint;
}

export interface OrchestratorResult {
  plan: PhasePlan;
  results: Record<string, PhaseResult>;
  completedPhases: string[];
  failedPhases: string[];
  navigation: GeneratedNavigation;
}
```

### 4.2 Dynamic Phase Execution

**File:** `lib/pitch-scan/orchestrator.ts`

```typescript
import { createAnalysisPlan } from './planner/agent';
import { CAPABILITY_MAP, type Capability } from './capabilities';
import { PHASE_AGENT_REGISTRY } from './phases';

export async function runDynamicOrchestrator(
  options: DynamicOrchestratorOptions
): Promise<OrchestratorResult> {
  const { runId, pitchId, websiteUrl, targetCmsIds, planningContext, checkpoint } = options;

  // Step 1: Get or create plan
  const plan =
    checkpoint?.plan ?? options.providedPlan ?? (await createAnalysisPlan(planningContext));

  // Step 2: Build execution DAG from plan
  const enabledCapabilities = plan.enabledPhases
    .map(p => CAPABILITY_MAP.get(p.id))
    .filter((c): c is Capability => c !== undefined);

  // Include custom phases if any
  const customCapabilities = (plan.customPhases ?? []).map(cp => ({
    ...cp,
    modelSlot: 'quality' as const,
    timeoutMs: 120_000,
    maxRetries: 2,
    relevance: {},
    agentFn: 'custom',
  }));

  const allCapabilities = [...enabledCapabilities, ...customCapabilities];

  // Step 3: DAG execution (same algorithm, dynamic phases)
  const completedPhases = new Set<string>(checkpoint?.completedPhases ?? []);
  const failedPhases = new Set<string>();
  const phaseResults: Record<string, PhaseResult> = checkpoint?.phaseResults ?? {};

  while (completedPhases.size + failedPhases.size < allCapabilities.length) {
    // Find ready phases (dependencies met)
    const readyPhases = allCapabilities.filter(
      cap =>
        !completedPhases.has(cap.id) &&
        !failedPhases.has(cap.id) &&
        cap.dependencies.every(dep => completedPhases.has(dep))
    );

    if (readyPhases.length === 0) break;

    // Execute in parallel
    const results = await Promise.allSettled(
      readyPhases.map(cap =>
        executeCapability(cap, {
          runId,
          pitchId,
          websiteUrl: websiteUrl ?? '',
          previousResults: phaseResults,
          targetCmsIds,
        })
      )
    );

    // Process results
    for (let i = 0; i < results.length; i++) {
      const cap = readyPhases[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        completedPhases.add(cap.id);
        phaseResults[cap.id] = result.value;
        await storePhaseResult(runId, cap.id, result.value);
      } else {
        failedPhases.add(cap.id);
      }
    }

    // Save checkpoint
    await saveCheckpoint(runId, {
      plan,
      completedPhases: Array.from(completedPhases),
      phaseResults,
      skippedPhases: plan.skippedPhases,
    });
  }

  // Step 4: Generate navigation from results
  const navigation = generateNavigation(plan, phaseResults);

  return {
    plan,
    results: phaseResults,
    completedPhases: Array.from(completedPhases),
    failedPhases: Array.from(failedPhases),
    navigation,
  };
}

async function executeCapability(
  capability: Capability,
  context: PhaseContext
): Promise<PhaseResult> {
  // For built-in phases, use registry
  if (capability.agentFn !== 'custom') {
    const agentFn = PHASE_AGENT_REGISTRY[capability.id as keyof typeof PHASE_AGENT_REGISTRY];
    if (agentFn) {
      return agentFn(context, emit);
    }
  }

  // For custom phases, use generic agent with promptTemplate
  return runCustomPhaseAgent(capability, context);
}
```

### 4.3 Backward Compatibility Wrapper

**File:** `lib/pitch-scan/orchestrator.ts`

```typescript
/**
 * @deprecated Use runDynamicOrchestrator instead
 * Wrapper for backward compatibility with existing code
 */
export async function runPitchScanOrchestrator(
  options: PitchScanOrchestratorOptions
): Promise<void> {
  // Build planning context from legacy options
  const planningContext: PlanningContext = {
    websiteUrl: options.websiteUrl,
    targetCms: options.targetCmsIds,
    timeConstraint: 'standard',
  };

  // Force all 13 phases (legacy behavior)
  const providedPlan: PhasePlan = {
    websiteType: 'corporate',
    enabledPhases: CAPABILITY_POOL.map(cap => ({
      id: cap.id,
      priority: 'required' as const,
      rationale: 'Legacy mode - all phases enabled',
    })),
    skippedPhases: [],
    executionStrategy: {
      parallelism: 'balanced',
      estimatedDurationMinutes: 15,
    },
  };

  await runDynamicOrchestrator({
    ...options,
    planningContext,
    providedPlan,
  });
}
```

**Acceptance Criteria:**

- [ ] Dynamic orchestrator executes only planned phases
- [ ] DAG dependencies correctly resolved at runtime
- [ ] Custom phases can be executed with promptTemplate
- [ ] Legacy `runPitchScanOrchestrator` still works unchanged
- [ ] Checkpoint includes plan for resume support

---

## Phase 5: Dynamic Navigation Generation

### 5.1 Navigation Generator

**File:** `lib/pitch-scan/navigation.ts` (new file)

```typescript
import type { PhasePlan, PhaseResult } from './types';
import type { Capability } from './capabilities';
import { CAPABILITY_MAP } from './capabilities';

export interface GeneratedNavSection {
  id: string;
  label: string;
  route: string;
  category: string;
  hasContent: boolean;
  confidence?: number;
}

export interface GeneratedNavigation {
  sections: GeneratedNavSection[];
  categories: { id: string; label: string; count: number }[];
}

export function generateNavigation(
  plan: PhasePlan,
  results: Record<string, PhaseResult>
): GeneratedNavigation {
  const sections: GeneratedNavSection[] = [];
  const categoryCount = new Map<string, number>();

  // Add overview section first
  sections.push({
    id: 'ps-overview',
    label: 'Pitch Scan Übersicht',
    route: 'pitch-scan',
    category: 'overview',
    hasContent: true,
  });

  // Add completed phases
  for (const phase of plan.enabledPhases) {
    const capability = CAPABILITY_MAP.get(phase.id);
    const result = results[phase.id];

    if (capability && result) {
      sections.push({
        id: phase.id,
        label: capability.labelDe,
        route: `pitch-scan/${phase.id}`,
        category: capability.category,
        hasContent: true,
        confidence: result.confidence,
      });

      categoryCount.set(capability.category, (categoryCount.get(capability.category) ?? 0) + 1);
    }
  }

  // Add custom phases
  for (const custom of plan.customPhases ?? []) {
    const result = results[custom.id];
    if (result) {
      sections.push({
        id: custom.id,
        label: custom.labelDe,
        route: `pitch-scan/${custom.id}`,
        category: custom.category,
        hasContent: true,
        confidence: result.confidence,
      });

      categoryCount.set(custom.category, (categoryCount.get(custom.category) ?? 0) + 1);
    }
  }

  const categories = Array.from(categoryCount.entries())
    .map(([id, count]) => ({
      id,
      label: getCategoryLabel(id),
      count,
    }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id));

  return { sections, categories };
}

const CATEGORY_ORDER = ['discovery', 'technical', 'legal', 'cms', 'architecture', 'synthesis'];

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    discovery: 'Discovery',
    technical: 'Technische Analyse',
    legal: 'Rechtliches',
    cms: 'CMS-Analyse',
    architecture: 'Architektur',
    synthesis: 'Zusammenfassung',
  };
  return labels[category] ?? category;
}
```

### 5.2 Update Navigation Config

**File:** `lib/pitches/navigation-config.ts`

```typescript
import { generateNavigation, type GeneratedNavigation } from '@/lib/pitch-scan/navigation';

// Keep static config for non-pitch-scan sections
export const STATIC_NAVIGATION_SECTIONS = [
  // ... pre-qualification, documents, etc.
];

/**
 * Get navigation for a pitch, with dynamic pitch-scan sections
 */
export function getPitchNavigation(
  pitchId: string,
  pitchScanNavigation?: GeneratedNavigation
): LeadNavigationSection[] {
  const staticSections = [...STATIC_NAVIGATION_SECTIONS];

  if (pitchScanNavigation) {
    // Replace static pitch-scan section with dynamic one
    const pitchScanSection: LeadNavigationSection = {
      id: 'pitch-scan',
      label: 'Pitch Scan',
      icon: 'Radar',
      route: 'pitch-scan',
      subsections: pitchScanNavigation.sections.map(s => ({
        id: s.id,
        label: s.label,
        route: s.route,
        badge: s.confidence ? `${s.confidence}%` : undefined,
      })),
    };

    // Insert at correct position
    const insertIndex = staticSections.findIndex(s => s.id === 'pitch-scan');
    if (insertIndex >= 0) {
      staticSections[insertIndex] = pitchScanSection;
    } else {
      staticSections.push(pitchScanSection);
    }
  }

  return staticSections;
}
```

**Acceptance Criteria:**

- [ ] Navigation generated from executed phases only
- [ ] Categories group related phases
- [ ] Confidence scores shown as badges
- [ ] Skipped phases not in navigation
- [ ] Custom phases appear in correct category

---

## Phase 6: Database & API Updates

### 6.1 Store Plan in Run Record

**File:** `lib/db/schema.ts` (update)

```typescript
// The snapshotData JSONB column already stores checkpoint
// Update the type to include plan
export interface AuditScanRunSnapshot {
  plan?: PhasePlan;
  completedPhases: string[];
  phaseResults: Record<string, unknown>;
  skippedPhases?: SkippedPhase[];
  navigation?: GeneratedNavigation;
}
```

### 6.2 API Endpoint Updates

**File:** `app/api/pitch-scan/start/route.ts`

```typescript
// Add planning context to request body
const requestSchema = z.object({
  pitchId: z.string(),
  websiteUrl: z.string().url().optional(),
  targetCmsIds: z.array(z.string()),
  planningContext: planningContextSchema.optional(),
  skipPlanning: z.boolean().optional(), // Use all phases (legacy mode)
});
```

**File:** `app/api/pitch-scan/[runId]/navigation/route.ts` (new)

```typescript
// New endpoint to get dynamic navigation for a run
export async function GET(request: Request, { params }: { params: { runId: string } }) {
  const run = await getAuditScanRun(params.runId);
  const snapshot = run.snapshotData as AuditScanRunSnapshot;

  return NextResponse.json({
    navigation: snapshot.navigation,
    plan: snapshot.plan,
  });
}
```

**Acceptance Criteria:**

- [ ] Plan stored in snapshotData
- [ ] Navigation retrievable via API
- [ ] Legacy API still works without planningContext

---

## Phase 7: Testing Strategy

### 7.1 Unit Tests

**File:** `lib/pitch-scan/planner/__tests__/agent.test.ts`

```typescript
describe('createAnalysisPlan', () => {
  it('always includes ps-discovery for websites', async () => {
    const plan = await createAnalysisPlan({ websiteUrl: 'https://example.com' });
    expect(plan.enabledPhases.map(p => p.id)).toContain('ps-discovery');
  });

  it('includes ps-accessibility for public procurement', async () => {
    const plan = await createAnalysisPlan({
      websiteUrl: 'https://example.com',
      procurementType: 'public',
    });
    expect(plan.enabledPhases.map(p => p.id)).toContain('ps-accessibility');
  });

  it('skips website phases when no URL provided', async () => {
    const plan = await createAnalysisPlan({ procurementType: 'private' });
    expect(plan.skippedPhases.map(p => p.id)).toContain('ps-discovery');
  });

  it('auto-resolves missing dependencies', async () => {
    // Force a plan with ps-features but without ps-discovery
    const plan = validatePlan({
      enabledPhases: [{ id: 'ps-features', priority: 'required', rationale: '' }],
      // ...
    });
    expect(plan.enabledPhases.map(p => p.id)).toContain('ps-discovery');
  });
});
```

### 7.2 Integration Tests

**File:** `lib/pitch-scan/__tests__/orchestrator.integration.test.ts`

```typescript
describe('runDynamicOrchestrator', () => {
  it('executes only planned phases', async () => {
    const result = await runDynamicOrchestrator({
      runId: 'test-run',
      pitchId: 'test-pitch',
      websiteUrl: 'https://example.com',
      targetCmsIds: ['drupal'],
      planningContext: { timeConstraint: 'quick' },
      providedPlan: {
        enabledPhases: [
          { id: 'ps-discovery', priority: 'required', rationale: '' },
          { id: 'ps-estimation', priority: 'required', rationale: '' },
        ],
        skippedPhases: [],
        // ...
      },
    });

    expect(result.completedPhases).toHaveLength(2);
    expect(result.completedPhases).toContain('ps-discovery');
    expect(result.completedPhases).toContain('ps-estimation');
  });

  it('generates correct navigation', async () => {
    const result = await runDynamicOrchestrator({
      // ...
    });

    expect(result.navigation.sections).toHaveLength(3); // overview + 2 phases
    expect(result.navigation.categories).toContainEqual(
      expect.objectContaining({ id: 'discovery' })
    );
  });

  it('resumes from checkpoint', async () => {
    const result = await runDynamicOrchestrator({
      checkpoint: {
        plan: existingPlan,
        completedPhases: ['ps-discovery'],
        phaseResults: { 'ps-discovery': discoveryResult },
      },
      // ...
    });

    // Should not re-run discovery
    expect(mockDiscoveryAgent).not.toHaveBeenCalled();
  });
});
```

### 7.3 E2E Tests

**File:** `e2e/pitch-scan-dynamic.spec.ts`

```typescript
test('dynamic pitch scan with planning', async ({ page }) => {
  // Start a pitch scan with context
  await page.goto('/pitches/test-pitch/pitch-scan');

  // Verify planning phase runs first
  await expect(page.getByText('Erstelle Analyse-Plan...')).toBeVisible();

  // Verify dynamic navigation appears
  await expect(page.getByRole('navigation')).toContainText('Discovery');

  // Verify skipped phases show explanation
  await page.click('[data-testid="skipped-phases"]');
  await expect(page.getByText('Übersprungen:')).toBeVisible();
});
```

**Acceptance Criteria:**

- [ ] Unit tests for planner logic
- [ ] Integration tests for orchestrator
- [ ] E2E tests for full flow
- [ ] Tests for backward compatibility

---

## Migration Plan

### Step 1: Non-Breaking Additions (Week 1)

1. Add new files: `capabilities.ts`, `planner/`, `navigation.ts`
2. Add new types alongside existing ones
3. `runDynamicOrchestrator` as new function (not replacing old one)

### Step 2: Gradual Migration (Week 2)

1. Update one phase agent to use new capability structure
2. Add feature flag: `ENABLE_DYNAMIC_PITCH_SCAN`
3. Test with select users

### Step 3: Full Migration (Week 3)

1. Migrate all phase agents
2. Update UI to use dynamic navigation
3. Deprecate old constants

### Step 4: Cleanup (Week 4)

1. Remove deprecated code
2. Update documentation
3. Remove feature flag

---

## File Change Summary

| File                                             | Action  | Description                            |
| ------------------------------------------------ | ------- | -------------------------------------- |
| `lib/pitch-scan/section-ids.ts`                  | Modify  | Generalize types                       |
| `lib/pitch-scan/types.ts`                        | Modify  | Add label, category, update checkpoint |
| `lib/pitch-scan/capabilities.ts`                 | **New** | Capability pool structure              |
| `lib/pitch-scan/planner/schema.ts`               | **New** | Planning schemas                       |
| `lib/pitch-scan/planner/agent.ts`                | **New** | LLM planner                            |
| `lib/pitch-scan/navigation.ts`                   | **New** | Navigation generator                   |
| `lib/pitch-scan/orchestrator.ts`                 | Modify  | Add dynamic orchestrator               |
| `lib/pitch-scan/constants.ts`                    | Modify  | Deprecate, keep for compat             |
| `lib/pitches/navigation-config.ts`               | Modify  | Use dynamic navigation                 |
| `app/api/pitch-scan/start/route.ts`              | Modify  | Accept planning context                |
| `app/api/pitch-scan/[runId]/navigation/route.ts` | **New** | Dynamic nav endpoint                   |

---

## Definition of Done

- [ ] All 13 phases converted to Capability format
- [ ] Planner agent creates valid plans with Zod validation
- [ ] Dynamic orchestrator executes only planned phases
- [ ] Navigation generated from executed phases
- [ ] Backward compatibility maintained via wrapper
- [ ] Unit, integration, and E2E tests passing
- [ ] No breaking changes to existing API
- [ ] Feature flag for gradual rollout
