import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Content-Architektur-Experte. Basierend auf den Discovery-Ergebnissen, analysiere die Content-Architektur der Website:
- Seitentypen (Landing Pages, Blog, Produkte, etc.)
- Content Model (Felder, Taxonomien, Medien)
- Navigationsstruktur und Informationsarchitektur
- Content-Volumen und Sprachen
- Multisite/Multilingual-Setup

Antworte als JSON:
\`\`\`json
{
  "content": {
    "pageTypes": [{ "name": "...", "count": 0, "fields": ["..."] }],
    "taxonomies": [{ "name": "...", "termCount": 0 }],
    "languages": ["de", "en"],
    "estimatedPages": 0,
    "contentComplexity": "low|medium|high",
    "mediaAssets": { "images": 0, "videos": 0, "documents": 0 },
    "navigation": { "levels": 0, "items": 0 }
  },
  "confidence": 70,
  "sources": ["Sitemap-Analyse", "Navigation-Analyse"]
}
\`\`\``;

export async function runContentArchitecturePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-content-architecture',
    label: 'Content-Architektur',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
