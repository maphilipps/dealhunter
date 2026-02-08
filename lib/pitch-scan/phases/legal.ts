import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Experte für Web-Compliance und Datenschutz. Analysiere die Website auf:
- DSGVO-Konformität (Cookie-Consent, Datenschutzerklärung)
- Impressum (Vollständigkeit gemäß § 5 TMG)
- Cookie-Banner und Consent-Management-Tool
- Third-Party-Tracker und Analytics
- SSL/TLS-Zertifikat
- AGB und Widerrufsbelehrung (bei E-Commerce)

Output: JSON gemaess Schema:
- content.summary
- content.findings (3-7)
- content.score/checks/cookieTool/trackers/sslValid/gdprIssues/recommendations als strukturierte Felder
- confidence, sources optional` as const;

export async function runLegalPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-legal',
    label: 'Legal & Compliance',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Legal & Compliance\n- Findings muessen konkrete Stellen nennen (Impressum/Datenschutz/Consent).\n- Empfehlungen muessen pragmatisch umsetzbar sein.`,
    context,
    emit,
  });
}
