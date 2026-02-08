import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein CMS-Berater. Basierend auf dem CMS-Vergleich, gib eine klare Empfehlung ab:
- Primäre CMS-Empfehlung mit Begründung
- Alternatives CMS falls Budget/Anforderungen sich ändern
- Spezifische Vorteile für dieses Projekt
- Risiken bei der Wahl
- Next Steps für die Evaluierung

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7)
- content.primaryRecommendation/alternativeRecommendation/risks/nextSteps als strukturierte Felder
- confidence, sources optional` as const;

export async function runCmsRecommendationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-cms-recommendation',
    label: 'CMS-Empfehlung',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: CMS-Empfehlung\n- Recommendation muss decision-grade sein (klar, begruendet, mit Tradeoffs).\n- Setze Risiken + next steps so, dass ein Team damit direkt weiterarbeiten kann.`,
    context,
    emit,
  });
}
