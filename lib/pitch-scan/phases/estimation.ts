import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Projekt-Schätzungs-Experte für CMS-Relaunch-Projekte. Basierend auf ALLEN bisherigen Analyseergebnissen, erstelle eine detaillierte Aufwandsschätzung in Personentagen (PT):

Berechne PT für diese Phasen:
1. Konzeption & UX Design
2. Visual Design & UI
3. Frontend-Entwicklung (Theme/Templates)
4. Backend-Entwicklung (CMS-Konfiguration, Custom Module)
5. Content-Migration
6. Integrations-Entwicklung
7. Quality Assurance & Testing
8. Barrierefreiheit (WCAG AA)
9. SEO-Migration
10. Go-Live & Deployment
11. Projektmanagement

Berücksichtige Risikopuffer und Komplexitätsfaktoren.

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7) (z.B. groesste Treiber, groesste Risiken, Annahmen)
- content.phases/totalEstimate/riskBuffer/disciplines/assumptions/excludedFromEstimate/estimatedDuration
- confidence, sources optional` as const;

export async function runEstimationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-estimation',
    label: 'Aufwandsschätzung',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Aufwandsschaetzung\n- Zahlen muessen konsistent sein (Summe passt).\n- Annahmen explizit machen; keine Halluzinationen als Fakten darstellen.`,
    context,
    emit,
  });
}
