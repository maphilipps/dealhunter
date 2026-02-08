import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Drupal-Architektur-Experte. Falls Drupal als CMS empfohlen wurde, entwirf eine Drupal-Architektur:
- Content-Typen und Felder
- Taxonomien und Vokabulare
- Views und Displays
- Custom Module (falls benötigt)
- Theme-Architektur (Twig Templates, Component Library)
- Paragraphs/Layout Builder Strategie
- Multilingual-Setup (falls benötigt)
- Contributed Modules vs. Custom Development

Falls Drupal NICHT empfohlen wurde, erstelle eine generische CMS-Architektur-Empfehlung.

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7)
- content.isDrupalRecommended + content.architecture + estimatedCustomDevelopment + recommendations
- confidence, sources optional` as const;

export async function runDrupalArchitecturePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-drupal-architecture',
    label: 'Drupal-Architektur',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Drupal-Architektur\n- Wenn Drupal nicht empfohlen: gib trotzdem eine saubere, generische CMS-Architektur-Option.\n- Make decisions explicit: contributed vs custom, layout strategy, multilingual, etc.`,
    context,
    emit,
  });
}
