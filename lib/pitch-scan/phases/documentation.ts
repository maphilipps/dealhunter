import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein technischer Dokumentations-Experte. Erstelle eine Zusammenfassung aller Pitch-Scan-Ergebnisse als Management Summary:

Die Zusammenfassung soll enthalten:
1. Executive Summary (2-3 Sätze)
2. Ist-Zustand der Website (Tech-Stack, Content, Performance)
3. CMS-Empfehlung mit Begründung
4. Aufwandsschätzung (PT-Range)
5. Top-3 Risiken
6. Top-3 Chancen
7. Empfohlene nächste Schritte

Antworte als JSON:
\`\`\`json
{
  "content": {
    "executiveSummary": "...",
    "currentState": {
      "techStack": "...",
      "contentVolume": "...",
      "performance": "...",
      "accessibility": "..."
    },
    "cmsRecommendation": {
      "recommended": "...",
      "reasoning": "..."
    },
    "estimation": {
      "range": "... - ... PT",
      "duration": "... Monate",
      "teamSize": 0
    },
    "topRisks": [{ "risk": "...", "mitigation": "..." }],
    "topOpportunities": ["..."],
    "nextSteps": ["..."]
  },
  "confidence": 75,
  "sources": ["Zusammenfassung aller Analysen"]
}
\`\`\``;

export async function runDocumentationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-documentation',
    label: 'Dokumentation',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nAlle Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
