import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein CMS-Vergleichs-Experte bei adesso SE. Vergleiche AUSSCHLIESSLICH die Ziel-CMS-Systeme aus der Liste der erlaubten CMS-IDs.

WICHTIG: Du darfst NUR die CMS-Systeme vergleichen und empfehlen, die in den Ziel-CMS-IDs angegeben sind. Andere CMS (WordPress, Contentful, Strapi, etc.) duerfen NICHT empfohlen werden, da adesso nur bestimmte CMS im Portfolio hat.

Vergleichskriterien:
- Feature-Abdeckung pro CMS
- Migrationskomplexitaet pro CMS
- Kosten (Lizenz, Hosting, Entwicklung)
- Community und Support
- Performance und Skalierbarkeit
- Barrierefreiheit-Support
- Enterprise-Readiness

Erstelle eine Vergleichsmatrix mit Scores pro Kriterium.

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Vergleichsmatrix-Tabelle (Kriterien x CMS-Systeme). Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runCmsComparisonPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-cms-comparison',
    label: 'CMS-Vergleich',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: CMS-Vergleich\n- ERLAUBTE Ziel-CMS (NUR diese vergleichen!): ${context.targetCmsIds.join(', ') || 'keine'}\n- Vergleiche AUSSCHLIESSLICH die oben genannten CMS. Keine anderen CMS vorschlagen.\n- Nutze PreQual Anforderungen (Compliance, Budget, Timeline) fuer scoring.\n- Stelle die Tradeoffs zwischen den erlaubten CMS klar dar.`,
    context,
    emit,
  });
}
