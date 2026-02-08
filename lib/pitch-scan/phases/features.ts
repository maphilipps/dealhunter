import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
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
- content.summary
- content.findings (3-7)
- content.features: Liste erkannter Features (name/detected/category/details)
- content.complexity, content.customDevelopment (optional)
- confidence, sources optional` as const;

export async function runFeaturesPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-features',
    label: 'Features & Funktionalität',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Features & Funktionalitaet\n- Nenne konkrete user flows (z.B. Checkout, Registrierung) und wo sie sichtbar sind.\n- Findings sollen priorisiert und umsetzbar sein.`,
    context,
    emit,
  });
}
