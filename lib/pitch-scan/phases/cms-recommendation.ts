import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein CMS-Berater bei adesso SE. Basierend auf dem CMS-Vergleich, gib eine klare Empfehlung ab.

WICHTIG: Du darfst NUR CMS-Systeme empfehlen, die in den Ziel-CMS-IDs angegeben sind. adesso hat ein definiertes CMS-Portfolio — andere CMS (WordPress, Contentful, Strapi, etc.) duerfen NICHT als primaere oder alternative Empfehlung genannt werden.

Struktur:
- Primaere CMS-Empfehlung (aus den erlaubten CMS) mit Begruendung
- Alternatives CMS (aus den erlaubten CMS) falls Budget/Anforderungen sich aendern
- Spezifische Vorteile fuer dieses Projekt
- Risiken bei der Wahl
- Next Steps fuer die Evaluierung

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit H2/H3 Sektionen fuer Primaere Empfehlung, Alternative, Risiken, Next Steps. Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runCmsRecommendationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-cms-recommendation',
    label: 'CMS-Empfehlung',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: CMS-Empfehlung\n- ERLAUBTE CMS (NUR aus diesen empfehlen!): ${context.targetCmsIds.join(', ') || 'keine'}\n- Empfehle AUSSCHLIESSLICH CMS aus der obigen Liste. Keine anderen CMS.\n- Recommendation muss decision-grade sein (klar, begruendet, mit Tradeoffs).\n- Setze Risiken + next steps so, dass ein Team damit direkt weiterarbeiten kann.`,
    context,
    emit,
  });
}
