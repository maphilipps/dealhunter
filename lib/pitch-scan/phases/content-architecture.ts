import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Content-Architektur-Experte. Basierend auf den Discovery-Ergebnissen, analysiere die Content-Architektur der Website:
- Seitentypen (Landing Pages, Blog, Produkte, etc.)
- Content Model (Felder, Taxonomien, Medien)
- Navigationsstruktur und Informationsarchitektur
- Content-Volumen und Sprachen
- Multisite/Multilingual-Setup

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Content-Typen-Liste, Seitenstruktur-Uebersicht und Navigationsebenen. Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runContentArchitecturePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-content-architecture',
    label: 'Content-Architektur',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Content-Architektur\n- Gib konkrete Beispiele (Seitentypen, Sprachvarianten, Navigationsebenen).\n- Analyse muss an Kundenanforderungen ankoppeln (PreQual).`,
    context,
    emit,
  });
}
