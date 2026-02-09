import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein technischer Dokumentations-Experte. Erstelle eine Zusammenfassung aller Pitch-Scan-Ergebnisse als Management Summary:

Die Zusammenfassung soll enthalten:
1. Executive Summary (2-3 Sätze)
2. Ist-Zustand der Website (Tech-Stack, Content, Performance)
3. CMS-Empfehlung mit Begründung
4. Aufwandsschätzung (PT-Range)
5. Top-3 Risiken
6. Top-3 Chancen
7. Empfohlene nächste Schritte

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Executive Summary, Ist-Zustand, CMS-Empfehlung, Aufwandsschaetzung, Top-Risiken/Chancen, Naechste Schritte als H2 Sektionen. Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runDocumentationPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-documentation',
    label: 'Dokumentation',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Dokumentation (Management Summary)\n- Zusammenfassung muss auf PreQual Anforderungen zugeschnitten sein.\n- Keine Widersprueche zur Aufwandsschaetzung/CMS Empfehlung.`,
    context,
    emit,
  });
}
