import { generateText, Output } from 'ai';

import { getModel } from '@/lib/ai/model-config';
import { indicationDocumentSchema, type IndicationDocument } from '../types';
import type { UncertaintyFlag } from '../tools/uncertainty-tool';

/**
 * Generates a structured indication document from all analysis results.
 *
 * Uses AI SDK v6 generateText with Output.object for structured output.
 * This is the final step of the pitch pipeline.
 */
export async function generateIndication(params: {
  auditResults: Record<string, unknown>;
  cmsAnalysis: Record<string, unknown>;
  industryAnalysis: Record<string, unknown>;
  interviewContext: Record<string, unknown>;
  flags: UncertaintyFlag[];
}): Promise<IndicationDocument> {
  const flagSection =
    params.flags.length > 0
      ? `\n\nUnsicherheiten/Flags:\n${params.flags.map(f => `- [${f.severity}] ${f.area}: ${f.message} (Confidence: ${f.confidence}%)`).join('\n')}`
      : '';

  try {
    const result = await generateText({
      model: await getModel('quality'),
      output: Output.object({ schema: indicationDocumentSchema }),
      system: `Du bist ein Senior-Berater bei adesso und erstellst eine professionelle Indikation (erste Einschätzung) für ein Website-Relaunch-Projekt.

Die Indikation soll:
- Dem Vertrieb als Grundlage für das Erstgespräch dienen
- Eine fundierte technische Analyse des Ist-Zustands enthalten
- Eine CMS-Empfehlung mit Begründung liefern
- Einen groben Aufwandsrahmen in PT schätzen
- Risiken und Flags transparent dokumentieren
- Nächste Schritte empfehlen

Wichtig: Kennzeichne unsichere Bereiche mit entsprechenden Flags.`,
      prompt: `Erstelle eine Indikation basierend auf folgenden Analyseergebnissen:

## Audit-Ergebnisse
${JSON.stringify(params.auditResults, null, 2)}

## CMS-Analyse
${JSON.stringify(params.cmsAnalysis, null, 2)}

## Branchen-Analyse
${JSON.stringify(params.industryAnalysis, null, 2)}

## Interview-Kontext
${JSON.stringify(params.interviewContext, null, 2)}${flagSection}`,
      temperature: 0.3,
      maxOutputTokens: 16000,
    });

    if (!result.output) {
      throw new Error('generateText returned empty output');
    }

    return result.output;
  } catch (error) {
    console.error('[Indication Generator] Failed:', error);
    throw error;
  }
}
