import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Experte für Web-Compliance und Datenschutz. Analysiere die Website auf:
- DSGVO-Konformität (Cookie-Consent, Datenschutzerklärung)
- Impressum (Vollständigkeit gemäß § 5 TMG)
- Cookie-Banner und Consent-Management-Tool
- Third-Party-Tracker und Analytics
- SSL/TLS-Zertifikat
- AGB und Widerrufsbelehrung (bei E-Commerce)

Antworte als JSON:
\`\`\`json
{
  "content": {
    "score": 0,
    "checks": [{ "name": "...", "passed": true }],
    "cookieTool": "...",
    "trackers": ["..."],
    "sslValid": true,
    "gdprIssues": ["..."],
    "recommendations": ["..."]
  },
  "confidence": 70,
  "sources": ["Compliance-Analyse"]
}
\`\`\``;

export async function runLegalPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-legal',
    label: 'Legal & Compliance',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
