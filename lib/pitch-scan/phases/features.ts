import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Feature-Analyse-Experte. Erkenne alle Funktionen und Features der Website:
- E-Commerce (Shop, Warenkorb, Checkout)
- Formulare (Kontakt, Login, Registrierung)
- Suche (Volltext, Facettensuche)
- Interaktive Elemente (Filter, Karten, Kalender)
- Personalisierung und A/B-Testing
- Newsletter und Marketing-Automation
- Social Media Integration
- Barrierefreiheit-Features

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Feature-Matrix (| Feature | Vorhanden | Kategorie | Details |). Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runFeaturesPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-features',
    label: 'Features & Funktionalität',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Features & Funktionalitaet\n- Nenne konkrete user flows (z.B. Checkout, Registrierung) und wo sie sichtbar sind.\n- Erkenntnisse sollen priorisiert und umsetzbar sein.`,
    context,
    emit,
  });
}
