import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein CMS-Architektur-Experte bei adesso SE. Basierend auf der CMS-Empfehlung aus vorherigen Phasen, entwirf eine passende CMS-Architektur:
- Content-Typen und Felder
- Taxonomien und Vokabulare
- Views und Displays / Content-Listen
- Custom-Entwicklung (falls benötigt)
- Theme-/Template-Architektur
- Layout-Strategie (Component Library, Page Builder, etc.)
- Multilingual-Setup (falls benötigt)
- Standardmodule/-Plugins vs. Custom Development

Passe die Architektur an das empfohlene CMS an (aus den erlaubten Ziel-CMS-IDs).
Falls noch kein CMS empfohlen wurde, erstelle die Architektur fuer das erste CMS aus der Ziel-CMS-Liste.

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Content-Typen, Taxonomien, Modul-Liste, Layout-Strategie Sektionen. Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runDrupalArchitecturePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-drupal-architecture',
    label: 'Architektur',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: CMS-Architektur\n- Orientiere dich am empfohlenen CMS aus der CMS-Empfehlung.\n- Falls kein CMS empfohlen: generische Architektur-Empfehlung.\n- Make decisions explicit: standard vs custom, layout strategy, multilingual, etc.`,
    context,
    emit,
  });
}
