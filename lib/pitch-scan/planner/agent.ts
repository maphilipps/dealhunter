import { generateWithFallback } from '@/lib/ai/config';

import { CAPABILITY_POOL, CAPABILITY_MAP } from '../capabilities';
import { phasePlanSchema, type PlanningContext, type PhasePlan } from './schema';

// ─── System Prompt ─────────────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `Du bist ein Experte für Website-Analyse und CMS-Migration.
Deine Aufgabe ist es, einen optimalen Analyse-Plan für einen Pitch Scan zu erstellen.

## Verfügbare Analyse-Phasen (Capability Pool)

${CAPABILITY_POOL.map(
  cap => `### ${cap.id}
- **Label:** ${cap.labelDe}
- **Kategorie:** ${cap.category}
- **Beschreibung:** ${cap.description}
- **Abhängigkeiten:** ${cap.dependencies.length ? cap.dependencies.join(', ') : 'keine'}
- **Relevanz:** ${JSON.stringify(cap.relevance)}`
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
- Bei E-Commerce: Fokus auf ps-features und ps-integrations
- Ohne Website-URL: Nur dokumentenbasierte Phasen

## Zeitliche Einschränkungen

- quick: Nur Discovery, Estimation, Documentation (5 Minuten)
- standard: Alle relevanten Phasen (15 Minuten)
- thorough: Alle Phasen inkl. optional (25 Minuten)

## Output Format

Gib einen strukturierten JSON-Plan zurück mit:
- websiteType: Der erkannte Website-Typ
- enabledPhases: Liste der aktivierten Phasen mit Priorität und Begründung
- skippedPhases: Liste der übersprungenen Phasen mit Grund
- executionStrategy: Parallelisierung und geschätzte Dauer
- customPhases: Optional, nur bei speziellen Anforderungen`;

// ─── Planner Agent ─────────────────────────────────────────────────────────────

/**
 * Creates an analysis plan based on the given context.
 * Uses an LLM to intelligently select which phases to run.
 */
export async function createAnalysisPlan(context: PlanningContext): Promise<PhasePlan> {
  const userPrompt = `Erstelle einen Analyse-Plan für folgenden Kontext:

${JSON.stringify(context, null, 2)}

Berücksichtige dabei:
- Zeitliche Einschränkung: ${context.timeConstraint ?? 'standard'}
- Website vorhanden: ${context.websiteUrl ? 'Ja' : 'Nein'}
- Procurement-Typ: ${context.procurementType ?? 'unbekannt'}
- Branche: ${context.industry ?? 'unbekannt'}

Gib einen strukturierten Plan zurück.`;

  const plan = await generateWithFallback({
    model: 'quality',
    schema: phasePlanSchema,
    system: PLANNER_SYSTEM_PROMPT,
    prompt: userPrompt,
    timeout: 30_000,
  });

  // Validate and fix dependencies
  return validatePlan(plan);
}

// ─── Plan Validation ───────────────────────────────────────────────────────────

/**
 * Validates the plan and auto-resolves missing dependencies.
 */
export function validatePlan(plan: PhasePlan): PhasePlan {
  const enabledIds = new Set(plan.enabledPhases.map(p => p.id));
  const updatedEnabledPhases = [...plan.enabledPhases];

  // Check all dependencies are satisfied
  for (const phase of plan.enabledPhases) {
    const capability = CAPABILITY_MAP.get(phase.id);
    if (capability) {
      for (const dep of capability.dependencies) {
        if (!enabledIds.has(dep)) {
          // Auto-add missing dependency at the beginning
          updatedEnabledPhases.unshift({
            id: dep,
            priority: 'required',
            rationale: `Required dependency for ${phase.id}`,
          });
          enabledIds.add(dep);
        }
      }
    }
  }

  // Ensure ps-discovery is first if website is present
  const discoveryIndex = updatedEnabledPhases.findIndex(p => p.id === 'ps-discovery');
  if (discoveryIndex > 0) {
    const [discovery] = updatedEnabledPhases.splice(discoveryIndex, 1);
    updatedEnabledPhases.unshift(discovery);
  }

  // Ensure synthesis phases are last
  const synthesisPhases = ['ps-estimation', 'ps-documentation'];
  for (const synthId of synthesisPhases) {
    const index = updatedEnabledPhases.findIndex(p => p.id === synthId);
    if (index >= 0 && index < updatedEnabledPhases.length - 2) {
      const [synth] = updatedEnabledPhases.splice(index, 1);
      updatedEnabledPhases.push(synth);
    }
  }

  return {
    ...plan,
    enabledPhases: updatedEnabledPhases,
  };
}

// ─── Quick Plan Helpers ────────────────────────────────────────────────────────

/**
 * Creates a quick plan without LLM call.
 * Used for time-constrained or fallback scenarios.
 */
export function createQuickPlanFromContext(context: PlanningContext): PhasePlan {
  const hasWebsite = Boolean(context.websiteUrl);
  const isPublic = context.procurementType === 'public';

  const enabledPhases = [];
  const skippedPhases = [];

  if (hasWebsite) {
    enabledPhases.push({
      id: 'ps-discovery',
      priority: 'required' as const,
      rationale: 'Foundation for all analysis',
    });

    if (isPublic) {
      enabledPhases.push({
        id: 'ps-accessibility',
        priority: 'required' as const,
        rationale: 'Required for public sector',
      });
    }
  }

  // Always include synthesis
  enabledPhases.push({
    id: 'ps-estimation',
    priority: 'required' as const,
    rationale: 'Required for pitch',
  });
  enabledPhases.push({
    id: 'ps-documentation',
    priority: 'required' as const,
    rationale: 'Required for pitch',
  });

  // Mark skipped phases
  for (const cap of CAPABILITY_POOL) {
    if (!enabledPhases.some(p => p.id === cap.id)) {
      skippedPhases.push({
        id: cap.id,
        reason: 'Skipped in quick mode',
      });
    }
  }

  return {
    websiteType: context.websiteType ?? 'corporate',
    enabledPhases,
    skippedPhases,
    executionStrategy: {
      parallelism: 'aggressive',
      estimatedDurationMinutes: 5,
    },
  };
}

/**
 * Creates a full plan without LLM call.
 * Used for legacy mode where all phases should run.
 */
export function createFullPlan(): PhasePlan {
  return {
    websiteType: 'corporate',
    enabledPhases: CAPABILITY_POOL.map(cap => ({
      id: cap.id,
      priority: 'required' as const,
      rationale: 'Full analysis - all phases enabled',
    })),
    skippedPhases: [],
    executionStrategy: {
      parallelism: 'balanced',
      estimatedDurationMinutes: 15,
    },
  };
}
