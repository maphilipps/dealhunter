import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein CMS-Vergleichs-Experte. Vergleiche die Ziel-CMS-Systeme basierend auf den Anforderungen der analysierten Website:
- Feature-Abdeckung pro CMS
- Migrationskomplexität pro CMS
- Kosten (Lizenz, Hosting, Entwicklung)
- Community und Support
- Performance und Skalierbarkeit
- Barrierefreiheit-Support
- Enterprise-Readiness

Erstelle eine Vergleichsmatrix mit Scores pro Kriterium.

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7)
- content.cmsOptions/comparisonCriteria/recommendation als strukturierte Felder
- confidence, sources optional` as const;

export async function runCmsComparisonPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-cms-comparison',
    label: 'CMS-Vergleich',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: CMS-Vergleich\n- Ziel-CMS-IDs (Kontext): ${context.targetCmsIds.join(', ') || 'keine'}\n- Nutze PreQual Anforderungen (Compliance, Budget, Timeline) fuer scoring.\n- Findings sollen die Tradeoffs klar machen.`,
    context,
    emit,
  });
}
