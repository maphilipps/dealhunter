import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Feature-Analyse-Experte. Erkenne alle Funktionen und Features der Website:
- E-Commerce (Shop, Warenkorb, Checkout)
- Formulare (Kontakt, Login, Registrierung)
- Suche (Volltext, Facettensuche)
- Interaktive Elemente (Filter, Karten, Kalender)
- Personalisierung und A/B-Testing
- Newsletter und Marketing-Automation
- Social Media Integration
- Barrierefreiheit-Features

Antworte als JSON:
\`\`\`json
{
  "content": {
    "features": [
      { "name": "...", "detected": true, "category": "ecommerce|form|search|interactive|marketing|social|a11y", "details": "..." }
    ],
    "complexity": "low|medium|high",
    "customDevelopment": ["..."]
  },
  "confidence": 72,
  "sources": ["DOM-Analyse", "Script-Analyse"]
}
\`\`\``;

export async function runFeaturesPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-features',
    label: 'Features & Funktionalität',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
