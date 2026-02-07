import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein CMS-Berater. Basierend auf dem CMS-Vergleich, gib eine klare Empfehlung ab:
- Primäre CMS-Empfehlung mit Begründung
- Alternatives CMS falls Budget/Anforderungen sich ändern
- Spezifische Vorteile für dieses Projekt
- Risiken bei der Wahl
- Next Steps für die Evaluierung

Antworte als JSON:
\`\`\`json
{
  "content": {
    "primaryRecommendation": {
      "cmsName": "...",
      "cmsId": "...",
      "reasoning": "...",
      "fitScore": 0,
      "keyBenefits": ["..."]
    },
    "alternativeRecommendation": {
      "cmsName": "...",
      "cmsId": "...",
      "reasoning": "...",
      "fitScore": 0,
      "whenToConsider": "..."
    },
    "risks": ["..."],
    "nextSteps": ["..."]
  },
  "confidence": 75,
  "sources": ["CMS-Empfehlung basierend auf Vergleich"]
}
\`\`\``;

export async function runCmsRecommendationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-cms-recommendation',
    label: 'CMS-Empfehlung',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
