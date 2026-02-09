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
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit WCAG-Kriterien-Tabelle und Prioritaetsliste. Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runAccessibilityPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-accessibility',
    label: 'Barrierefreiheit',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Barrierefreiheit\n- Priorisiere Erkenntnisse nach Risiko/Impact.\n- Wenn PreQual public procurement/Compliance relevant: besonders streng und konkret sein.`,
    context,
    emit,
  });
}
