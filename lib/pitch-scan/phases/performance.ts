import type { PhaseContext, PhaseResult } from '../types';
import type { EventEmitter } from '@/lib/streaming/event-emitter';
import { buildBaseUserPrompt, runPhaseAgent } from './shared';

const SYSTEM_PROMPT =
  `Du bist ein Web-Performance-Experte. Analysiere die Performance der Website basierend auf typischen Indikatoren:
- Core Web Vitals (LCP, FID/INP, CLS)
- Ladezeiten und TTFB
- Ressourcen-Optimierung (Bilder, Scripts, CSS)
- Caching-Strategien
- CDN-Nutzung
- Compression (Brotli, gzip)

Output: JSON gemaess Schema:
- content.summary: 1-2 Saetze Kurzfassung
- content.markdown: Vollstaendige Analyse als Markdown mit Metriken-Tabelle (LCP, FID/INP, CLS, TTFB) und Empfehlungen. Keine kuenstliche Kuerzung — alle relevanten Details ausfuehren.
- confidence: 0-100
- sources: optional` as const;

export async function runPerformancePhase(
  context: PhaseContext,
  emit: EventEmitter
): Promise<PhaseResult> {
  return runPhaseAgent({
    sectionId: 'ps-performance',
    label: 'Performance',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `${buildBaseUserPrompt(context)}\n\n# Phase: Performance\n- Gib konkrete, messbare Hinweise (TTFB, große Assets, Render-Blocking) und sinnvolle Next Steps.\n- Beziehe Kundenanforderungen (PreQual) ein.`,
    context,
    emit,
  });
}
