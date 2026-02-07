import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein CMS-Vergleichs-Experte. Vergleiche die Ziel-CMS-Systeme basierend auf den Anforderungen der analysierten Website:
- Feature-Abdeckung pro CMS
- Migrationskomplexität pro CMS
- Kosten (Lizenz, Hosting, Entwicklung)
- Community und Support
- Performance und Skalierbarkeit
- Barrierefreiheit-Support
- Enterprise-Readiness

Erstelle eine Vergleichsmatrix mit Scores pro Kriterium.

Antworte als JSON:
\`\`\`json
{
  "content": {
    "cmsOptions": [
      {
        "name": "...",
        "cmsId": "...",
        "scores": {
          "features": 0, "migration": 0, "cost": 0, "community": 0,
          "performance": 0, "accessibility": 0, "enterprise": 0
        },
        "totalScore": 0,
        "pros": ["..."],
        "cons": ["..."]
      }
    ],
    "comparisonCriteria": ["features", "migration", "cost", "community", "performance", "accessibility", "enterprise"],
    "recommendation": "..."
  },
  "confidence": 72,
  "sources": ["CMS-Vergleich"]
}
\`\`\``;

export async function runCmsComparisonPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-cms-comparison',
    label: 'CMS-Vergleich',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\nZiel-CMS-IDs: ${context.targetCmsIds.join(', ') || 'Drupal, Magnolia, Ibexa'}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
