import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Barrierefreiheit-Experte (WCAG 2.1/2.2). Analysiere die Website auf Barrierefreiheit:
- WCAG-Konformitätslevel (A, AA, AAA)
- Kritische Violations (fehlende Alt-Texte, Kontrast, Tastaturbedienbarkeit)
- ARIA-Nutzung und Landmarks
- Formulare und Labels
- Fokus-Management
- Schätzung der Behebungsaufwände

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7) mit WCAG Bezug (Kriterium) wo moeglich
- content.estimatedLevel/score/issues/checks/estimatedFixHours/recommendations als strukturierte Felder
- confidence, sources optional` as const;

export async function runAccessibilityPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-accessibility',
    label: 'Barrierefreiheit',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Barrierefreiheit\n- Priorisiere Findings nach Risiko/Impact.\n- Wenn PreQual public procurement/Compliance relevant: besonders streng und konkret sein.`,
    context,
    emit,
  });
}
