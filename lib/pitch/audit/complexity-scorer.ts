import { z } from 'zod';
import { generateStructuredOutput } from '@/lib/ai/config';

const complexitySchema = z.object({
  complexity: z.enum(['low', 'medium', 'high', 'very_high']),
  score: z.number().min(0).max(100),
  reasoning: z.string(),
  factors: z.array(
    z.object({
      factor: z.string(),
      impact: z.enum(['positive', 'neutral', 'negative']),
      weight: z.number(),
    })
  ),
});

export type ComplexityResult = z.infer<typeof complexitySchema>;

export interface ComplexityScorerParams {
  componentCount: number;
  performanceScore: number;
  accessibilityScore: number;
  techStack: Record<string, unknown> | null;
}

const SYSTEM_PROMPT = `Du bist ein Migration-Complexity-Experte. Bewerte die Komplexität einer Website-Migration basierend auf technischen Metriken.

Bewertungskriterien:
- Komponenten-Anzahl: <10 = einfach, 10-30 = mittel, >30 = komplex
- Performance-Score: <30 = kritisch (+20 Punkte), 30-60 = optimierungsbedürftig (+10), >60 = ok
- Accessibility-Score: <50 = viel Nacharbeit (+15), 50-80 = moderat (+5), >80 = gut
- Tech-Stack: Legacy-Frameworks (jQuery, AngularJS 1.x, Backbone) = +15, Modern-Stack (React, Vue, Next.js) = +0

Scoring-Schwellwerte:
- 0-30 = low (einfache Migration)
- 31-50 = medium (moderate Komplexität)
- 51-70 = high (hohe Komplexität)
- 71-100 = very_high (sehr hohe Komplexität)

Analysiere die Faktoren gründlich und gib eine fundierte Einschätzung mit konkreten Begründungen.`;

/**
 * Score migration complexity using LLM analysis.
 * The LLM prompt is the single source of truth for scoring rules.
 * Retries once on failure before propagating the error.
 */
export async function scoreComplexity(params: ComplexityScorerParams): Promise<ComplexityResult> {
  const prompt = `Bewerte die Migration-Komplexität für folgende Website:

Komponenten-Anzahl: ${params.componentCount}
Performance-Score: ${params.performanceScore}/100
Accessibility-Score: ${params.accessibilityScore}/100
Tech-Stack: ${params.techStack ? JSON.stringify(params.techStack, null, 2) : 'Nicht erkannt'}

Erstelle eine detaillierte Komplexitätsbewertung mit:
1. Gesamtscore (0-100)
2. Komplexitätsstufe (low/medium/high/very_high)
3. Begründung der Bewertung
4. Einzelne Faktoren mit ihrem Einfluss (positive/neutral/negative) und Gewichtung`;

  const callLLM = () =>
    generateStructuredOutput({
      model: 'fast',
      schema: complexitySchema,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxTokens: 1000,
    });

  try {
    return await callLLM();
  } catch (firstError) {
    console.warn('[Complexity Scorer] First attempt failed, retrying:', firstError);
    try {
      return await callLLM();
    } catch (retryError) {
      console.error('[Complexity Scorer] Retry also failed:', retryError);
      throw retryError;
    }
  }
}
