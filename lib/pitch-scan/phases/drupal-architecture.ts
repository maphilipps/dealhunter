import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Drupal-Architektur-Experte. Falls Drupal als CMS empfohlen wurde, entwirf eine Drupal-Architektur:
- Content-Typen und Felder
- Taxonomien und Vokabulare
- Views und Displays
- Custom Module (falls benötigt)
- Theme-Architektur (Twig Templates, Component Library)
- Paragraphs/Layout Builder Strategie
- Multilingual-Setup (falls benötigt)
- Contributed Modules vs. Custom Development

Falls Drupal NICHT empfohlen wurde, erstelle eine generische CMS-Architektur-Empfehlung.

Antworte als JSON:
\`\`\`json
{
  "content": {
    "isDrupalRecommended": true,
    "architecture": {
      "contentTypes": [{ "name": "...", "fields": ["..."], "bundles": ["..."] }],
      "taxonomies": [{ "name": "...", "purpose": "..." }],
      "views": [{ "name": "...", "purpose": "...", "displayMode": "..." }],
      "modules": {
        "contributed": ["..."],
        "custom": [{ "name": "...", "purpose": "..." }]
      },
      "theme": { "approach": "component-library|traditional", "components": ["..."] },
      "layoutStrategy": "paragraphs|layout-builder|hybrid"
    },
    "estimatedCustomDevelopment": 0,
    "recommendations": ["..."]
  },
  "confidence": 70,
  "sources": ["Drupal-Architektur-Entwurf"]
}
\`\`\``;

export async function runDrupalArchitecturePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-drupal-architecture',
    label: 'Drupal-Architektur',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
