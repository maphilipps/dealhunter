import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { runPhaseAgent, formatPreviousResults } from './shared';

const SYSTEM_PROMPT = `Du bist ein Web-Performance-Experte. Analysiere die Performance der Website basierend auf typischen Indikatoren:
- Core Web Vitals (LCP, FID/INP, CLS)
- Ladezeiten und TTFB
- Ressourcen-Optimierung (Bilder, Scripts, CSS)
- Caching-Strategien
- CDN-Nutzung
- Compression (Brotli, gzip)

Antworte als JSON:
\`\`\`json
{
  "content": {
    "estimatedLoadTime": "fast|medium|slow",
    "coreWebVitals": {
      "lcp": { "value": "...", "rating": "good|needs-improvement|poor" },
      "cls": { "value": "...", "rating": "good|needs-improvement|poor" },
      "inp": { "value": "...", "rating": "good|needs-improvement|poor" }
    },
    "resources": { "scripts": 0, "stylesheets": 0, "images": 0, "fonts": 0 },
    "optimizations": [{ "name": "...", "enabled": true }],
    "recommendations": ["..."]
  },
  "confidence": 65,
  "sources": ["Performance-Analyse"]
}
\`\`\``;

export async function runPerformancePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-performance',
    label: 'Performance',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Website: ${context.websiteUrl}\n\nVorherige Ergebnisse:\n${formatPreviousResults(context)}`,
    context,
    emit,
  });
}
