import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Barrierefreiheit-Experte (WCAG 2.1/2.2). Analysiere die Website auf Barrierefreiheit:
- WCAG-Konformitätslevel (A, AA, AAA)
- Kritische Violations (fehlende Alt-Texte, Kontrast, Tastaturbedienbarkeit)
- ARIA-Nutzung und Landmarks
- Formulare und Labels
- Fokus-Management
- Schätzung der Behebungsaufwände

Antworte als JSON:
\`\`\`json
{
  "content": {
    "estimatedLevel": "A|AA|AAA|fail",
    "score": 0,
    "issues": { "critical": 0, "serious": 0, "moderate": 0, "minor": 0 },
    "checks": [{ "name": "...", "passed": true }],
    "estimatedFixHours": 0,
    "recommendations": ["..."]
  },
  "confidence": 60,
  "sources": ["WCAG-Analyse"]
}
\`\`\``;

export async function runAccessibilityPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-accessibility',
    label: 'Barrierefreiheit',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
