import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Projekt-Schätzungs-Experte für CMS-Relaunch-Projekte. Basierend auf ALLEN bisherigen Analyseergebnissen, erstelle eine detaillierte Aufwandsschätzung in Personentagen (PT):

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

Antworte als JSON:
\`\`\`json
{
  "content": {
    "phases": [
      { "name": "...", "minPT": 0, "maxPT": 0, "confidence": 0.7, "notes": "..." }
    ],
    "totalEstimate": { "minPT": 0, "maxPT": 0, "bestCase": 0 },
    "riskBuffer": { "percentage": 20, "reasoning": "..." },
    "disciplines": {
      "pm": 0, "ux": 0, "design": 0, "frontend": 0, "backend": 0, "qa": 0, "devops": 0
    },
    "assumptions": ["..."],
    "excludedFromEstimate": ["..."],
    "estimatedDuration": { "months": 0, "teamSize": 0 }
  },
  "confidence": 60,
  "sources": ["Aufwandsschätzung basierend auf Analyse"]
}
\`\`\``;

export async function runEstimationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-estimation',
    label: 'Aufwandsschätzung',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
