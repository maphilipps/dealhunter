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

/**
 * Fallback function for quick execution without LLM call.
 * Used when LLM scoring fails or for rapid assessments.
 */
export function deriveMigrationComplexityFallback(
  componentCount: number,
  performanceScore: number,
  accessibilityScore: number
): ComplexityResult {
  // Components drive complexity; poor performance and accessibility add risk
  let score = Math.min(componentCount * 5, 80);

  // Performance impact
  if (performanceScore < 30) {
    score += 20;
  } else if (performanceScore < 60) {
    score += 10;
  }

  // Accessibility impact
  if (accessibilityScore < 50) {
    score += 15;
  } else if (accessibilityScore < 80) {
    score += 5;
  }

  score = Math.min(score, 100);

  const complexity =
    score <= 30 ? 'low' : score <= 50 ? 'medium' : score <= 70 ? 'high' : 'very_high';

  const factors: ComplexityResult['factors'] = [];

  // Component factor
  if (componentCount < 10) {
    factors.push({ factor: 'Geringe Komponenten-Anzahl', impact: 'positive', weight: 20 });
  } else if (componentCount <= 30) {
    factors.push({ factor: 'Moderate Komponenten-Anzahl', impact: 'neutral', weight: 15 });
  } else {
    factors.push({ factor: 'Hohe Komponenten-Anzahl', impact: 'negative', weight: 25 });
  }

  // Performance factor
  if (performanceScore >= 60) {
    factors.push({ factor: 'Guter Performance-Score', impact: 'positive', weight: 10 });
  } else if (performanceScore >= 30) {
    factors.push({ factor: 'Optimierungsbedarf bei Performance', impact: 'neutral', weight: 10 });
  } else {
    factors.push({ factor: 'Kritischer Performance-Score', impact: 'negative', weight: 20 });
  }

  // Accessibility factor
  if (accessibilityScore >= 80) {
    factors.push({ factor: 'Guter Accessibility-Score', impact: 'positive', weight: 5 });
  } else if (accessibilityScore >= 50) {
    factors.push({ factor: 'Moderater Accessibility-Score', impact: 'neutral', weight: 5 });
  } else {
    factors.push({ factor: 'Kritischer Accessibility-Score', impact: 'negative', weight: 15 });
  }

  return {
    complexity,
    score,
    reasoning: `Fallback-Bewertung basierend auf ${componentCount} Komponenten, Performance-Score ${performanceScore}/100, Accessibility-Score ${accessibilityScore}/100.`,
    factors,
  };
}

/**
 * Score migration complexity using LLM analysis.
 * Falls back to heuristic scoring if LLM call fails.
 */
export async function scoreComplexity(params: ComplexityScorerParams): Promise<ComplexityResult> {
  try {
    const result = await generateStructuredOutput({
      model: 'fast',
      schema: complexitySchema,
      system: `Du bist ein Migration-Complexity-Experte. Bewerte die Komplexität einer Website-Migration basierend auf technischen Metriken.

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

Analysiere die Faktoren gründlich und gib eine fundierte Einschätzung mit konkreten Begründungen.`,
      prompt: `Bewerte die Migration-Komplexität für folgende Website:

Komponenten-Anzahl: ${params.componentCount}
Performance-Score: ${params.performanceScore}/100
Accessibility-Score: ${params.accessibilityScore}/100
Tech-Stack: ${params.techStack ? JSON.stringify(params.techStack, null, 2) : 'Nicht erkannt'}

Erstelle eine detaillierte Komplexitätsbewertung mit:
1. Gesamtscore (0-100)
2. Komplexitätsstufe (low/medium/high/very_high)
3. Begründung der Bewertung
4. Einzelne Faktoren mit ihrem Einfluss (positive/neutral/negative) und Gewichtung`,
      temperature: 0.2,
      maxTokens: 1000,
    });

    return result;
  } catch (error) {
    console.error('[Complexity Scorer] LLM scoring failed, using fallback:', error);
    return deriveMigrationComplexityFallback(
      params.componentCount,
      params.performanceScore,
      params.accessibilityScore
    );
  }
}
