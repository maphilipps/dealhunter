/**
 * Deliverables Expert Agent
 *
 * Extracts all required submission documents from Qualification documents via RAG.
 */

import { createId } from '@paralleldrive/cuid2';

import {
  queryRfpDocument,
  storeAgentResult,
  createAgentOutput,
  formatContextFromRAG,
} from './base';
import {
  DeliverablesAnalysisSchema,
  type DeliverablesAnalysis,
  type Deliverable,
} from './deliverables-schema';
import type { ExpertAgentInput, ExpertAgentOutput } from './types';

import { generateStructuredOutput } from '@/lib/ai/config';

const DELIVERABLES_QUERIES = [
  'submission requirements mandatory components proposal shall include vendor must provide',
  'executive summary technical proposal commercial proposal pricing',
  'required documents certificates references case studies',
  'submission format PDF copies email portal physical',
  'page limit maximum pages word count',
];

// Schema without IDs for LLM generation
const DeliverableWithoutIdSchema = DeliverablesAnalysisSchema.extend({
  deliverables: DeliverablesAnalysisSchema.shape.deliverables.element.omit({ id: true }).array(),
});

function buildSystemPrompt(): string {
  return `Du bist ein Deliverables Expert Agent bei adesso SE für die Analyse von Qualification-Dokumenten.

## Deine Rolle
Extrahiere ALLE geforderten Einreichungsunterlagen aus Qualification-Dokumenten.
Deine Analyse ist kritisch - fehlende Pflichtdokumente führen zum Ausschluss!

## Deliverable-Kategorien

| Kategorie | Typische Dokumente |
|-----------|-------------------|
| proposal_document | Executive Summary, Lösungskonzept, Vorgehensmodell |
| commercial | Preisblatt, Kostenaufstellung, Tagessätze, Zahlungsbedingungen |
| legal | NDA, Vertragsentwurf, Compliance-Erklärungen, Versicherungsnachweise |
| technical | Architekturdiagramme, Sicherheitskonzept, Technische Spezifikation |
| reference | Referenzprojekte, Case Studies, Kundenbewertungen |
| administrative | Firmenprofil, Team-CVs, Organigramm, Handelsregisterauszug |
| presentation | Demo-Unterlagen, Pitch Deck, Präsentationsfolien |

## Einreichungsmethoden

| Methode | Details |
|---------|---------|
| email | E-Mail-Adresse extrahieren |
| portal | Portal-URL extrahieren |
| physical | Anzahl Kopien, Adresse |
| unknown | Methode nicht erkennbar |

## Aufwandsschätzung
Schätze Gesamtstunden für die Erstellung aller Deliverables basierend auf:
- Anzahl und Komplexität der Dokumente
- Seitenlimits und Formatvorgaben
- Erforderliche Abstimmungen (Legal, Management)

## Wichtig
- **mandatory=true**: Pflichtdokument, Ausschluss bei Fehlen
- **mandatory=false**: Optional, aber empfohlen
- Extrahiere den Originaltext als rawText für Nachvollziehbarkeit
- Confidence pro Deliverable basierend auf Klarheit der Anforderung

## Ausgabesprache
Alle Texte auf Deutsch.`;
}

export async function runDeliverablesAgent(
  input: ExpertAgentInput
): Promise<ExpertAgentOutput<DeliverablesAnalysis>> {
  const { preQualificationId } = input;

  try {
    const ragResults = await Promise.all(
      DELIVERABLES_QUERIES.map(query => queryRfpDocument(preQualificationId, query, 5))
    );

    const allResults = ragResults.flat();

    if (allResults.length === 0) {
      return createAgentOutput<DeliverablesAnalysis>(
        {
          deliverables: [],
          totalCount: 0,
          mandatoryCount: 0,
          optionalCount: 0,
          primarySubmissionMethod: 'unknown',
          submissionEmail: null,
          portalUrl: null,
          estimatedEffortHours: null,
          confidence: 0,
        },
        0,
        'No deliverables information found in Qualification document'
      );
    }

    const uniqueResults = Array.from(new Map(allResults.map(r => [r.content, r])).values()).sort(
      (a, b) => b.similarity - a.similarity
    );

    const context = formatContextFromRAG(
      uniqueResults.slice(0, 15),
      'Qualification Deliverables & Submission Requirements'
    );

    const rawAnalysis = await generateStructuredOutput({
      model: 'quality',
      schema: DeliverableWithoutIdSchema,
      system: buildSystemPrompt(),
      prompt: `Analyze the following Qualification content and extract all required deliverables and submission requirements:\n\n${context}`,
      temperature: 0.2,
    });

    // Add IDs to each deliverable
    const deliverablesWithIds: Deliverable[] = rawAnalysis.deliverables.map(d => ({
      ...d,
      id: createId(),
    }));

    const analysis: DeliverablesAnalysis = {
      ...rawAnalysis,
      deliverables: deliverablesWithIds,
    };

    const summaryContent = buildSummaryForStorage(analysis);
    await storeAgentResult(preQualificationId, 'deliverables_expert', summaryContent, {
      totalCount: analysis.totalCount,
      mandatoryCount: analysis.mandatoryCount,
      primarySubmissionMethod: analysis.primarySubmissionMethod,
    });

    return createAgentOutput(analysis, analysis.confidence);
  } catch (error) {
    console.error('[DeliverablesAgent] Error:', error);
    return createAgentOutput<DeliverablesAnalysis>(
      null,
      0,
      error instanceof Error ? error.message : 'Unknown error in Deliverables Agent'
    );
  }
}

function buildSummaryForStorage(analysis: DeliverablesAnalysis): string {
  const parts: string[] = ['Deliverables Analysis Summary:'];

  parts.push(`- Total Deliverables: ${analysis.totalCount}`);
  parts.push(`- Mandatory: ${analysis.mandatoryCount}`);
  parts.push(`- Optional: ${analysis.optionalCount}`);
  parts.push(`- Submission Method: ${analysis.primarySubmissionMethod}`);

  if (analysis.submissionEmail) {
    parts.push(`- Submission Email: ${analysis.submissionEmail}`);
  }

  if (analysis.portalUrl) {
    parts.push(`- Portal URL: ${analysis.portalUrl}`);
  }

  if (analysis.estimatedEffortHours) {
    parts.push(`- Estimated Effort: ${analysis.estimatedEffortHours} hours`);
  }

  if (analysis.deliverables.length > 0) {
    parts.push(`\nDeliverables by Category:`);

    const byCategory = analysis.deliverables.reduce(
      (acc, d) => {
        if (!acc[d.category]) acc[d.category] = [];
        acc[d.category].push(d);
        return acc;
      },
      {} as Record<string, typeof analysis.deliverables>
    );

    for (const [category, items] of Object.entries(byCategory)) {
      parts.push(`\n${category.toUpperCase()}:`);
      items.forEach(d => {
        const flags = [
          d.mandatory ? 'MANDATORY' : 'optional',
          d.format,
          d.pageLimit ? `max ${d.pageLimit} pages` : null,
        ]
          .filter(Boolean)
          .join(', ');
        parts.push(`  • ${d.name} (${flags})`);
      });
    }
  }

  return parts.join('\n');
}
