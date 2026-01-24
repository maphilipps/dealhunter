/**
 * CMS Comparison Synthesizer Agent
 *
 * Synthesizes CMS comparison data from RAG for the Lead Terminal.
 * Used by SectionPageTemplate when rendering cms-comparison section.
 */

import { z } from 'zod';

import { generateStructuredOutput } from '@/lib/ai/config';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CMSComparisonSynthesizerInput {
  leadId: string;
  ragData: string; // Raw RAG data from retrieval
  customerProfile?: {
    industry?: string;
    companySize?: string;
    budget?: string;
  };
}

export const CMSComparisonSynthesizedSchema = z.object({
  // Summary
  summary: z.object({
    recommendedCMS: z.string(),
    recommendationStrength: z.enum(['strong', 'moderate', 'weak']),
    alternativeCMS: z.string().optional(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(100),
  }),

  // CMS Options
  cmsOptions: z.array(
    z.object({
      name: z.string(),
      fitScore: z.number().min(0).max(100),
      pitchSummary: z.string(),
      estimatedHours: z.number().optional(),
      topStrengths: z.array(z.string()).max(3),
      topWeaknesses: z.array(z.string()).max(2),
    })
  ),

  // Comparison Matrix (simplified for UI)
  comparisonMatrix: z.array(
    z.object({
      criterion: z.string(),
      winner: z.string(),
      scores: z.record(z.string(), z.number()),
    })
  ),

  // Decision Factors
  decisionFactors: z.array(z.string()).min(2).max(5),

  // Next Steps
  nextSteps: z.array(z.string()).min(1).max(3),

  // Data Quality
  dataQuality: z.object({
    hasAdvocateData: z.boolean(),
    hasComparisonMatrix: z.boolean(),
    sourcesCount: z.number(),
    lastUpdated: z.string().optional(),
  }),
});

export type CMSComparisonSynthesized = z.infer<typeof CMSComparisonSynthesizedSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHESIZER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Synthesize CMS comparison data for display
 */
export async function synthesizeCMSComparison(
  input: CMSComparisonSynthesizerInput
): Promise<CMSComparisonSynthesized> {
  // Check if RAG data contains CMS comparison info
  const hasAdvocateData =
    input.ragData.includes('CMS Advocate') || input.ragData.includes('Fit-Score');
  const hasComparisonMatrix =
    input.ragData.includes('Vergleichsmatrix') || input.ragData.includes('comparisonMatrix');

  const prompt = `Du bist ein CMS-Berater bei adesso SE. Analysiere die folgenden RAG-Daten und erstelle eine strukturierte Zusammenfassung für die CMS-Auswahl.

## RAG-Daten
${input.ragData}

${
  input.customerProfile
    ? `
## Kunden-Profil
- Branche: ${input.customerProfile.industry || 'Unbekannt'}
- Größe: ${input.customerProfile.companySize || 'Unbekannt'}
- Budget: ${input.customerProfile.budget || 'Unbekannt'}
`
    : ''
}

## Deine Aufgabe

1. **Empfehlung extrahieren**
   - Welches CMS wird empfohlen?
   - Wie stark ist die Empfehlung (strong/moderate/weak)?
   - Was ist die Begründung?

2. **CMS-Optionen auflisten**
   - Name, Fit-Score, kurze Pitch-Zusammenfassung
   - Top 3 Stärken, Top 2 Schwächen pro CMS

3. **Vergleichsmatrix erstellen**
   - Wichtigste Kriterien mit Gewinner und Scores

4. **Entscheidungsfaktoren**
   - Was sind die wichtigsten Entscheidungskriterien?

5. **Nächste Schritte**
   - Was sollte der Kunde als nächstes tun?

WICHTIG: Wenn keine ausreichenden Daten vorhanden sind, erstelle eine Basis-Empfehlung mit niedrigem Confidence-Score.
`;

  try {
    const result = await generateStructuredOutput({
      model: 'quality',
      schema: CMSComparisonSynthesizedSchema,
      system:
        'Du bist ein CMS-Berater. Extrahiere und strukturiere CMS-Vergleichsdaten für eine klare Präsentation.',
      prompt,
      temperature: 0.3,
    });

    // Enhance with data quality info
    result.dataQuality = {
      hasAdvocateData,
      hasComparisonMatrix,
      sourcesCount: (input.ragData.match(/CMS \d+:/g) || []).length,
      lastUpdated: new Date().toISOString(),
    };

    return result;
  } catch (error) {
    console.error('[CMS Comparison Synthesizer] Error:', error);

    // Return fallback structure
    return {
      summary: {
        recommendedCMS: 'Drupal',
        recommendationStrength: 'weak',
        alternativeCMS: 'Magnolia',
        reasoning:
          'Keine ausreichenden Daten für eine fundierte Empfehlung. Bitte CMS Advocate Analyse durchführen.',
        confidence: 30,
      },
      cmsOptions: [
        {
          name: 'Drupal',
          fitScore: 50,
          pitchSummary: 'Enterprise-CMS mit starker Community und Flexibilität.',
          topStrengths: ['Open Source', 'Große Community', 'Flexibel'],
          topWeaknesses: ['Komplexität', 'Lernkurve'],
        },
        {
          name: 'Magnolia',
          fitScore: 50,
          pitchSummary: 'Java-basiertes Enterprise-CMS mit starkem Visual Editor.',
          topStrengths: ['Visual Editor', 'Java-Ökosystem', 'Personalisierung'],
          topWeaknesses: ['Lizenzkosten', 'Weniger Entwickler'],
        },
      ],
      comparisonMatrix: [],
      decisionFactors: ['Keine ausreichenden Daten für detaillierte Analyse'],
      nextSteps: ['CMS Advocate Analyse durchführen', 'Requirements Workshop planen'],
      dataQuality: {
        hasAdvocateData: false,
        hasComparisonMatrix: false,
        sourcesCount: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}
