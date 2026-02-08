import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/in-process/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Website-Analyse-Experte. Analysiere die gegebene Website-URL und erkenne:
- CMS (WordPress, Drupal, Typo3, Custom, etc.)
- Framework (React, Vue, Angular, etc.)
- Backend-Technologie (PHP, Node.js, .NET, Java, etc.)
- Hosting-Provider (AWS, Azure, Hetzner, etc.)
- CDN (Cloudflare, Akamai, etc.)
- Weitere Libraries und Tools

Antworte ausschließlich als JSON mit folgender Struktur:
\`\`\`json
{
  "content": {
    "cms": { "name": "...", "version": "...", "confidence": 0.9 },
    "framework": { "name": "...", "version": "...", "confidence": 0.8 },
    "backend": { "name": "...", "confidence": 0.7 },
    "hosting": { "name": "...", "confidence": 0.6 },
    "cdn": { "name": "...", "confidence": 0.5 },
    "libraries": [{ "name": "...", "version": "...", "category": "..." }],
    "server": { "name": "..." },
    "buildTools": [{ "name": "..." }]
  },
  "confidence": 75,
  "sources": ["URL-Analyse", "HTTP-Header-Analyse"]
}
\`\`\``;

export async function runDiscoveryPhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-discovery',
    label: 'Discovery & Tech-Stack',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Analysiere die Website: ${context.websiteUrl}\n\nZiel-CMS-IDs für Vergleich: ${context.targetCmsIds.join(', ') || 'keine'}`,
    context,
    emit,
  });
}
